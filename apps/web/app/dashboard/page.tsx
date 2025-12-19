"use client";
import { useEffect, useState, useCallback, useRef } from "react";
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
  const [activeLimitAlerts, setActiveLimitAlerts] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0); // Key para forzar recarga
  const loadingRef = useRef(false); // Flag para prevenir llamadas duplicadas
  
  // Estados para atajo rápido
  const [quickAmount, setQuickAmount] = useState("");
  const [showQuickConfirm, setShowQuickConfirm] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [defaultAccount, setDefaultAccount] = useState<any>(null);
  const [defaultCategory, setDefaultCategory] = useState<any>(null);
  const [creatingQuickTx, setCreatingQuickTx] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [savingConfig, setSavingConfig] = useState(false);

  // Memoizar loadData para evitar recreaciones innecesarias y cumplir con reglas de hooks
  const loadData = useCallback(async () => {
    // Prevenir llamadas concurrentes
    if (loadingRef.current) {
      return;
    }
    loadingRef.current = true;
    setLoading(true);
    setError(undefined);
        try {
          const [year, month] = selectedDate.split("-").map(Number);
          // Usar el día actual del mes seleccionado, o el último día si ya pasó
          const today = new Date();
          const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
          const dayOfMonth = isCurrentMonth ? today.getDate() : new Date(year, month, 0).getDate();
          const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`;
      
      // Usar catch para manejar 401 sin romper el flujo
      const res = await api.get(`/budget/summary?date=${dateStr}`).catch((err) => {
        if (err?.response?.status === 401) {
          // Si es 401, intentar recargar el token o redirigir
          logout();
          router.push("/login");
          throw err;
        }
        throw err;
      });
      setData(res.data.data);

      // Cargar datos mensuales
      const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
      const monthEnd = `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}`;
      
      // OPTIMIZACIÓN: Cargar datos esenciales primero, datos históricos después (lazy loading)
      const [transactionsRes, statsRes, goalsRes] = await Promise.all([
        api.get(`/transactions?from=${monthStart}&to=${monthEnd}&pageSize=100`),
        api.get(`/statistics/expenses-by-category?year=${year}&month=${month}&period=month`),
        api.get(`/goals?year=${year}&month=${month}`).catch(() => ({ data: { goal: null } }))
      ]);
      
      // Cargar datos históricos en paralelo pero no bloquear la renderización inicial
      const historicalPromise = (async () => {
        const sixMonthsAgo = new Date(year, month - 6, 1);
        const historicalStart = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, "0")}-01`;
        try {
          const historicalRes = await api.get(`/transactions?from=${historicalStart}&to=${monthEnd}&pageSize=500`);
          return historicalRes.data.transactions || [];
        } catch {
          return [];
        }
      })();

      const transactions = transactionsRes.data.transactions || [];
      
      // OPTIMIZACIÓN: Obtener tipo de cambio en paralelo con otras operaciones
      const DEFAULT_USD_UYU_RATE = 42.0; // Actualizado Nov 2025
      const exchangeRatePromise = api.get("/exchange/rate").catch((err) => {
        console.warn("Error obteniendo tipo de cambio, usando fallback:", err?.message);
        return { data: { rate: DEFAULT_USD_UYU_RATE } };
      });
      
      // Cargar cuentas y tipo de cambio en paralelo
      const [accountsRes, exchangeRateRes] = await Promise.all([
        api.get("/accounts").catch(() => ({ data: { accounts: [] } })),
        exchangeRatePromise
      ]);
      
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
        .filter((t: any) => t.type === "INCOME" && !t.transferId) // Excluir transferencias
        .reduce((sum: number, t: any) => sum + convertToBase(t.amountCents, t.currencyCode || baseCurrency), 0);
      const totalExpenses = transactions
        .filter((t: any) => t.type === "EXPENSE" && !t.transferId) // Excluir transferencias
        .reduce((sum: number, t: any) => sum + convertToBase(t.amountCents, t.currencyCode || baseCurrency), 0);
      
      // Calcular ahorro dirigido: transferencias a cuentas de tipo SAVINGS o ingresos directos a cuentas SAVINGS
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

      // OPTIMIZACIÓN: Cargar datos históricos para gráficos de forma lazy (no bloquea renderización)
      historicalPromise.then((historicalTransactions) => {
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
      }).catch((err) => {
        console.error("Error loading historical data for charts:", err);
        setChartData([]);
      });

      // Calcular datos del día (SIEMPRE, no solo si es el mes actual)
      const todayStr = today.toISOString().slice(0, 10);
      
      // OPTIMIZACIÓN: Calcular gasto del día en paralelo con otras operaciones
      // Si no hay transacciones del mes, probablemente tampoco hay del día
      const todayExpensesPromise = transactions.length > 0
        ? api.get(`/transactions?from=${todayStr}&to=${todayStr}&pageSize=100`)
            .then((res: any) => {
              const todayTx = res.data.transactions || [];
              return todayTx
                .filter((t: any) => t.type === "EXPENSE" && !t.transferId)
                .reduce((sum: number, t: any) => sum + convertToBase(t.amountCents, t.currencyCode || baseCurrency), 0);
            })
            .catch(() => 0)
        : Promise.resolve(0);
      
      // Esperar solo lo esencial para mostrar datos iniciales
      const todayExpenses = await todayExpensesPromise;
      
      // Calcular presupuesto usando datos del backend (budget service)
      // El backend ya calcula todo correctamente con conversión de moneda
      const dailyBudgetCents = data?.startOfDay?.dailyTargetCents || 0;
      // Presupuesto Diario Restante = presupuesto diario de hoy - gastos de hoy
      // El backend calcula rolloverFromTodayCents = max(dailyTargetTodayStartCents - spentTodayCents, 0)
      // Pero si es 0 porque se gastó más de lo asignado, debemos mostrar el valor negativo
      // Por eso calculamos directamente: dailyBudgetCents - todayExpenses (puede ser negativo)
      const rolloverCents = data?.endOfDay?.rolloverFromTodayCents;
      // Si rolloverCents es 0 pero dailyBudgetCents > 0 y todayExpenses < dailyBudgetCents,
      // entonces el backend calculó mal o hay un problema. Usamos nuestro cálculo.
      const remainingTodayCents = (rolloverCents !== undefined && rolloverCents > 0) 
        ? rolloverCents 
        : dailyBudgetCents - todayExpenses; // Puede ser negativo
      const dailyTargetTomorrowCents = data?.endOfDay?.dailyTargetTomorrowCents || 0;
      
      // Determinar si hay presupuesto disponible (ingresos del mes o goal)
      // Usar las variables locales calculadas arriba, no monthlyData que aún no se ha actualizado
      const hasBudget = (totalIncome > 0) || (goalCentsConverted > 0) || (dailyBudgetCents > 0);
      
      setDailyData({
        spentToday: todayExpenses,
        dailyBudget: dailyBudgetCents,
        remainingToday: remainingTodayCents,
        dailyTarget: dailyBudgetCents,
        dailyTargetTomorrow: dailyTargetTomorrowCents,
        hasGoal: goalCentsConverted > 0,
        hasBudget: hasBudget
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

      // Cargar alertas activas de límites
      try {
        const alertsRes = await api.get(`/budgets/active-alerts?month=${monthStart}`);
        setActiveLimitAlerts(alertsRes.data.alerts || []);
      } catch (err) {
        console.error("Error loading active limit alerts:", err);
        setActiveLimitAlerts([]);
      }

      // Cargar cuentas y categorías para atajo rápido
      try {
        const [accountsRes, categoriesRes, userRes] = await Promise.all([
          api.get("/accounts"),
          api.get("/categories?tree=true"),
          api.get("/auth/me")
        ]);
        const accountsList = accountsRes.data.accounts || [];
        const categoriesList = categoriesRes.data.flat || [];
        setAccounts(accountsList);
        setCategories(categoriesList);
        
        // Configurar cuenta y categoría predeterminadas
        const userData = userRes.data.user;
        if (userData?.defaultAccountId) {
          const acc = accountsList.find((a: any) => a.id === userData.defaultAccountId);
          setDefaultAccount(acc || null);
          setSelectedAccountId(userData.defaultAccountId);
        } else if (accountsList.length > 0) {
          setDefaultAccount(accountsList[0]);
          setSelectedAccountId(accountsList[0].id);
        }
        
        if (userData?.defaultCategoryId) {
          // Buscar en todas las categorías (padres e hijas)
          const findCategory = (cats: any[], id: string): any => {
            for (const cat of cats) {
              if (cat.id === id) return cat;
              if (cat.children) {
                const found = findCategory(cat.children, id);
                if (found) return found;
              }
            }
            return null;
          };
          const cat = findCategory(categoriesList, userData.defaultCategoryId);
          setDefaultCategory(cat || null);
          setSelectedCategoryId(userData.defaultCategoryId);
        } else {
          // Buscar primera categoría de gasto
          const findFirstExpenseCategory = (cats: any[]): any => {
            for (const cat of cats) {
              if (cat.type === "EXPENSE") {
                // Si tiene hijos, usar el primer hijo, sino usar la categoría misma
                if (cat.children && cat.children.length > 0) {
                  return cat.children[0];
                }
                return cat;
              }
              if (cat.children) {
                const found = findFirstExpenseCategory(cat.children);
                if (found) return found;
              }
            }
            return null;
          };
          const firstExpense = findFirstExpenseCategory(categoriesList);
          setDefaultCategory(firstExpense);
          if (firstExpense) setSelectedCategoryId(firstExpense.id);
        }
      } catch (err) {
        console.error("Error loading accounts/categories for quick add:", err);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Error al cargar los datos");
      if (err?.response?.status === 401) {
        logout();
        router.push("/login");
      }
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [selectedDate, user, logout, router]); // Dependencias correctas de loadData

  // Funciones para atajo rápido
  const handleQuickSubmit = () => {
    const amount = parseFloat(quickAmount.replace(/[^\d.,]/g, "").replace(",", "."));
    if (!amount || amount <= 0) {
      alert("Por favor ingresa un monto válido");
      return;
    }
    if (!defaultAccount) {
      alert("Por favor configura una cuenta predeterminada en Configuración");
      return;
    }
    if (!defaultCategory) {
      alert("Por favor configura una categoría predeterminada en Configuración");
      return;
    }
    setShowQuickConfirm(true);
  };

  const handleQuickConfirm = async () => {
    if (!defaultAccount || !defaultCategory) return;
    
    setCreatingQuickTx(true);
    try {
      const amount = parseFloat(quickAmount.replace(/[^\d.,]/g, "").replace(",", "."));
      const amountCents = Math.round(amount * 100);
      
      await api.post("/transactions", {
        type: "EXPENSE",
        accountId: defaultAccount.id,
        categoryId: defaultCategory.id,
        amountCents,
        currencyCode: defaultAccount.currencyCode || user?.currencyCode || "UYU",
        occurredAt: new Date().toISOString(),
        description: `Gasto rápido - ${defaultCategory.name}`
      });
      
      setQuickAmount("");
      setShowQuickConfirm(false);
      // Recargar datos
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error || "Error al crear la transacción");
    } finally {
      setCreatingQuickTx(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!selectedAccountId || !selectedCategoryId) {
      alert("Por favor selecciona una cuenta y una categoría");
      return;
    }
    
    setSavingConfig(true);
    try {
      await api.put("/auth/prefs", {
        defaultAccountId: selectedAccountId,
        defaultCategoryId: selectedCategoryId
      });
      
      // Actualizar estado local
      const acc = accounts.find((a: any) => a.id === selectedAccountId);
      const findCategory = (cats: any[], id: string): any => {
        for (const cat of cats) {
          if (cat.id === id) return cat;
          if (cat.children) {
            const found = findCategory(cat.children, id);
            if (found) return found;
          }
        }
        return null;
      };
      const cat = findCategory(categories, selectedCategoryId);
      
      setDefaultAccount(acc || null);
      setDefaultCategory(cat || null);
      setShowConfigModal(false);
      
      // Recargar usuario para actualizar preferencias
      const userRes = await api.get("/auth/me");
      if (userRes.data.user) {
        // Actualizar estado de auth si es necesario
        initAuth();
      }
    } catch (err: any) {
      alert(err?.response?.data?.error || "Error al guardar configuración");
    } finally {
      setSavingConfig(false);
    }
  };

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
  }, [user, token, loadData]);

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
  }, [user, token, initialized, selectedDate, router, initAuth, refreshKey, loadData]);

  if (!user) return null;

  if (loading) {
    return (
      <div style={{ 
        minHeight: "100vh", 
        background: "var(--color-bg-primary, #FAFBFC)"
      }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{
            background: "var(--color-bg-white, #FFFFFF)",
            borderRadius: "20px",
            margin: "20px",
            boxShadow: "var(--shadow-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.1))"
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
      background: "var(--color-bg-primary, #FAFBFC)",
      padding: isMobile ? "12px" : "20px"
    }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{
          background: "var(--color-bg-white, #FFFFFF)",
          borderRadius: isMobile ? "16px" : "20px",
          padding: isMobile ? "16px" : "24px 32px",
          marginBottom: isMobile ? "16px" : "24px",
          boxShadow: "var(--shadow-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.1))",
          border: "1px solid var(--color-border-light, #F3F4F6)",
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
              color: "var(--color-primary, #4F46E5)",
              marginBottom: "4px",
              fontFamily: "'Inter', sans-serif"
            }}>
              Dashboard Mensual
            </h1>
            <p style={{ color: "var(--color-text-secondary, #6B7280)", fontSize: isMobile ? "12px" : "14px" }}>{user.email}</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
              <input
                type="month"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  padding: isMobile ? "12px 14px" : "10px 16px",
                  border: "1px solid var(--color-border, #E5E7EB)",
                  borderRadius: "8px",
                  fontSize: "16px",
                  fontWeight: "600",
                  background: "var(--color-bg-white, #FFFFFF)",
                  minHeight: isMobile ? "48px" : "auto",
                  flex: isMobile ? "1" : "none",
                  fontFamily: "'Inter', sans-serif",
                  color: "var(--color-text-primary, #111827)"
                }}
              />
              {!isMobile && (
                <div style={{ 
                  padding: "8px 12px", 
                  background: "linear-gradient(135deg, #f0f0f0 0%, #e8e8e8 100%)", 
                  borderRadius: "8px", 
                  fontSize: "12px", 
                  color: "var(--color-text-secondary, #6B7280)",
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
                  background: "var(--color-primary, #4F46E5)",
                  color: "white",
                  border: "none",
                  borderRadius: "10px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  boxShadow: "var(--shadow-md, 0 4px 6px -1px rgba(0, 0, 0, 0.1))",
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  width: "100%",
                  fontFamily: "'Inter', sans-serif"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.background = "var(--color-primary-hover, #4338CA)";
                  e.currentTarget.style.boxShadow = "var(--shadow-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.1))";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.background = "var(--color-primary, #4F46E5)";
                  e.currentTarget.style.boxShadow = "var(--shadow-md, 0 4px 6px -1px rgba(0, 0, 0, 0.1))";
                }}>
                  ➕ Nueva Transacción
                </button>
              </Link>
              <Link href="/transactions" style={{ textDecoration: "none" }}>
                <button style={{
                  padding: "12px 16px",
                  background: "var(--color-bg-white, #FFFFFF)",
                  color: "var(--color-text-primary, #111827)",
                  border: "1px solid var(--color-border, #E5E7EB)",
                  borderRadius: "10px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  boxShadow: "var(--shadow-sm, 0 1px 2px 0 rgba(0, 0, 0, 0.05))",
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  width: "100%",
                  fontFamily: "'Inter', sans-serif"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-primary, #4F46E5)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "var(--shadow-md, 0 4px 6px -1px rgba(0, 0, 0, 0.1))";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-border, #E5E7EB)";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "var(--shadow-sm, 0 1px 2px 0 rgba(0, 0, 0, 0.05))";
                }}>
                  📋 Transacciones
                </button>
              </Link>
              <Link href="/statistics" style={{ textDecoration: "none" }}>
                <button style={{
                  padding: "12px 16px",
                  background: "var(--color-bg-white, #FFFFFF)",
                  color: "var(--color-text-primary, #111827)",
                  border: "1px solid var(--color-border, #E5E7EB)",
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
                  e.currentTarget.style.borderColor = "var(--color-border, #E5E7EB)";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.08)";
                }}>
                  📊 Estadísticas
                </button>
              </Link>
              <Link href="/savings" style={{ textDecoration: "none" }}>
                <button style={{
                  padding: "12px 16px",
                  background: "var(--color-bg-white, #FFFFFF)",
                  color: "var(--color-text-primary, #111827)",
                  border: "1px solid var(--color-border, #E5E7EB)",
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
                  e.currentTarget.style.borderColor = "var(--color-border, #E5E7EB)";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.08)";
                }}>
                  💰 Ahorros
                </button>
              </Link>
              <Link href="/categories" style={{ textDecoration: "none" }}>
                <button style={{
                  padding: "12px 16px",
                  background: "var(--color-bg-white, #FFFFFF)",
                  color: "var(--color-text-primary, #111827)",
                  border: "1px solid var(--color-border, #E5E7EB)",
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
                  e.currentTarget.style.borderColor = "var(--color-border, #E5E7EB)";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.08)";
                }}>
                  🏷️ Categorías
                </button>
              </Link>
              <Link href="/limits" style={{ textDecoration: "none" }}>
                <button style={{
                  padding: "12px 16px",
                  background: "var(--color-bg-white, #FFFFFF)",
                  color: "var(--color-text-primary, #111827)",
                  border: "1px solid var(--color-border, #E5E7EB)",
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
                  e.currentTarget.style.borderColor = "var(--color-border, #E5E7EB)";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.08)";
                }}>
                  ⚠️ Límites
                </button>
              </Link>
              <Link href="/debts" style={{ textDecoration: "none" }}>
                <button style={{
                  padding: "12px 16px",
                  background: "var(--color-bg-white, #FFFFFF)",
                  color: "var(--color-text-primary, #111827)",
                  border: "1px solid var(--color-border, #E5E7EB)",
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
                  e.currentTarget.style.borderColor = "var(--color-border, #E5E7EB)";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.08)";
                }}>
                  💳 Deudas
                </button>
              </Link>
              <Link href="/recurring" style={{ textDecoration: "none" }}>
                <button style={{
                  padding: "12px 16px",
                  background: "var(--color-bg-white, #FFFFFF)",
                  color: "var(--color-text-primary, #111827)",
                  border: "1px solid var(--color-border, #E5E7EB)",
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
                  e.currentTarget.style.borderColor = "var(--color-border, #E5E7EB)";
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
                  background: "var(--color-bg-white, #FFFFFF)",
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
                  e.currentTarget.style.background = "var(--color-bg-white, #FFFFFF)";
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

        {/* Atajo Rápido para Gastos */}
        <div style={{
          background: "var(--color-bg-white, #FFFFFF)",
          borderRadius: isMobile ? "16px" : "20px",
          padding: isMobile ? "16px" : "20px 24px",
          marginBottom: isMobile ? "16px" : "24px",
          boxShadow: "var(--shadow-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.1))",
          border: "2px solid var(--color-primary, #4F46E5)",
          borderLeftWidth: "6px"
        }}>
          <div style={{
            fontSize: isMobile ? "14px" : "16px",
            fontWeight: "600",
            color: "var(--color-text-primary, #111827)",
            marginBottom: isMobile ? "12px" : "16px",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            ⚡ Gasto Rápido
          </div>
          <div style={{
            display: "flex",
            gap: isMobile ? "8px" : "12px",
            flexWrap: "wrap",
            alignItems: "flex-end"
          }}>
            <div style={{ flex: isMobile ? "1 1 100%" : "1 1 auto", minWidth: isMobile ? "100%" : "200px" }}>
              <label style={{
                display: "block",
                fontSize: "12px",
                fontWeight: "600",
                color: "var(--color-text-secondary, #6B7280)",
                marginBottom: "6px"
              }}>
                Monto
              </label>
              <input
                type="text"
                value={quickAmount}
                onChange={(e) => setQuickAmount(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    handleQuickSubmit();
                  }
                }}
                placeholder="Ej: 500"
                style={{
                  width: "100%",
                  padding: isMobile ? "12px" : "14px 16px",
                  fontSize: isMobile ? "16px" : "18px",
                  fontWeight: "600",
                  border: "2px solid var(--color-border, #E5E7EB)",
                  borderRadius: "12px",
                  outline: "none",
                  transition: "all 0.2s",
                  fontFamily: "'Inter', sans-serif"
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-primary, #4F46E5)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(79, 70, 229, 0.1)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-border, #E5E7EB)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>
            <button
              onClick={handleQuickSubmit}
              disabled={!quickAmount || !defaultAccount || !defaultCategory || creatingQuickTx}
              style={{
                padding: isMobile ? "12px 20px" : "14px 24px",
                fontSize: isMobile ? "14px" : "16px",
                fontWeight: "700",
                color: "white",
                background: (!quickAmount || !defaultAccount || !defaultCategory || creatingQuickTx)
                  ? "#9CA3AF"
                  : "var(--color-primary, #4F46E5)",
                border: "none",
                borderRadius: "12px",
                cursor: (!quickAmount || !defaultAccount || !defaultCategory || creatingQuickTx) ? "not-allowed" : "pointer",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                transition: "all 0.2s",
                whiteSpace: "nowrap",
                fontFamily: "'Inter', sans-serif"
              }}
              onMouseEnter={(e) => {
                if (!(!quickAmount || !defaultAccount || !defaultCategory || creatingQuickTx)) {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 6px 12px -2px rgba(79, 70, 229, 0.3)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.1)";
              }}
            >
              {creatingQuickTx ? "⏳ Creando..." : "✓ Confirmar"}
            </button>
          </div>
          <div style={{
            marginTop: isMobile ? "10px" : "12px",
            fontSize: "12px",
            color: "var(--color-text-tertiary, #9CA3AF)",
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between"
          }}>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              {defaultAccount && (
                <span>💳 {defaultAccount.name}</span>
              )}
              {defaultCategory && (
                <span>📁 {defaultCategory.name}</span>
              )}
              {(!defaultAccount || !defaultCategory) && (
                <span style={{ color: "#F59E0B" }}>
                  ⚠️ Configura cuenta y categoría predeterminadas
                </span>
              )}
            </div>
            <button
              onClick={() => setShowConfigModal(true)}
              style={{
                padding: "6px 12px",
                fontSize: "11px",
                fontWeight: "600",
                color: "var(--color-primary, #4F46E5)",
                background: "transparent",
                border: "1px solid var(--color-primary, #4F46E5)",
                borderRadius: "6px",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--color-primary, #4F46E5)";
                e.currentTarget.style.color = "white";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--color-primary, #4F46E5)";
              }}
            >
              ⚙️ Configurar
            </button>
          </div>
        </div>

        {/* Modal de Configuración */}
        {showConfigModal && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: isMobile ? "16px" : "20px"
          }}
          onClick={() => setShowConfigModal(false)}
          >
            <div style={{
              background: "white",
              borderRadius: "16px",
              padding: isMobile ? "20px" : "24px",
              maxWidth: "500px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
              border: "1px solid var(--color-border-light, #F3F4F6)"
            }}
            onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{
                fontSize: isMobile ? "18px" : "20px",
                fontWeight: "700",
                color: "var(--color-text-primary, #111827)",
                marginBottom: "20px"
              }}>
                ⚙️ Configurar Atajo Rápido
              </h3>
              
              <div style={{ marginBottom: "20px" }}>
                <label style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "var(--color-text-primary, #111827)",
                  marginBottom: "8px"
                }}>
                  Cuenta Predeterminada
                </label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    fontSize: "14px",
                    border: "2px solid var(--color-border, #E5E7EB)",
                    borderRadius: "8px",
                    outline: "none",
                    cursor: "pointer"
                  }}
                >
                  <option value="">Selecciona una cuenta</option>
                  {accounts.map((acc: any) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.currencyCode})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "var(--color-text-primary, #111827)",
                  marginBottom: "8px"
                }}>
                  Categoría Predeterminada
                </label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    fontSize: "14px",
                    border: "2px solid var(--color-border, #E5E7EB)",
                    borderRadius: "8px",
                    outline: "none",
                    cursor: "pointer"
                  }}
                >
                  <option value="">Selecciona una categoría</option>
                  {categories
                    .filter((cat: any) => cat.type === "EXPENSE")
                    .map((cat: any) => (
                      <optgroup key={cat.id} label={cat.name}>
                        {cat.children && cat.children.length > 0 ? (
                          cat.children.map((subcat: any) => (
                            <option key={subcat.id} value={subcat.id}>
                              {cat.name} → {subcat.name}
                            </option>
                          ))
                        ) : (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        )}
                      </optgroup>
                    ))}
                </select>
              </div>

              <div style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end"
              }}>
                <button
                  onClick={() => setShowConfigModal(false)}
                  style={{
                    padding: "10px 20px",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "var(--color-text-secondary, #6B7280)",
                    background: "#F3F4F6",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveConfig}
                  disabled={savingConfig || !selectedAccountId || !selectedCategoryId}
                  style={{
                    padding: "10px 20px",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "white",
                    background: (savingConfig || !selectedAccountId || !selectedCategoryId) ? "#9CA3AF" : "var(--color-primary, #4F46E5)",
                    border: "none",
                    borderRadius: "8px",
                    cursor: (savingConfig || !selectedAccountId || !selectedCategoryId) ? "not-allowed" : "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  {savingConfig ? "⏳ Guardando..." : "✓ Guardar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Confirmación */}
        {showQuickConfirm && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: isMobile ? "16px" : "20px"
          }}
          onClick={() => setShowQuickConfirm(false)}
          >
            <div style={{
              background: "white",
              borderRadius: "16px",
              padding: isMobile ? "20px" : "24px",
              maxWidth: "400px",
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
              border: "1px solid var(--color-border-light, #F3F4F6)"
            }}
            onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{
                fontSize: isMobile ? "18px" : "20px",
                fontWeight: "700",
                color: "var(--color-text-primary, #111827)",
                marginBottom: "16px"
              }}>
                ⚠️ Confirmar Gasto
              </h3>
              <div style={{
                fontSize: "14px",
                color: "var(--color-text-secondary, #6B7280)",
                marginBottom: "20px",
                lineHeight: "1.6"
              }}>
                <p style={{ marginBottom: "12px" }}>
                  ¿Crear un gasto de <strong style={{ color: "var(--color-text-primary, #111827)" }}>
                    {fmtMoney(Math.round(parseFloat(quickAmount.replace(/[^\d.,]/g, "").replace(",", ".")) * 100), defaultAccount?.currencyCode || user?.currencyCode || "UYU")}
                  </strong>?
                </p>
                <div style={{
                  background: "#F9FAFB",
                  padding: "12px",
                  borderRadius: "8px",
                  marginBottom: "12px"
                }}>
                  <div style={{ marginBottom: "6px" }}>
                    <strong>Cuenta:</strong> {defaultAccount?.name || "No configurada"}
                  </div>
                  <div>
                    <strong>Categoría:</strong> {defaultCategory?.name || "No configurada"}
                  </div>
                </div>
                <p style={{ fontSize: "12px", color: "#6B7280" }}>
                  Este gasto se registrará con la fecha de hoy.
                </p>
              </div>
              <div style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end"
              }}>
                <button
                  onClick={() => setShowQuickConfirm(false)}
                  style={{
                    padding: "10px 20px",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "var(--color-text-secondary, #6B7280)",
                    background: "#F3F4F6",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#E5E7EB";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#F3F4F6";
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleQuickConfirm}
                  disabled={creatingQuickTx}
                  style={{
                    padding: "10px 20px",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "white",
                    background: creatingQuickTx ? "#9CA3AF" : "var(--color-primary, #4F46E5)",
                    border: "none",
                    borderRadius: "8px",
                    cursor: creatingQuickTx ? "not-allowed" : "pointer",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => {
                    if (!creatingQuickTx) {
                      e.currentTarget.style.background = "#4338CA";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!creatingQuickTx) {
                      e.currentTarget.style.background = "var(--color-primary, #4F46E5)";
                    }
                  }}
                >
                  {creatingQuickTx ? "⏳ Creando..." : "✓ Confirmar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Resumen del Día (siempre visible) */}
        {dailyData !== null && (
          <div style={{
            display: "grid",
            gap: isMobile ? "12px" : "20px",
            gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(auto-fit, minmax(220px, 1fr))",
            marginBottom: isMobile ? "16px" : "24px"
          }}>
            {/* Presupuesto Diario Restante (PRIMERA TARJETA) */}
            {dailyData.hasBudget && (
              <div style={{
                background: "var(--color-bg-white, #FFFFFF)",
                borderRadius: isMobile ? "12px" : "16px",
                padding: isMobile ? "16px" : "24px",
                boxShadow: "var(--shadow-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.1))",
                borderLeft: "4px solid var(--color-primary, #4F46E5)",
                border: "1px solid var(--color-border-light, #F3F4F6)"
              }}>
                <div style={{ color: "var(--color-text-secondary, #6B7280)", fontSize: isMobile ? "12px" : "14px", marginBottom: "8px", fontWeight: "600" }}>
                  Presupuesto Diario Restante
                </div>
                <div style={{ 
                  fontSize: isMobile ? "24px" : "32px", 
                  fontWeight: "700", 
                  color: dailyData.remainingToday >= 0 ? "var(--color-balance-positive, #059669)" : "var(--color-balance-negative, #B45309)", 
                  marginBottom: "8px" 
                }}>
                  {fmtMoney(dailyData.remainingToday, user.currencyCode)}
                </div>
                <div style={{ color: "var(--color-text-tertiary, #9CA3AF)", fontSize: "12px" }}>
                  {data?.startOfDay?.remainingDaysIncludingToday 
                    ? `${data.startOfDay.remainingDaysIncludingToday} días restantes`
                    : "Calculando..."}
                </div>
              </div>
            )}

            {/* Presupuesto Diario Mañana (solo si hay presupuesto) */}
            {dailyData.hasBudget && dailyData.dailyTargetTomorrow !== undefined && (
              <div style={{
                background: "var(--color-bg-white, #FFFFFF)",
                borderRadius: isMobile ? "12px" : "16px",
                padding: isMobile ? "16px" : "24px",
                boxShadow: "var(--shadow-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.1))",
                borderLeft: "4px solid var(--color-primary, #4F46E5)",
                border: "1px solid var(--color-border-light, #F3F4F6)"
              }}>
                <div style={{ color: "var(--color-text-secondary, #6B7280)", fontSize: isMobile ? "12px" : "14px", marginBottom: "8px", fontWeight: "600" }}>
                  Presupuesto Diario Mañana
                </div>
                <div className="secondary-number" style={{ color: "var(--color-primary, #4F46E5)", marginBottom: "8px" }}>
                  {fmtMoney(dailyData.dailyTargetTomorrow || 0, user.currencyCode)}
                </div>
                <div style={{ color: "var(--color-text-tertiary, #9CA3AF)", fontSize: "12px" }}>
                  {data?.endOfDay?.remainingDaysExcludingToday 
                    ? `A partir de mañana (${data.endOfDay.remainingDaysExcludingToday} días)`
                    : "Sin días restantes"}
                </div>
              </div>
            )}

            {/* Gasto Acumulado del Día */}
            <div style={{
              background: "var(--color-bg-white, #FFFFFF)",
              borderRadius: isMobile ? "12px" : "16px",
              padding: isMobile ? "16px" : "24px",
              boxShadow: "var(--shadow-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.1))",
              borderLeft: "4px solid var(--color-expense, #B45309)",
              border: "1px solid var(--color-border-light, #F3F4F6)"
            }}>
              <div style={{ color: "var(--color-text-secondary, #6B7280)", fontSize: isMobile ? "12px" : "14px", marginBottom: "8px", fontWeight: "600" }}>
                Gasto Acumulado del Día
              </div>
              <div className="secondary-number" style={{ color: "var(--color-expense, #B45309)", marginBottom: "8px" }}>
                {fmtMoney(dailyData.spentToday, user.currencyCode)}
              </div>
              <div style={{ color: "var(--color-text-tertiary, #9CA3AF)", fontSize: "12px" }}>
                {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
              </div>
            </div>

            {/* Presupuesto del Día (solo si hay presupuesto Y el presupuesto es mayor a 0) */}
            {dailyData.hasBudget && dailyData.dailyBudget > 0 && (
              <div style={{
                background: "var(--color-bg-white, #FFFFFF)",
                borderRadius: isMobile ? "12px" : "16px",
                padding: isMobile ? "16px" : "24px",
                boxShadow: "var(--shadow-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.1))",
                borderLeft: "4px solid var(--color-primary, #4F46E5)",
                border: "1px solid var(--color-border-light, #F3F4F6)"
              }}>
                <div style={{ color: "var(--color-text-secondary, #6B7280)", fontSize: isMobile ? "12px" : "14px", marginBottom: "8px", fontWeight: "600" }}>
                  Presupuesto del Día
                </div>
                <div className="secondary-number" style={{ color: "var(--color-primary, #4F46E5)", marginBottom: "8px" }}>
                  {fmtMoney(dailyData.dailyBudget, user.currencyCode)}
                </div>
                <div style={{ color: "var(--color-text-tertiary, #9CA3AF)", fontSize: "12px" }}>
                  {Math.round((dailyData.spentToday / dailyData.dailyBudget) * 100)}% utilizado
                </div>
              </div>
            )}

            {previousMonthData && (
              <div style={{
                background: "var(--color-bg-white, #FFFFFF)",
                borderRadius: "16px",
                padding: "24px",
                boxShadow: "var(--shadow-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.1))",
                borderLeft: "4px solid var(--color-secondary-warning, #F59E0B)",
                border: "1px solid var(--color-border-light, #F3F4F6)"
              }}>
                <div style={{ color: "var(--color-text-secondary, #6B7280)", fontSize: "14px", marginBottom: "8px", fontWeight: "600" }}>
                  Comparativo Mes Pasado
                </div>
                <div className="secondary-number" style={{ color: "var(--color-secondary-warning, #F59E0B)", marginBottom: "8px" }}>
                  {fmtMoney(previousMonthData.spentUpToSameDay, user.currencyCode)}
                </div>
                <div style={{ color: "#999", fontSize: "12px", marginBottom: "4px" }}>
                  {monthNames[previousMonthData.month - 1]} {previousMonthData.year}
                </div>
                <div style={{ 
                  fontSize: "12px", 
                  color: dailyData.spentToday > previousMonthData.spentUpToSameDay ? "var(--color-expense, #B45309)" : "var(--color-income, #059669)",
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

        {/* Alertas Activas de Límites */}
        {activeLimitAlerts.length > 0 && (
          <div style={{
            background: "var(--color-bg-white, #FFFFFF)",
            borderRadius: "16px",
            padding: "24px",
            marginBottom: "24px",
            boxShadow: "var(--shadow-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.1))",
            border: "1px solid var(--color-border-light, #F3F4F6)"
          }}>
            <h3 style={{ 
              fontSize: "20px", 
              fontWeight: "700", 
              marginBottom: "16px", 
              color: "var(--color-text-primary, #111827)", 
              fontFamily: "'Inter', sans-serif" 
            }}>
              ⚠️ Alertas de Límites
            </h3>
            <div style={{ display: "grid", gap: "16px" }}>
              {activeLimitAlerts.map((alert: any) => (
                <div 
                  key={alert.limitId} 
                  style={{
                    padding: "16px",
                    background: alert.isExceeded 
                      ? "rgba(180, 83, 9, 0.1)" 
                      : "rgba(245, 158, 11, 0.1)",
                    borderRadius: "12px",
                    border: `2px solid ${alert.isExceeded ? "var(--color-expense, #B45309)" : "var(--color-warning, #F59E0B)"}`
                  }}
                >
                  <div style={{ 
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "flex-start",
                    marginBottom: "12px"
                  }}>
                    <div>
                      <div style={{ 
                        fontSize: "16px", 
                        fontWeight: "700", 
                        color: "var(--color-text-primary, #111827)",
                        marginBottom: "4px"
                      }}>
                        {alert.categoryName}
                      </div>
                      <div style={{ 
                        fontSize: "12px", 
                        color: "var(--color-text-secondary, #6B7280)" 
                      }}>
                        {alert.isExceeded ? "Límite excedido" : `Alerta: ${alert.percentage}% alcanzado`}
                      </div>
                    </div>
                    <div style={{
                      fontSize: "20px",
                      fontWeight: "700",
                      color: alert.isExceeded 
                        ? "var(--color-expense, #B45309)" 
                        : "var(--color-warning, #F59E0B)"
                    }}>
                      {alert.percentage}%
                    </div>
                  </div>
                  <div style={{ 
                    display: "grid", 
                    gridTemplateColumns: "repeat(2, 1fr)", 
                    gap: "12px",
                    marginTop: "12px"
                  }}>
                    <div>
                      <div style={{ fontSize: "11px", color: "var(--color-text-secondary, #6B7280)", marginBottom: "4px" }}>
                        Gastado
                      </div>
                      <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--color-text-primary, #111827)" }}>
                        {fmtMoney(alert.spentCents, user.currencyCode)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "11px", color: "var(--color-text-secondary, #6B7280)", marginBottom: "4px" }}>
                        Restante
                      </div>
                      <div style={{ 
                        fontSize: "14px", 
                        fontWeight: "600", 
                        color: alert.remainingCents > 0 
                          ? "var(--color-balance-positive, #059669)" 
                          : "var(--color-expense, #B45309)"
                      }}>
                        {fmtMoney(alert.remainingCents, user.currencyCode)}
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: "12px" }}>
                    <div style={{ 
                      width: "100%", 
                      height: "8px", 
                      background: "#e0e0e0", 
                      borderRadius: "4px", 
                      overflow: "hidden" 
                    }}>
                      <div style={{
                        width: `${Math.min(100, alert.percentage)}%`,
                        height: "100%",
                        background: alert.isExceeded 
                          ? "var(--color-expense, #B45309)" 
                          : "var(--color-warning, #F59E0B)",
                        transition: "width 0.3s"
                      }} />
                    </div>
                    <div style={{ 
                      fontSize: "11px", 
                      color: "var(--color-text-tertiary, #9CA3AF)", 
                      marginTop: "4px",
                      textAlign: "right"
                    }}>
                      Límite: {fmtMoney(alert.limitCents, user.currencyCode)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transacciones Recurrentes Pendientes */}
        {pendingRecurring.length > 0 && (
          <div style={{
            background: "var(--color-bg-white, #FFFFFF)",
            borderRadius: "16px",
            padding: "24px",
            marginBottom: "24px",
            boxShadow: "var(--shadow-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.1))",
            border: "1px solid var(--color-border-light, #F3F4F6)"
          }}>
            <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "16px", color: "var(--color-text-primary, #111827)", fontFamily: "'Inter', sans-serif" }}>
              🔄 Pendientes Recurrentes del Mes
            </h3>
            <div style={{ display: "grid", gap: "12px" }}>
              {pendingRecurring.map((tx: any) => (
                <div key={tx.id} style={{
                  padding: "16px",
                  background: "var(--color-bg-secondary, #F8F9FA)",
                  borderRadius: "12px",
                  border: "1px solid var(--color-border, #E5E7EB)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px"
                }}>
                  <div style={{ flex: 1, minWidth: "200px" }}>
                    <div style={{ fontWeight: "600", color: "var(--color-text-primary, #111827)", marginBottom: "4px" }}>
                      {tx.description || "Sin descripción"}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--color-text-secondary, #6B7280)", marginBottom: "4px" }}>
                      {tx.category?.name || "Sin categoría"}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--color-text-tertiary, #9CA3AF)" }}>
                      {tx.nextOccurrence 
                        ? `Próxima: ${new Date(tx.nextOccurrence).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`
                        : "Sin fecha programada"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", marginRight: "12px" }}>
                    <div style={{ fontSize: "18px", fontWeight: "700", color: tx.type === "INCOME" ? "var(--color-income, #059669)" : "var(--color-expense, #B45309)", marginBottom: "4px" }}>
                      {tx.type === "INCOME" ? "+" : "-"}{fmtMoney(tx.amountCents, tx.currencyCode || user.currencyCode)}
                    </div>
                    {tx.remainingOccurrences !== null && (
                      <div style={{ fontSize: "11px", color: "var(--color-text-tertiary, #9CA3AF)" }}>
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
                      background: "var(--color-primary, #4F46E5)",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: "600",
                      cursor: "pointer",
                      boxShadow: "var(--shadow-md, 0 4px 6px -1px rgba(0, 0, 0, 0.1))",
                      transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                      fontFamily: "'Inter', sans-serif"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.background = "var(--color-primary-hover, #4338CA)";
                      e.currentTarget.style.boxShadow = "var(--shadow-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.1))";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.background = "var(--color-primary, #4F46E5)";
                      e.currentTarget.style.boxShadow = "var(--shadow-md, 0 4px 6px -1px rgba(0, 0, 0, 0.1))";
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
            background: "var(--color-bg-white, #FFFFFF)",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "var(--shadow-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.1))",
            border: "1px solid var(--color-border-light, #F3F4F6)"
          }}>
            <div style={{ color: "var(--color-text-secondary, #6B7280)", fontSize: "14px", marginBottom: "8px", fontWeight: "600" }}>
              Ingresos del Mes
            </div>
            <div className="secondary-number" style={{ color: "var(--color-income, #059669)", marginBottom: "8px" }}>
              {monthlyData ? fmtMoney(monthlyData.totalIncome, user.currencyCode) : "..."}
            </div>
            <div style={{ color: "var(--color-text-tertiary, #9CA3AF)", fontSize: "12px" }}>
              {monthNames[month - 1]} {year}
            </div>
          </div>

          <div style={{
            background: "var(--color-bg-white, #FFFFFF)",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "var(--shadow-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.1))",
            border: "1px solid var(--color-border-light, #F3F4F6)"
          }}>
            <div style={{ color: "var(--color-text-secondary, #6B7280)", fontSize: "14px", marginBottom: "8px", fontWeight: "600" }}>
              Gastos del Mes
            </div>
            <div className="secondary-number" style={{ color: "var(--color-expense, #B45309)", marginBottom: "8px" }}>
              {monthlyData ? fmtMoney(monthlyData.totalExpenses, user.currencyCode) : "..."}
            </div>
            <div style={{ color: "var(--color-text-tertiary, #9CA3AF)", fontSize: "12px" }}>
              {monthlyData?.transactionCount || 0} transacciones
            </div>
          </div>

          <div style={{
            background: "var(--color-bg-white, #FFFFFF)",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "var(--shadow-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.1))",
            border: "1px solid var(--color-border-light, #F3F4F6)"
          }}>
            <div style={{ color: "var(--color-text-secondary, #6B7280)", fontSize: "14px", marginBottom: "8px", fontWeight: "600" }}>
              Balance del Mes
            </div>
            <div style={{ 
              fontSize: "32px", 
              fontWeight: "700", 
              color: monthlyData && monthlyData.balance >= 0 ? "var(--color-balance-positive, #059669)" : "var(--color-balance-negative, #B45309)", 
              marginBottom: "8px" 
            }}>
              {monthlyData ? fmtMoney(monthlyData.balance, user.currencyCode) : "..."}
            </div>
            <div style={{ color: "var(--color-text-tertiary, #9CA3AF)", fontSize: "12px" }}>
              {monthlyData && monthlyData.totalIncome > 0 
                ? `${Math.round((monthlyData.balance / monthlyData.totalIncome) * 100)}% de ahorro`
                : "Sin ingresos"}
            </div>
          </div>

        </div>

        {/* Meta de Ahorro */}
        {goalData && (
          <div style={{
            background: "var(--color-bg-white, #FFFFFF)",
            borderRadius: "16px",
            padding: "24px",
            marginBottom: "24px",
            boxShadow: "var(--shadow-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.1))",
            border: "1px solid var(--color-border-light, #F3F4F6)"
          }}>
            <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "16px", color: "var(--color-text-primary, #111827)", fontFamily: "'Inter', sans-serif" }}>
              Meta de Ahorro del Mes
            </h3>
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "14px", color: "#666" }}>Progreso</span>
                <span style={{ fontSize: "14px", fontWeight: "600", color: goalData.progress >= 100 ? "var(--color-income, #059669)" : "var(--color-primary, #4F46E5)" }}>
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
                    ? "var(--color-income, #059669)"
                    : "var(--color-primary, #4F46E5)",
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
                <div style={{ fontSize: "12px", color: "var(--color-text-secondary, #6B7280)", marginBottom: "4px" }}>Meta</div>
                <div style={{ fontSize: "18px", fontWeight: "700", color: "var(--color-text-primary, #111827)" }}>
                  {fmtMoney(goalData.savingGoalCents, user.currencyCode)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "12px", color: "var(--color-text-secondary, #6B7280)", marginBottom: "4px" }}>Ahorrado</div>
                <div style={{ fontSize: "18px", fontWeight: "700", color: "var(--color-income, #059669)" }}>
                  {fmtMoney(goalData.saved, user.currencyCode)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "12px", color: "var(--color-text-secondary, #6B7280)", marginBottom: "4px" }}>Restante</div>
                <div style={{ fontSize: "18px", fontWeight: "700", color: goalData.remaining > 0 ? "var(--color-expense, #B45309)" : "var(--color-income, #059669)" }}>
                  {fmtMoney(goalData.remaining, user.currencyCode)}
                </div>
              </div>
            </div>
            {goalData.progress >= 100 && (
              <div style={{
                marginTop: "16px",
                padding: "12px",
                background: "rgba(5, 150, 105, 0.1)",
                borderRadius: "8px",
                textAlign: "center",
                border: "1px solid var(--color-income, #059669)"
              }}>
                <span style={{ color: "var(--color-income, #059669)", fontWeight: "600" }}>🎉 ¡Meta alcanzada!</span>
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
              background: "var(--color-bg-white, #FFFFFF)",
              borderRadius: "16px",
              padding: "24px",
              boxShadow: "var(--shadow-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.1))",
              border: "1px solid var(--color-border-light, #F3F4F6)"
            }}>
              <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "16px", color: "var(--color-text-primary, #111827)", fontFamily: "'Inter', sans-serif" }}>
                Tendencias (Últimos 6 Meses)
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #E5E7EB)" />
                  <XAxis 
                    dataKey="month" 
                    stroke="var(--color-text-secondary, #6B7280)"
                    style={{ fontSize: "12px" }}
                    tickFormatter={(value) => {
                      const [y, m] = value.split("-");
                      return `${m}/${y.slice(2)}`;
                    }}
                  />
                  <YAxis 
                    stroke="var(--color-text-secondary, #6B7280)"
                    style={{ fontSize: "12px" }}
                    tickFormatter={(value) => fmtMoney(value * 100, user.currencyCode)}
                  />
                  <Tooltip 
                    formatter={(value: number) => fmtMoney(value * 100, user.currencyCode)}
                    labelFormatter={(label) => `Mes: ${label}`}
                    contentStyle={{ borderRadius: "8px", border: "1px solid var(--color-border, #E5E7EB)", background: "var(--color-bg-white, #FFFFFF)" }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="Ingresos" 
                    stroke="var(--color-income, #059669)" 
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="Ingresos"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Gastos" 
                    stroke="var(--color-expense, #B45309)" 
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="Gastos"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Balance" 
                    stroke="var(--color-primary, #4F46E5)" 
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="Balance"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Gráfico de Barras - Comparación Mensual */}
            <div style={{
              background: "var(--color-bg-white, #FFFFFF)",
              borderRadius: "16px",
              padding: "24px",
              boxShadow: "var(--shadow-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.1))",
              border: "1px solid var(--color-border-light, #F3F4F6)"
            }}>
              <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "16px", color: "var(--color-text-primary, #111827)", fontFamily: "'Inter', sans-serif" }}>
                Comparación Mensual
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #E5E7EB)" />
                  <XAxis 
                    dataKey="month" 
                    stroke="var(--color-text-secondary, #6B7280)"
                    style={{ fontSize: "12px" }}
                    tickFormatter={(value) => {
                      const [y, m] = value.split("-");
                      return `${m}/${y.slice(2)}`;
                    }}
                  />
                  <YAxis 
                    stroke="var(--color-text-secondary, #6B7280)"
                    style={{ fontSize: "12px" }}
                    tickFormatter={(value) => fmtMoney(value * 100, user.currencyCode)}
                  />
                  <Tooltip 
                    formatter={(value: number) => fmtMoney(value * 100, user.currencyCode)}
                    contentStyle={{ borderRadius: "8px", border: "1px solid var(--color-border, #E5E7EB)", background: "var(--color-bg-white, #FFFFFF)" }}
                  />
                  <Legend />
                  <Bar dataKey="Ingresos" fill="var(--color-income, #059669)" name="Ingresos" />
                  <Bar dataKey="Gastos" fill="var(--color-expense, #B45309)" name="Gastos" />
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
              background: "var(--color-bg-white, #FFFFFF)",
              borderRadius: "16px",
              padding: "24px",
              boxShadow: "var(--shadow-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.1))",
              border: "1px solid var(--color-border-light, #F3F4F6)"
            }}>
              <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "16px", color: "var(--color-text-primary, #111827)", fontFamily: "'Inter', sans-serif" }}>
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
                      const colors = ["#4F46E5", "#059669", "#F59E0B", "#3B82F6", "#8B5CF6", "#10B981"];
                      return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                    })}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => fmtMoney(value * 100, user.currencyCode)}
                    contentStyle={{ borderRadius: "8px", border: "1px solid var(--color-border, #E5E7EB)", background: "var(--color-bg-white, #FFFFFF)" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Top Gastos por Categoría */}
            <div style={{
              background: "var(--color-bg-white, #FFFFFF)",
              borderRadius: "16px",
              padding: "24px",
              boxShadow: "var(--shadow-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.1))",
              border: "1px solid var(--color-border-light, #F3F4F6)"
            }}>
              <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "16px", color: "var(--color-text-primary, #111827)", fontFamily: "'Inter', sans-serif" }}>
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
                      background: "var(--color-bg-secondary, #F8F9FA)",
                      borderRadius: "8px"
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: "600", color: "var(--color-text-primary, #111827)", marginBottom: "4px" }}>
                          {cat.categoryName}
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--color-text-secondary, #6B7280)" }}>
                          {cat.count} transacción{cat.count !== 1 ? "es" : ""}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: "700", color: "var(--color-expense, #B45309)", marginBottom: "4px" }}>
                          {fmtMoney(cat.amountCents, user.currencyCode)}
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--color-text-tertiary, #9CA3AF)" }}>
                          {Math.round(percentage)}%
                        </div>
                      </div>
                      <div style={{
                        width: "100px",
                        height: "8px",
                        background: "var(--color-border, #E5E7EB)",
                        borderRadius: "4px",
                        overflow: "hidden"
                      }}>
                        <div style={{
                          width: `${percentage}%`,
                          height: "100%",
                          background: "var(--color-primary, #4F46E5)",
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
          background: "var(--color-bg-white, #FFFFFF)",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "var(--shadow-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.1))",
          border: "1px solid var(--color-border-light, #F3F4F6)"
        }}>
          <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "16px", color: "var(--color-text-primary, #111827)", fontFamily: "'Inter', sans-serif" }}>
            Acciones Rápidas
          </h3>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <Link href="/transactions/new">
              <button style={{
                padding: "12px 24px",
                background: "var(--color-primary, #4F46E5)",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--color-primary-hover, #4338CA)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--color-primary, #4F46E5)";
                e.currentTarget.style.transform = "translateY(0)";
              }}>
                Nueva Transacción
              </button>
            </Link>
            <Link href="/accounts">
              <button style={{
                padding: "12px 24px",
                background: "var(--color-bg-secondary, #F8F9FA)",
                color: "var(--color-text-primary, #111827)",
                border: "1px solid var(--color-border, #E5E7EB)",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--color-primary, #4F46E5)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--color-border, #E5E7EB)";
                e.currentTarget.style.transform = "translateY(0)";
              }}>
                Gestionar Cuentas
              </button>
            </Link>
            <Link href="/statistics">
              <button style={{
                padding: "12px 24px",
                background: "var(--color-bg-secondary, #F8F9FA)",
                color: "var(--color-text-primary, #111827)",
                border: "1px solid var(--color-border, #E5E7EB)",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--color-primary, #4F46E5)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--color-border, #E5E7EB)";
                e.currentTarget.style.transform = "translateY(0)";
              }}>
                Ver Estadísticas
              </button>
            </Link>
            <Link href="/savings">
              <button style={{
                padding: "12px 24px",
                background: "var(--color-bg-secondary, #F8F9FA)",
                color: "var(--color-text-primary, #111827)",
                border: "1px solid var(--color-border, #E5E7EB)",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--color-primary, #4F46E5)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--color-border, #E5E7EB)";
                e.currentTarget.style.transform = "translateY(0)";
              }}>
                Ahorros
              </button>
            </Link>
            <Link href="/transactions">
              <button style={{
                padding: "12px 24px",
                background: "var(--color-bg-secondary, #F8F9FA)",
                color: "var(--color-text-primary, #111827)",
                border: "1px solid var(--color-border, #E5E7EB)",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--color-primary, #4F46E5)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--color-border, #E5E7EB)";
                e.currentTarget.style.transform = "translateY(0)";
              }}>
                Historial
              </button>
            </Link>
            <a
              href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/export/csv?from=${selectedDate}-01&to=${selectedDate}-${new Date(year, month, 0).getDate()}`}
              target="_blank"
              style={{
                padding: "12px 24px",
                background: "var(--color-bg-secondary, #F8F9FA)",
                color: "var(--color-text-primary, #111827)",
                border: "1px solid var(--color-border, #E5E7EB)",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
                textDecoration: "none",
                display: "inline-block",
                fontFamily: "'Inter', sans-serif",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--color-primary, #4F46E5)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--color-border, #E5E7EB)";
                e.currentTarget.style.transform = "translateY(0)";
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
