"use client";
import { useEffect, useState } from "react";
import api, { setAuthToken } from "../../lib/api";
import { useAuth } from "../../store/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { DashboardSkeleton } from "../../components/ui/Skeleton";

function fmtMoney(cents: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(cents / 100);
}

// Hook para detectar móvil
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

export default function Dashboard() {
  const { user, logout, token, initialized, initAuth } = useAuth();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [data, setData] = useState<any>();
  const [monthlyData, setMonthlyData] = useState<any>();
  const [goalData, setGoalData] = useState<any>();
  const [chartData, setChartData] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [dailyData, setDailyData] = useState<any>(null);
  const [previousMonthData, setPreviousMonthData] = useState<any>(null);
  const [pendingRecurring, setPendingRecurring] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0); // Key para forzar recarga

  // Detectar cuando la página gana foco (usuario vuelve de otra página)
  useEffect(() => {
    const handleFocus = () => {
      // Recargar datos cuando la ventana gana foco (usuario vuelve de crear transacción)
      if (user && token) {
        loadData();
      }
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [user, token]);

  useEffect(() => {
    // Esperar a que Zustand rehidrate
    if (!initialized) {
      initAuth();
      return;
    }

    if (!user || !token) {
      router.push("/login");
      return;
    }

    setAuthToken(token);
    loadData();
  }, [user, token, initialized, selectedDate, router, initAuth, refreshKey]);

  async function loadData() {
    setLoading(true);
    setError(undefined);
        try {
          const [year, month] = selectedDate.split("-").map(Number);
          // Usar el día actual del mes seleccionado, o el último día si ya pasó
          const today = new Date();
          const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
          const dayOfMonth = isCurrentMonth ? today.getDate() : new Date(year, month, 0).getDate();
          const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`;
      
      const res = await api.get(`/budget/summary?date=${dateStr}`);
      setData(res.data.data);

      // Cargar datos mensuales
      const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
      const monthEnd = `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}`;
      
      // Cargar últimos 6 meses para gráfico de tendencias
      const sixMonthsAgo = new Date(year, month - 6, 1);
      const historicalStart = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, "0")}-01`;
      
      const [transactionsRes, statsRes, goalsRes, historicalRes] = await Promise.all([
        api.get(`/transactions?from=${monthStart}&to=${monthEnd}&pageSize=100`),
        api.get(`/statistics/expenses-by-category?year=${year}&month=${month}&period=month`),
        api.get(`/goals?year=${year}&month=${month}`).catch(() => ({ data: { goal: null } })),
        api.get(`/transactions?from=${historicalStart}&to=${monthEnd}&pageSize=500`).catch(() => ({ data: { transactions: [] } }))
      ]);

      const transactions = transactionsRes.data.transactions || [];
      
      // Obtener tipo de cambio USD/UYU con fallback más realista
      // Nota: El rate por defecto debe actualizarse periódicamente o usar un servicio de respaldo
      const DEFAULT_USD_UYU_RATE = 42.0; // Actualizado Nov 2025
      const exchangeRateRes = await api.get("/exchange/rate").catch((err) => {
        console.warn("Error obteniendo tipo de cambio, usando fallback:", err?.message);
        return { data: { rate: DEFAULT_USD_UYU_RATE } };
      });
      const usdToUyuRate = exchangeRateRes.data.rate || DEFAULT_USD_UYU_RATE;
      
      // Convertir todas las transacciones a la moneda base del usuario (UYU)
      const baseCurrency = user?.currencyCode || "UYU";
      const convertToBase = (amountCents: number, currencyCode: string) => {
        if (currencyCode === baseCurrency) return amountCents;
        if (currencyCode === "USD" && baseCurrency === "UYU") {
          return Math.round(amountCents * usdToUyuRate);
        }
        if (currencyCode === "UYU" && baseCurrency === "USD") {
          return Math.round(amountCents / usdToUyuRate);
        }
        return amountCents; // Moneda no soportada
      };
      
      const totalIncome = transactions
        .filter((t: any) => t.type === "INCOME")
        .reduce((sum: number, t: any) => sum + convertToBase(t.amountCents, t.currencyCode || baseCurrency), 0);
      const totalExpenses = transactions
        .filter((t: any) => t.type === "EXPENSE")
        .reduce((sum: number, t: any) => sum + convertToBase(t.amountCents, t.currencyCode || baseCurrency), 0);
      
      // Calcular ahorro dirigido: transferencias a cuentas de tipo SAVINGS o ingresos directos a cuentas SAVINGS
      const accountsRes = await api.get("/accounts").catch(() => ({ data: { accounts: [] } }));
      const savingsAccounts = accountsRes.data.accounts
        .filter((a: any) => a.type === "SAVINGS")
        .map((a: any) => a.id);
      
      // Ahorro = ingresos directos a cuentas de ahorro (convertidos a moneda base)
      const directedSavings = transactions
        .filter((t: any) => {
          if (savingsAccounts.includes(t.accountId)) {
            // Ingresos directos a cuenta de ahorro
            return t.type === "INCOME";
          }
          return false;
        })
        .reduce((sum: number, t: any) => sum + convertToBase(t.amountCents, t.currencyCode || baseCurrency), 0);
      
      const expensesByCat = statsRes.data.data || [];
      const goal = goalsRes.data.goal;

      // Calcular meta de ahorro convertida
      const goalCentsConverted = goal ? convertToBase(goal.savingGoalCents, baseCurrency) : 0;
      const availableBalance = totalIncome - totalExpenses - goalCentsConverted;
      
      setMonthlyData({
        totalIncome,
        totalExpenses,
        balance: totalIncome - totalExpenses,
        availableBalance, // Balance disponible después de restar la meta de ahorro
        goalCents: goalCentsConverted,
        directedSavings, // Ahorro dirigido (transferencias a cuentas de ahorro)
        expensesByCategory: expensesByCat.slice(0, 5), // Top 5
        transactionCount: transactions.length
      });

      if (goal) {
        // El ahorro es solo lo que se transfirió a cuentas de ahorro, no el balance
        const saved = directedSavings;
        const goalProgress = goal.savingGoalCents > 0 
          ? Math.min(100, Math.round((saved / goal.savingGoalCents) * 100))
          : 0;
        setGoalData({
          ...goal,
          saved,
          progress: goalProgress,
          remaining: Math.max(0, goal.savingGoalCents - saved)
        });
      } else {
        setGoalData(null);
      }

      // Preparar datos para gráficos (convertir todas las monedas)
      const historicalTransactions = historicalRes.data.transactions || [];
      const monthlyTrends: { [key: string]: { income: number; expense: number } } = {};
      
      historicalTransactions.forEach((tx: any) => {
        const txDate = new Date(tx.occurredAt);
        const monthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, "0")}`;
        if (!monthlyTrends[monthKey]) {
          monthlyTrends[monthKey] = { income: 0, expense: 0 };
        }
        const convertedAmount = convertToBase(tx.amountCents, tx.currencyCode || baseCurrency);
        if (tx.type === "INCOME") {
          monthlyTrends[monthKey].income += convertedAmount;
        } else if (tx.type === "EXPENSE") {
          monthlyTrends[monthKey].expense += convertedAmount;
        }
      });

      const chartDataArray = Object.keys(monthlyTrends)
        .sort()
        .map(key => ({
          month: key,
          Ingresos: monthlyTrends[key].income / 100,
          Gastos: monthlyTrends[key].expense / 100,
          Balance: (monthlyTrends[key].income - monthlyTrends[key].expense) / 100
        }));
      
      setChartData(chartDataArray);

      // Calcular datos del día (SIEMPRE, no solo si es el mes actual)
      const todayStr = today.toISOString().slice(0, 10);
      
      // Calcular gasto acumulado del día (convertido a moneda base)
      const todayTransactions = await api.get(`/transactions?from=${todayStr}&to=${todayStr}&pageSize=100`);
      const todayExpenses = (todayTransactions.data.transactions || [])
        .filter((t: any) => t.type === "EXPENSE")
        .reduce((sum: number, t: any) => sum + convertToBase(t.amountCents, t.currencyCode || baseCurrency), 0);
      
      // Calcular presupuesto del día usando los mismos datos convertidos que el promedio diario
      // Reutilizar availableBalance ya calculado arriba
      const remainingDays = data.startOfDay.remainingDaysIncludingToday;
      const dailyBudgetCents = remainingDays > 0 ? Math.floor(availableBalance / remainingDays) : 0;
      const remainingTodayCents = availableBalance - todayExpenses;
      
      setDailyData({
        spentToday: todayExpenses,
        dailyBudget: dailyBudgetCents,
        remainingToday: remainingTodayCents,
        dailyTarget: dailyBudgetCents
      });

      // Cargar datos del mes pasado para comparación (solo si es el mes actual)
      if (isCurrentMonth) {
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        const prevMonthStart = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
        const prevMonthEnd = `${prevYear}-${String(prevMonth).padStart(2, "0")}-${new Date(prevYear, prevMonth, 0).getDate()}`;
        
        // Obtener el día del mes pasado equivalente (mismo día del mes)
        const currentDay = today.getDate();
        const prevMonthDay = Math.min(currentDay, new Date(prevYear, prevMonth, 0).getDate());
        const prevMonthDateStr = `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(prevMonthDay).padStart(2, "0")}`;
        
        try {
          const prevMonthTransactions = await api.get(`/transactions?from=${prevMonthStart}&to=${prevMonthEnd}&pageSize=500`);
          const prevMonthExpenses = (prevMonthTransactions.data.transactions || [])
            .filter((t: any) => {
              const txDate = new Date(t.occurredAt);
              return txDate.getDate() <= prevMonthDay && t.type === "EXPENSE";
            })
            .reduce((sum: number, t: any) => sum + convertToBase(t.amountCents, t.currencyCode || baseCurrency), 0);
          
          setPreviousMonthData({
            spentUpToSameDay: prevMonthExpenses,
            month: prevMonth,
            year: prevYear
          });
        } catch (err) {
          console.error("Error loading previous month data:", err);
          setPreviousMonthData(null);
        }
      } else {
        setPreviousMonthData(null);
      }

      // Cargar transacciones recurrentes pendientes del mes actual
      try {
        const recurringRes = await api.get(`/transactions?isRecurring=true&from=${monthStart}&to=${monthEnd}&pageSize=100`);
        const allRecurring = recurringRes.data.transactions || [];
        
        // Filtrar las que no están pagadas en el mes actual
        const paidThisMonth = new Set(
          transactions
            .filter((t: any) => t.isRecurring && t.isPaid)
            .map((t: any) => t.recurringRule || t.id)
        );
        
        const pending = allRecurring.filter((tx: any) => {
          // Verificar si ya fue pagada este mes
          const txKey = tx.recurringRule || tx.id;
          if (paidThisMonth.has(txKey)) return false;
          
          // Verificar si tiene ocurrencias restantes
          if (tx.remainingOccurrences !== null && tx.remainingOccurrences <= 0) return false;
          
          // Verificar si la próxima ocurrencia es en el mes actual o ya pasó
          if (tx.nextOccurrence) {
            const nextDate = new Date(tx.nextOccurrence);
            const monthStartDate = new Date(monthStart);
            const monthEndDate = new Date(monthEnd);
            return nextDate >= monthStartDate && nextDate <= monthEndDate;
          }
          
          return true;
        });
        
        setPendingRecurring(pending);
      } catch (err) {
        console.error("Error loading pending recurring:", err);
        setPendingRecurring([]);
      }

      const a = await api.get(`/alerts/preview?date=${dateStr}`);
      // setAlerts(a.data.alerts);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Error al cargar los datos");
      if (err?.response?.status === 401) {
        logout();
        router.push("/login");
      }
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  if (loading) {
    return (
      <div style={{ 
        minHeight: "100vh", 
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
      }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{
            background: "white",
            borderRadius: "20px",
            margin: "20px",
            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)"
          }}>
            <DashboardSkeleton />
          </div>
        </div>
      </div>
    );
  }

  const [year, month] = selectedDate.split("-").map(Number);
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  return (
    <div style={{ 
      minHeight: "100vh",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      padding: isMobile ? "12px" : "20px"
    }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{
          background: "white",
          borderRadius: isMobile ? "16px" : "20px",
          padding: isMobile ? "16px" : "24px 32px",
          marginBottom: isMobile ? "16px" : "24px",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px"
        }}>
          <div>
            <h1 style={{
              fontSize: isMobile ? "22px" : "28px",
              fontWeight: "700",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              marginBottom: "4px"
            }}>
              Dashboard Mensual
            </h1>
            <p style={{ color: "#666", fontSize: isMobile ? "12px" : "14px" }}>{user.email}</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
              <input
                type="month"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  padding: isMobile ? "12px 14px" : "10px 16px",
                  border: "2px solid #e0e0e0",
                  borderRadius: "8px",
                  fontSize: "16px",
                  fontWeight: "600",
                  background: "white",
                  minHeight: isMobile ? "48px" : "auto",
                  flex: isMobile ? "1" : "none"
                }}
              />
              {!isMobile && (
                <div style={{ 
                  padding: "8px 12px", 
                  background: "linear-gradient(135deg, #f0f0f0 0%, #e8e8e8 100%)", 
                  borderRadius: "8px", 
                  fontSize: "12px", 
                  color: "#666",
                  border: "1px solid #d0d0d0",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
                }}>
                  🔍 Presiona Ctrl+K para buscar
                </div>
              )}
            </div>
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(auto-fit, minmax(140px, 1fr))", 
              gap: isMobile ? "8px" : "8px",
              width: "100%"
            }}>
              <Link href="/transactions/new" style={{ textDecoration: "none" }}>
                <button style={{
                  padding: "12px 16px",
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "10px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(102, 126, 234, 0.4)",
                  transition: "all 0.2s",
                  width: "100%"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 6px 16px rgba(102, 126, 234, 0.5)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(102, 126, 234, 0.4)";
                }}>
                  ➕ Nueva Transacción
                </button>
              </Link>
              <Link href="/transactions" style={{ textDecoration: "none" }}>
                <button style={{
                  padding: "12px 16px",
                  background: "white",
                  color: "#333",
                  border: "2px solid #e0e0e0",
                  borderRadius: "10px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                  transition: "all 0.2s",
                  width: "100%"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#667eea";
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.12)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e0e0e0";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.08)";
                }}>
                  📋 Transacciones
                </button>
              </Link>
              <Link href="/statistics" style={{ textDecoration: "none" }}>
                <button style={{
                  padding: "12px 16px",
                  background: "white",
                  color: "#333",
                  border: "2px solid #e0e0e0",
                  borderRadius: "10px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                  transition: "all 0.2s",
                  width: "100%"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#667eea";
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.12)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e0e0e0";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.08)";
                }}>
                  📊 Estadísticas
                </button>
              </Link>
              <Link href="/savings" style={{ textDecoration: "none" }}>
                <button style={{
                  padding: "12px 16px",
                  background: "white",
                  color: "#333",
                  border: "2px solid #e0e0e0",
                  borderRadius: "10px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                  transition: "all 0.2s",
                  width: "100%"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#667eea";
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.12)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e0e0e0";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.08)";
                }}>
                  💰 Ahorros
                </button>
              </Link>
              <Link href="/categories" style={{ textDecoration: "none" }}>
                <button style={{
                  padding: "12px 16px",
                  background: "white",
                  color: "#333",
                  border: "2px solid #e0e0e0",
                  borderRadius: "10px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                  transition: "all 0.2s",
                  width: "100%"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#667eea";
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.12)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e0e0e0";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.08)";
                }}>
                  🏷️ Categorías
                </button>
              </Link>
              <Link href="/debts" style={{ textDecoration: "none" }}>
                <button style={{
                  padding: "12px 16px",
                  background: "white",
                  color: "#333",
                  border: "2px solid #e0e0e0",
                  borderRadius: "10px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                  transition: "all 0.2s",
                  width: "100%"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#667eea";
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.12)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e0e0e0";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.08)";
                }}>
                  💳 Deudas
                </button>
              </Link>
              <Link href="/recurring" style={{ textDecoration: "none" }}>
                <button style={{
                  padding: "12px 16px",
                  background: "white",
                  color: "#333",
                  border: "2px solid #e0e0e0",
                  borderRadius: "10px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                  transition: "all 0.2s",
                  width: "100%"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#667eea";
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.12)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e0e0e0";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.08)";
                }}>
                  🔄 Recurrentes
                </button>
              </Link>
              <button
                onClick={() => { logout(); router.push("/login"); }}
                style={{
                  padding: "12px 16px",
                  background: "white",
                  color: "#e74c3c",
                  border: "2px solid #e74c3c",
                  borderRadius: "10px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                  transition: "all 0.2s",
                  width: "100%"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#e74c3c";
                  e.currentTarget.style.color = "white";
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(231, 76, 60, 0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "white";
                  e.currentTarget.style.color = "#e74c3c";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.08)";
                }}
              >
                🚪 Salir
              </button>
            </div>
          </div>
        </div>

        {/* Resumen del Día (siempre visible) */}
        {dailyData !== null && (
          <div style={{
            display: "grid",
            gap: isMobile ? "12px" : "20px",
            gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(auto-fit, minmax(220px, 1fr))",
            marginBottom: isMobile ? "16px" : "24px"
          }}>
            <div style={{
              background: "white",
              borderRadius: isMobile ? "12px" : "16px",
              padding: isMobile ? "16px" : "24px",
              boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)",
              borderLeft: "4px solid #e74c3c"
            }}>
              <div style={{ color: "#666", fontSize: isMobile ? "12px" : "14px", marginBottom: "8px", fontWeight: "600" }}>
                Gasto Acumulado del Día
              </div>
              <div style={{ fontSize: isMobile ? "24px" : "32px", fontWeight: "700", color: "#e74c3c", marginBottom: "8px" }}>
                {fmtMoney(dailyData.spentToday, user.currencyCode)}
              </div>
              <div style={{ color: "#999", fontSize: "12px" }}>
                {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
              </div>
            </div>

            <div style={{
              background: "white",
              borderRadius: isMobile ? "12px" : "16px",
              padding: isMobile ? "16px" : "24px",
              boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)",
              borderLeft: "4px solid #667eea"
            }}>
              <div style={{ color: "#666", fontSize: isMobile ? "12px" : "14px", marginBottom: "8px", fontWeight: "600" }}>
                Presupuesto del Día
              </div>
              <div style={{ fontSize: isMobile ? "24px" : "32px", fontWeight: "700", color: "#667eea", marginBottom: "8px" }}>
                {fmtMoney(dailyData.dailyBudget, user.currencyCode)}
              </div>
              <div style={{ color: "#999", fontSize: "12px" }}>
                {dailyData.dailyBudget > 0 
                  ? `${Math.round((dailyData.spentToday / dailyData.dailyBudget) * 100)}% utilizado`
                  : "Sin presupuesto"}
              </div>
            </div>

            <div style={{
              background: "white",
              borderRadius: isMobile ? "12px" : "16px",
              padding: isMobile ? "16px" : "24px",
              boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)",
              borderLeft: "4px solid #27ae60"
            }}>
              <div style={{ color: "#666", fontSize: isMobile ? "12px" : "14px", marginBottom: "8px", fontWeight: "600" }}>
                Restante del Día
              </div>
              <div style={{ 
                fontSize: isMobile ? "24px" : "32px", 
                fontWeight: "700", 
                color: dailyData.remainingToday >= 0 ? "#27ae60" : "#e74c3c", 
                marginBottom: "8px" 
              }}>
                {fmtMoney(dailyData.remainingToday, user.currencyCode)}
              </div>
              <div style={{ color: "#999", fontSize: "12px" }}>
                {dailyData.remainingToday >= 0 ? "Disponible" : "Excedido"}
              </div>
            </div>

            {previousMonthData && (
              <div style={{
                background: "white",
                borderRadius: "16px",
                padding: "24px",
                boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)",
                borderLeft: "4px solid #f39c12"
              }}>
                <div style={{ color: "#666", fontSize: "14px", marginBottom: "8px", fontWeight: "600" }}>
                  Comparativo Mes Pasado
                </div>
                <div style={{ fontSize: "32px", fontWeight: "700", color: "#f39c12", marginBottom: "8px" }}>
                  {fmtMoney(previousMonthData.spentUpToSameDay, user.currencyCode)}
                </div>
                <div style={{ color: "#999", fontSize: "12px", marginBottom: "4px" }}>
                  {monthNames[previousMonthData.month - 1]} {previousMonthData.year}
                </div>
                <div style={{ 
                  fontSize: "12px", 
                  color: dailyData.spentToday > previousMonthData.spentUpToSameDay ? "#e74c3c" : "#27ae60",
                  fontWeight: "600"
                }}>
                  {dailyData.spentToday > previousMonthData.spentUpToSameDay 
                    ? `↑ ${fmtMoney(dailyData.spentToday - previousMonthData.spentUpToSameDay, user.currencyCode)} más`
                    : `↓ ${fmtMoney(previousMonthData.spentUpToSameDay - dailyData.spentToday, user.currencyCode)} menos`}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Transacciones Recurrentes Pendientes */}
        {pendingRecurring.length > 0 && (
          <div style={{
            background: "white",
            borderRadius: "16px",
            padding: "24px",
            marginBottom: "24px",
            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)"
          }}>
            <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "16px", color: "#333" }}>
              🔄 Pendientes Recurrentes del Mes
            </h3>
            <div style={{ display: "grid", gap: "12px" }}>
              {pendingRecurring.map((tx: any) => (
                <div key={tx.id} style={{
                  padding: "16px",
                  background: "#f8f9fa",
                  borderRadius: "12px",
                  border: "1px solid #e0e0e0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px"
                }}>
                  <div style={{ flex: 1, minWidth: "200px" }}>
                    <div style={{ fontWeight: "600", color: "#333", marginBottom: "4px" }}>
                      {tx.description || "Sin descripción"}
                    </div>
                    <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>
                      {tx.category?.name || "Sin categoría"}
                    </div>
                    <div style={{ fontSize: "12px", color: "#999" }}>
                      {tx.nextOccurrence 
                        ? `Próxima: ${new Date(tx.nextOccurrence).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`
                        : "Sin fecha programada"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", marginRight: "12px" }}>
                    <div style={{ fontSize: "18px", fontWeight: "700", color: tx.type === "INCOME" ? "#27ae60" : "#e74c3c", marginBottom: "4px" }}>
                      {tx.type === "INCOME" ? "+" : "-"}{fmtMoney(tx.amountCents, tx.currencyCode || user.currencyCode)}
                    </div>
                    {tx.remainingOccurrences !== null && (
                      <div style={{ fontSize: "11px", color: "#999" }}>
                        {tx.remainingOccurrences} restantes
                      </div>
                    )}
                  </div>
                  <Link 
                    href={`/transactions/new?recurring=${tx.id}&category=${tx.categoryId}&type=${tx.type}&amount=${tx.amountCents}&currency=${tx.currencyCode || user.currencyCode}&description=${encodeURIComponent(tx.description || "")}`}
                    style={{ textDecoration: "none" }}
                  >
                    <button style={{
                      padding: "10px 20px",
                      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: "600",
                      cursor: "pointer",
                      boxShadow: "0 2px 6px rgba(102, 126, 234, 0.3)",
                      transition: "all 0.2s"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(102, 126, 234, 0.4)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 2px 6px rgba(102, 126, 234, 0.3)";
                    }}>
                      Crear Transacción
                    </button>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resumen del Mes */}
        <div style={{
          display: "grid",
          gap: "20px",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          marginBottom: "24px"
        }}>
          <div style={{
            background: "white",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)"
          }}>
            <div style={{ color: "#666", fontSize: "14px", marginBottom: "8px", fontWeight: "600" }}>
              Ingresos del Mes
            </div>
            <div style={{ fontSize: "32px", fontWeight: "700", color: "#27ae60", marginBottom: "8px" }}>
              {monthlyData ? fmtMoney(monthlyData.totalIncome, user.currencyCode) : "..."}
            </div>
            <div style={{ color: "#999", fontSize: "12px" }}>
              {monthNames[month - 1]} {year}
            </div>
          </div>

          <div style={{
            background: "white",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)"
          }}>
            <div style={{ color: "#666", fontSize: "14px", marginBottom: "8px", fontWeight: "600" }}>
              Gastos del Mes
            </div>
            <div style={{ fontSize: "32px", fontWeight: "700", color: "#e74c3c", marginBottom: "8px" }}>
              {monthlyData ? fmtMoney(monthlyData.totalExpenses, user.currencyCode) : "..."}
            </div>
            <div style={{ color: "#999", fontSize: "12px" }}>
              {monthlyData?.transactionCount || 0} transacciones
            </div>
          </div>

          <div style={{
            background: "white",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)"
          }}>
            <div style={{ color: "#666", fontSize: "14px", marginBottom: "8px", fontWeight: "600" }}>
              Balance del Mes
            </div>
            <div style={{ 
              fontSize: "32px", 
              fontWeight: "700", 
              color: monthlyData && monthlyData.balance >= 0 ? "#27ae60" : "#e74c3c", 
              marginBottom: "8px" 
            }}>
              {monthlyData ? fmtMoney(monthlyData.balance, user.currencyCode) : "..."}
            </div>
            <div style={{ color: "#999", fontSize: "12px" }}>
              {monthlyData && monthlyData.totalIncome > 0 
                ? `${Math.round((monthlyData.balance / monthlyData.totalIncome) * 100)}% de ahorro`
                : "Sin ingresos"}
            </div>
          </div>

          <div style={{
            background: "white",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)"
          }}>
            <div style={{ color: "#666", fontSize: "14px", marginBottom: "8px", fontWeight: "600" }}>
              Presupuesto Diario Restante
            </div>
            <div style={{ fontSize: "32px", fontWeight: "700", color: "#667eea", marginBottom: "8px" }}>
              {(() => {
                if (!monthlyData || !data) return "...";
                
                // Calcular: (Ingresos - Ahorros - Gastos) / días restantes
                const availableBalance = monthlyData.availableBalance !== undefined 
                  ? monthlyData.availableBalance 
                  : (monthlyData.totalIncome - monthlyData.totalExpenses - (monthlyData.goalCents || 0));
                
                const remainingDays = data.startOfDay?.remainingDaysIncludingToday || 0;
                
                if (remainingDays <= 0) {
                  return fmtMoney(0, user.currencyCode);
                }
                
                const dailyBudget = Math.floor(availableBalance / remainingDays);
                return fmtMoney(dailyBudget, user.currencyCode);
              })()}
            </div>
            <div style={{ color: "#999", fontSize: "12px" }}>
              {data?.startOfDay?.remainingDaysIncludingToday 
                ? `${data.startOfDay.remainingDaysIncludingToday} días restantes`
                : "Calculando..."}
            </div>
          </div>
        </div>

        {/* Meta de Ahorro */}
        {goalData && (
          <div style={{
            background: "white",
            borderRadius: "16px",
            padding: "24px",
            marginBottom: "24px",
            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)"
          }}>
            <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "16px", color: "#333" }}>
              Meta de Ahorro del Mes
            </h3>
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "14px", color: "#666" }}>Progreso</span>
                <span style={{ fontSize: "14px", fontWeight: "600", color: goalData.progress >= 100 ? "#27ae60" : "#667eea" }}>
                  {goalData.progress}%
                </span>
              </div>
              <div style={{
                width: "100%",
                height: "20px",
                background: "#e0e0e0",
                borderRadius: "10px",
                overflow: "hidden",
                position: "relative"
              }}>
                <div style={{
                  width: `${Math.min(100, goalData.progress)}%`,
                  height: "100%",
                  background: goalData.progress >= 100 
                    ? "linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)"
                    : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  transition: "width 0.3s",
                  borderRadius: goalData.progress >= 100 ? "10px" : "10px 0 0 10px"
                }} />
                {goalData.progress < 100 && (
                  <div style={{
                    position: "absolute",
                    right: "8px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: "10px",
                    fontWeight: "600",
                    color: "#666"
                  }}>
                    {fmtMoney(goalData.remaining, user.currencyCode)} restante
                  </div>
                )}
              </div>
            </div>
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(3, 1fr)", 
              gap: "16px",
              marginTop: "16px"
            }}>
              <div>
                <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>Meta</div>
                <div style={{ fontSize: "18px", fontWeight: "700", color: "#333" }}>
                  {fmtMoney(goalData.savingGoalCents, user.currencyCode)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>Ahorrado</div>
                <div style={{ fontSize: "18px", fontWeight: "700", color: "#27ae60" }}>
                  {fmtMoney(goalData.saved, user.currencyCode)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>Restante</div>
                <div style={{ fontSize: "18px", fontWeight: "700", color: goalData.remaining > 0 ? "#e74c3c" : "#27ae60" }}>
                  {fmtMoney(goalData.remaining, user.currencyCode)}
                </div>
              </div>
            </div>
            {goalData.progress >= 100 && (
              <div style={{
                marginTop: "16px",
                padding: "12px",
                background: "#d4edda",
                borderRadius: "8px",
                textAlign: "center"
              }}>
                <span style={{ color: "#155724", fontWeight: "600" }}>🎉 ¡Meta alcanzada!</span>
              </div>
            )}
          </div>
        )}

        {/* Gráficos Interactivos */}
        {chartData.length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
            gap: "24px",
            marginBottom: "24px"
          }}>
            {/* Gráfico de Tendencias */}
            <div style={{
              background: "white",
              borderRadius: "16px",
              padding: "24px",
              boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)"
            }}>
              <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "16px", color: "#333" }}>
                Tendencias (Últimos 6 Meses)
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis 
                    dataKey="month" 
                    stroke="#666"
                    style={{ fontSize: "12px" }}
                    tickFormatter={(value) => {
                      const [y, m] = value.split("-");
                      return `${m}/${y.slice(2)}`;
                    }}
                  />
                  <YAxis 
                    stroke="#666"
                    style={{ fontSize: "12px" }}
                    tickFormatter={(value) => fmtMoney(value * 100, user.currencyCode)}
                  />
                  <Tooltip 
                    formatter={(value: number) => fmtMoney(value * 100, user.currencyCode)}
                    labelFormatter={(label) => `Mes: ${label}`}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e0e0e0" }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="Ingresos" 
                    stroke="#27ae60" 
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="Ingresos"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Gastos" 
                    stroke="#e74c3c" 
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="Gastos"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Balance" 
                    stroke="#667eea" 
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="Balance"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Gráfico de Barras - Comparación Mensual */}
            <div style={{
              background: "white",
              borderRadius: "16px",
              padding: "24px",
              boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)"
            }}>
              <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "16px", color: "#333" }}>
                Comparación Mensual
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis 
                    dataKey="month" 
                    stroke="#666"
                    style={{ fontSize: "12px" }}
                    tickFormatter={(value) => {
                      const [y, m] = value.split("-");
                      return `${m}/${y.slice(2)}`;
                    }}
                  />
                  <YAxis 
                    stroke="#666"
                    style={{ fontSize: "12px" }}
                    tickFormatter={(value) => fmtMoney(value * 100, user.currencyCode)}
                  />
                  <Tooltip 
                    formatter={(value: number) => fmtMoney(value * 100, user.currencyCode)}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e0e0e0" }}
                  />
                  <Legend />
                  <Bar dataKey="Ingresos" fill="#27ae60" name="Ingresos" />
                  <Bar dataKey="Gastos" fill="#e74c3c" name="Gastos" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Gráfico de Pie - Distribución de Gastos */}
        {monthlyData && monthlyData.expensesByCategory.length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
            gap: "24px",
            marginBottom: "24px"
          }}>
            <div style={{
              background: "white",
              borderRadius: "16px",
              padding: "24px",
              boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)"
            }}>
              <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "16px", color: "#333" }}>
                Distribución de Gastos por Categoría
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={monthlyData.expensesByCategory.map((cat: any) => ({
                      name: cat.categoryName,
                      value: cat.amountCents / 100
                    }))}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }: any) => `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {monthlyData.expensesByCategory.map((_: any, index: number) => {
                      const colors = ["#667eea", "#764ba2", "#f093fb", "#4facfe", "#43e97b", "#fa709a"];
                      return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                    })}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => fmtMoney(value * 100, user.currencyCode)}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e0e0e0" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Top Gastos por Categoría */}
            <div style={{
              background: "white",
              borderRadius: "16px",
              padding: "24px",
              boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)"
            }}>
              <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "16px", color: "#333" }}>
                Top Gastos por Categoría
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {monthlyData.expensesByCategory.map((cat: any, i: number) => {
                  const percentage = monthlyData.totalExpenses > 0 
                    ? (cat.amountCents / monthlyData.totalExpenses) * 100 
                    : 0;
                  return (
                    <div key={i} style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "16px",
                      padding: "12px",
                      background: "#f8f9fa",
                      borderRadius: "8px"
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: "600", color: "#333", marginBottom: "4px" }}>
                          {cat.categoryName}
                        </div>
                        <div style={{ fontSize: "12px", color: "#666" }}>
                          {cat.count} transacción{cat.count !== 1 ? "es" : ""}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: "700", color: "#e74c3c", marginBottom: "4px" }}>
                          {fmtMoney(cat.amountCents, user.currencyCode)}
                        </div>
                        <div style={{ fontSize: "12px", color: "#999" }}>
                          {Math.round(percentage)}%
                        </div>
                      </div>
                      <div style={{
                        width: "100px",
                        height: "8px",
                        background: "#e0e0e0",
                        borderRadius: "4px",
                        overflow: "hidden"
                      }}>
                        <div style={{
                          width: `${percentage}%`,
                          height: "100%",
                          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                          transition: "width 0.3s"
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Acciones Rápidas */}
        <div style={{
          background: "white",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)"
        }}>
          <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "16px", color: "#333" }}>
            Acciones Rápidas
          </h3>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <Link href="/transactions/new">
              <button style={{
                padding: "12px 24px",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer"
              }}>
                Nueva Transacción
              </button>
            </Link>
            <Link href="/accounts">
              <button style={{
                padding: "12px 24px",
                background: "#f0f0f0",
                color: "#333",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer"
              }}>
                Gestionar Cuentas
              </button>
            </Link>
            <Link href="/statistics">
              <button style={{
                padding: "12px 24px",
                background: "#f0f0f0",
                color: "#333",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer"
              }}>
                Ver Estadísticas
              </button>
            </Link>
            <Link href="/savings">
              <button style={{
                padding: "12px 24px",
                background: "#f0f0f0",
                color: "#333",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer"
              }}>
                Ahorros
              </button>
            </Link>
            <Link href="/transactions">
              <button style={{
                padding: "12px 24px",
                background: "#f0f0f0",
                color: "#333",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer"
              }}>
                Historial
              </button>
            </Link>
            <a
              href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/export/csv?from=${selectedDate}-01&to=${selectedDate}-${new Date(year, month, 0).getDate()}`}
              target="_blank"
              style={{
                padding: "12px 24px",
                background: "#f0f0f0",
                color: "#333",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
                textDecoration: "none",
                display: "inline-block"
              }}
            >
              Exportar CSV
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
