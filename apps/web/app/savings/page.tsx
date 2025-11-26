"use client";
import { useEffect, useState } from "react";
import api, { setAuthToken } from "../../lib/api";
import { useAuth } from "../../store/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

function fmtMoney(cents: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, { 
    style: "currency", 
    currency, 
    minimumFractionDigits: 0, 
    maximumFractionDigits: 0 
  }).format(cents / 100);
}

export default function SavingsPage() {
  const { user, logout, token, initialized, initAuth } = useAuth();
  const router = useRouter();
  const [savingsData, setSavingsData] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
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
  }, [user, token, initialized, selectedYear, router, initAuth]);

  async function loadData() {
    setLoading(true);
    setError(undefined);
    try {
      // Cargar estadísticas de ahorros
      const savingsRes = await api.get(`/statistics/savings?year=${selectedYear}`);
      setSavingsData(savingsRes.data);

      // Cargar cuentas de ahorro
      const accountsRes = await api.get("/accounts");
      const savingsAccounts = accountsRes.data.accounts.filter((a: any) => a.type === "SAVINGS");
      setAccounts(savingsAccounts);

      // Cargar transacciones de ahorro del año actual
      const yearStart = `${selectedYear}-01-01`;
      const yearEnd = `${selectedYear}-12-31`;
      const transactionsRes = await api.get(`/transactions?from=${yearStart}&to=${yearEnd}&pageSize=500`);
      const allTransactions = transactionsRes.data.transactions || [];
      
      // Filtrar transacciones relacionadas con cuentas de ahorro
      const savingsAccountIds = savingsAccounts.map((a: any) => a.id);
      const savingsTransactions = allTransactions.filter((t: any) => 
        savingsAccountIds.includes(t.accountId) && t.type === "INCOME"
      );
      setTransactions(savingsTransactions);
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
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
      }}>
        <div style={{
          background: "white",
          padding: "40px",
          borderRadius: "20px",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)"
        }}>
          <p style={{ fontSize: "18px", color: "#667eea", fontWeight: "600" }}>Cargando...</p>
        </div>
      </div>
    );
  }

  const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const chartData = savingsData?.monthly.map((m: any) => ({
    month: monthNames[m.month - 1],
    Meta: m.goalCents / 100,
    Ahorrado: m.actualSavings / 100,
    Tasa: m.savingsRate
  })) || [];

  // Calcular totales de cuentas de ahorro
  const totalSavingsBalance = accounts.reduce((sum, acc) => sum + (acc.balanceCents || 0), 0);

  return (
    <div style={{ 
      minHeight: "100vh",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      padding: "20px"
    }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{
          background: "white",
          borderRadius: "20px",
          padding: "24px 32px",
          marginBottom: "24px",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px"
        }}>
          <div>
            <h1 style={{
              fontSize: "28px",
              fontWeight: "700",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              marginBottom: "4px"
            }}>
              💰 Ahorros
            </h1>
            <p style={{ color: "#666", fontSize: "14px" }}>Estadísticas y seguimiento de tus ahorros</p>
          </div>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
            <input
              type="number"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              min="2020"
              max="2100"
              style={{
                padding: "10px 16px",
                border: "2px solid #e0e0e0",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "600",
                width: "100px"
              }}
            />
            <Link href="/dashboard">
              <button style={{
                padding: "10px 20px",
                background: "#f0f0f0",
                color: "#333",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer"
              }}>
                Dashboard
              </button>
            </Link>
            <Link href="/accounts">
              <button style={{
                padding: "10px 20px",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer"
              }}>
                Gestionar Cuentas
              </button>
            </Link>
          </div>
        </div>

        {error && (
          <div style={{
            background: "#fee",
            color: "#c33",
            padding: "16px",
            borderRadius: "12px",
            marginBottom: "24px",
            border: "1px solid #fcc"
          }}>
            {error}
          </div>
        )}

        {savingsData && (
          <>
            {/* Resumen Anual */}
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
                  Ahorros Totales ({selectedYear})
                </div>
                <div style={{ fontSize: "32px", fontWeight: "700", color: "#27ae60", marginBottom: "8px" }}>
                  {fmtMoney(savingsData.summary.totalSavings, user.currencyCode)}
                </div>
                <div style={{ color: "#999", fontSize: "12px" }}>
                  {savingsData.summary.averageSavingsRate}% de tasa de ahorro
                </div>
              </div>

              <div style={{
                background: "white",
                borderRadius: "16px",
                padding: "24px",
                boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)"
              }}>
                <div style={{ color: "#666", fontSize: "14px", marginBottom: "8px", fontWeight: "600" }}>
                  Balance Total en Cuentas de Ahorro
                </div>
                <div style={{ fontSize: "32px", fontWeight: "700", color: "#667eea", marginBottom: "8px" }}>
                  {fmtMoney(totalSavingsBalance, user.currencyCode)}
                </div>
                <div style={{ color: "#999", fontSize: "12px" }}>
                  {accounts.length} cuenta{accounts.length !== 1 ? "s" : ""} de ahorro
                </div>
              </div>

              <div style={{
                background: "white",
                borderRadius: "16px",
                padding: "24px",
                boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)"
              }}>
                <div style={{ color: "#666", fontSize: "14px", marginBottom: "8px", fontWeight: "600" }}>
                  Meta Anual
                </div>
                <div style={{ fontSize: "32px", fontWeight: "700", color: "#764ba2", marginBottom: "8px" }}>
                  {fmtMoney(savingsData.summary.totalGoal, user.currencyCode)}
                </div>
                <div style={{ color: "#999", fontSize: "12px" }}>
                  {savingsData.summary.totalGoal > 0 
                    ? `${Math.round((savingsData.summary.totalSavings / savingsData.summary.totalGoal) * 100)}% alcanzado`
                    : "Sin meta configurada"}
                </div>
              </div>

              <div style={{
                background: "white",
                borderRadius: "16px",
                padding: "24px",
                boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)"
              }}>
                <div style={{ color: "#666", fontSize: "14px", marginBottom: "8px", fontWeight: "600" }}>
                  Ingresos Totales
                </div>
                <div style={{ fontSize: "32px", fontWeight: "700", color: "#27ae60", marginBottom: "8px" }}>
                  {fmtMoney(savingsData.summary.totalIncome, user.currencyCode)}
                </div>
                <div style={{ color: "#999", fontSize: "12px" }}>
                  Base para calcular ahorro
                </div>
              </div>
            </div>

            {/* Gráficos */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(500px, 1fr))",
              gap: "24px",
              marginBottom: "24px"
            }}>
              {/* Gráfico de Barras - Meta vs Ahorrado */}
              <div style={{
                background: "white",
                borderRadius: "16px",
                padding: "24px",
                boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)"
              }}>
                <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "16px", color: "#333" }}>
                  Meta vs Ahorrado Mensual
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis dataKey="month" stroke="#666" style={{ fontSize: "12px" }} />
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
                    <Bar dataKey="Meta" fill="#764ba2" name="Meta" />
                    <Bar dataKey="Ahorrado" fill="#27ae60" name="Ahorrado" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Gráfico de Líneas - Tasa de Ahorro */}
              <div style={{
                background: "white",
                borderRadius: "16px",
                padding: "24px",
                boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)"
              }}>
                <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "16px", color: "#333" }}>
                  Tasa de Ahorro Mensual (%)
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis dataKey="month" stroke="#666" style={{ fontSize: "12px" }} />
                    <YAxis 
                      stroke="#666"
                      style={{ fontSize: "12px" }}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip 
                      formatter={(value: number) => `${value.toFixed(1)}%`}
                      contentStyle={{ borderRadius: "8px", border: "1px solid #e0e0e0" }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="Tasa" 
                      stroke="#667eea" 
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      name="Tasa de Ahorro (%)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Desglose Mensual */}
            <div style={{
              background: "white",
              borderRadius: "16px",
              padding: "24px",
              boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)",
              marginBottom: "24px"
            }}>
              <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "16px", color: "#333" }}>
                Desglose Mensual - {selectedYear}
              </h3>
              <div style={{ display: "grid", gap: "12px" }}>
                {savingsData.monthly.map((m: any) => (
                  <div key={m.month} style={{
                    padding: "16px",
                    background: m.goalAchieved ? "#d5f4e6" : "#fff2cc",
                    borderRadius: "12px",
                    borderLeft: `4px solid ${m.goalAchieved ? "#27ae60" : "#f39c12"}`
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: "600", color: "#333", marginBottom: "4px", fontSize: "16px" }}>
                          {monthNames[m.month - 1]} {m.year}
                        </div>
                        <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
                          Meta: {fmtMoney(m.goalCents, user.currencyCode)} • 
                          Ahorrado: {fmtMoney(m.actualSavings, user.currencyCode)} • 
                          Tasa: {m.savingsRate.toFixed(1)}%
                        </div>
                      </div>
                      <div style={{
                        padding: "6px 12px",
                        background: m.goalAchieved ? "#27ae60" : "#f39c12",
                        color: "white",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: "600"
                      }}>
                        {m.goalAchieved ? "✅ Meta Alcanzada" : "⏳ En Progreso"}
                      </div>
                    </div>
                    {m.goalCents > 0 && (
                      <div style={{ marginTop: "12px" }}>
                        <div style={{
                          width: "100%",
                          height: "8px",
                          background: "#e0e0e0",
                          borderRadius: "4px",
                          overflow: "hidden"
                        }}>
                          <div style={{
                            width: `${Math.min(100, (m.actualSavings / m.goalCents) * 100)}%`,
                            height: "100%",
                            background: m.goalAchieved 
                              ? "linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)"
                              : "linear-gradient(135deg, #f39c12 0%, #e67e22 100%)",
                            transition: "width 0.3s"
                          }} />
                        </div>
                        <div style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>
                          {Math.round((m.actualSavings / m.goalCents) * 100)}% de la meta
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Cuentas de Ahorro */}
            {accounts.length > 0 && (
              <div style={{
                background: "white",
                borderRadius: "16px",
                padding: "24px",
                boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)",
                marginBottom: "24px"
              }}>
                <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "16px", color: "#333" }}>
                  Cuentas de Ahorro
                </h3>
                <div style={{ display: "grid", gap: "12px" }}>
                  {accounts.map((account: any) => (
                    <div key={account.id} style={{
                      padding: "16px",
                      background: "#f8f9fa",
                      borderRadius: "12px",
                      border: "1px solid #e0e0e0"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontWeight: "600", color: "#333", marginBottom: "4px" }}>
                            {account.name}
                          </div>
                          <div style={{ fontSize: "12px", color: "#666" }}>
                            {account.currencyCode}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: "20px", fontWeight: "700", color: "#27ae60" }}>
                            {fmtMoney(account.balanceCents || 0, account.currencyCode)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Últimas Transacciones de Ahorro */}
            {transactions.length > 0 && (
              <div style={{
                background: "white",
                borderRadius: "16px",
                padding: "24px",
                boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)"
              }}>
                <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "16px", color: "#333" }}>
                  Últimas Transacciones de Ahorro ({selectedYear})
                </h3>
                <div style={{ display: "grid", gap: "8px" }}>
                  {transactions.slice(0, 10).map((tx: any) => (
                    <div key={tx.id} style={{
                      padding: "12px",
                      background: "#f8f9fa",
                      borderRadius: "8px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}>
                      <div>
                        <div style={{ fontWeight: "600", color: "#333", marginBottom: "4px" }}>
                          {tx.description || "Sin descripción"}
                        </div>
                        <div style={{ fontSize: "12px", color: "#666" }}>
                          {new Date(tx.occurredAt).toLocaleDateString("es-ES", { 
                            year: "numeric", 
                            month: "short", 
                            day: "numeric" 
                          })}
                        </div>
                      </div>
                      <div style={{ fontSize: "18px", fontWeight: "700", color: "#27ae60" }}>
                        +{fmtMoney(tx.amountCents, tx.currencyCode)}
                      </div>
                    </div>
                  ))}
                </div>
                {transactions.length > 10 && (
                  <div style={{ marginTop: "16px", textAlign: "center" }}>
                    <Link href="/transactions">
                      <button style={{
                        padding: "10px 20px",
                        background: "#f0f0f0",
                        color: "#333",
                        border: "none",
                        borderRadius: "8px",
                        fontSize: "14px",
                        fontWeight: "600",
                        cursor: "pointer"
                      }}>
                        Ver todas las transacciones
                      </button>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {!savingsData && !loading && (
          <div style={{
            background: "white",
            borderRadius: "16px",
            padding: "40px",
            textAlign: "center",
            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)"
          }}>
            <p style={{ color: "#666", fontSize: "16px" }}>
              No hay datos de ahorros para mostrar. 
              Crea una cuenta de ahorro y registra transacciones de ingreso en ella.
            </p>
            <Link href="/accounts">
              <button style={{
                marginTop: "16px",
                padding: "12px 24px",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer"
              }}>
                Crear Cuenta de Ahorro
              </button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

