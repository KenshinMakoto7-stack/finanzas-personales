"use client";
import { useEffect, useState } from "react";
import api, { setAuthToken } from "../../lib/api";
import { useAuth } from "../../store/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

function fmtMoney(cents: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(cents / 100);
}

export default function StatisticsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"expenses" | "savings" | "income" | "fixed" | "ai">("expenses");
  const [expensesData, setExpensesData] = useState<any>(null);
  const [savingsData, setSavingsData] = useState<any>(null);
  const [incomeData, setIncomeData] = useState<any>(null);
  const [fixedCostsData, setFixedCostsData] = useState<any>(null);
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [period, setPeriod] = useState("month");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    const token = localStorage.getItem("token");
    if (token) setAuthToken(token);

    loadData();
  }, [user, router, period, year, month, activeTab]);

  async function loadData() {
    setLoading(true);
    try {
      if (activeTab === "expenses") {
        const res = await api.get(`/statistics/expenses-by-category?year=${year}&month=${month}&period=${period}`);
        setExpensesData(res.data);
      } else if (activeTab === "savings") {
        const res = await api.get(`/statistics/savings?year=${year}`);
        setSavingsData(res.data);
      } else if (activeTab === "income") {
        const res = await api.get(`/statistics/income?year=${year}`);
        setIncomeData(res.data);
      } else if (activeTab === "fixed") {
        const res = await api.get("/statistics/fixed-costs");
        setFixedCostsData(res.data);
      } else if (activeTab === "ai") {
        const res = await api.get("/statistics/ai-insights");
        setAiInsights(res.data);
      }
    } catch (err: any) {
      console.error("Error loading statistics:", err);
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      padding: "20px"
    }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{
          background: "white",
          borderRadius: "20px",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
          padding: "40px"
        }}>
          <div style={{ marginBottom: "32px" }}>
            <Link href="/dashboard" style={{
              color: "#667eea",
              textDecoration: "none",
              fontSize: "14px",
              fontWeight: "600",
              marginBottom: "8px",
              display: "inline-block"
            }}>
              ← Volver al Dashboard
            </Link>
            <h1 style={{
              fontSize: "32px",
              fontWeight: "700",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              marginTop: "8px"
            }}>
              Estadísticas y Análisis
            </h1>
          </div>

          {/* Tabs */}
          <div style={{
            display: "flex",
            gap: "8px",
            marginBottom: "32px",
            borderBottom: "2px solid #e0e0e0",
            flexWrap: "wrap"
          }}>
            {[
              { id: "expenses", label: "Gastos por Categoría" },
              { id: "savings", label: "Ahorros" },
              { id: "income", label: "Ingresos" },
              { id: "fixed", label: "Costos Fijos" },
              { id: "ai", label: "Consejos IA" }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  padding: "12px 24px",
                  background: activeTab === tab.id ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" : "transparent",
                  color: activeTab === tab.id ? "white" : "#666",
                  border: "none",
                  borderBottom: activeTab === tab.id ? "3px solid #764ba2" : "3px solid transparent",
                  borderRadius: "8px 8px 0 0",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.3s"
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Filtros */}
          {activeTab !== "fixed" && activeTab !== "ai" && (
            <div style={{
              display: "flex",
              gap: "12px",
              marginBottom: "24px",
              flexWrap: "wrap",
              alignItems: "center"
            }}>
              {activeTab === "expenses" && (
                <>
                  <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    style={{
                      padding: "10px",
                      border: "2px solid #e0e0e0",
                      borderRadius: "8px",
                      fontSize: "14px"
                    }}
                  >
                    <option value="month">Mes</option>
                    <option value="quarter">Trimestre</option>
                    <option value="semester">Semestre</option>
                    <option value="year">Año</option>
                  </select>
                </>
              )}
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                placeholder="Año"
                style={{
                  padding: "10px",
                  border: "2px solid #e0e0e0",
                  borderRadius: "8px",
                  fontSize: "14px",
                  width: "100px"
                }}
              />
              {activeTab === "expenses" && period === "month" && (
                <select
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  style={{
                    padding: "10px",
                    border: "2px solid #e0e0e0",
                    borderRadius: "8px",
                    fontSize: "14px"
                  }}
                >
                  {monthNames.map((name, i) => (
                    <option key={i + 1} value={i + 1}>{name}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Contenido de las tabs */}
          {loading ? (
            <p>Cargando...</p>
          ) : (
            <div>
              {activeTab === "expenses" && expensesData && (
                <div>
                  <h2 style={{ marginBottom: "24px", color: "#333" }}>
                    Gastos por Categoría - {period === "month" ? monthNames[month - 1] : period} {year}
                  </h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {expensesData.data.map((cat: any, i: number) => {
                      const total = expensesData.data.reduce((sum: number, c: any) => sum + c.amountCents, 0);
                      const percentage = total > 0 ? (cat.amountCents / total) * 100 : 0;
                      return (
                        <div key={i} style={{
                          padding: "16px",
                          background: "#f8f9fa",
                          borderRadius: "12px"
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                            <div>
                              <div style={{ fontWeight: "600", color: "#333", fontSize: "16px" }}>
                                {cat.categoryName}
                              </div>
                              {cat.parentCategoryName && (
                                <div style={{ fontSize: "12px", color: "#666" }}>
                                  Subcategoría de: {cat.parentCategoryName}
                                </div>
                              )}
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontWeight: "700", color: "#e74c3c", fontSize: "18px" }}>
                                {fmtMoney(cat.amountCents, user.currencyCode)}
                              </div>
                              <div style={{ fontSize: "12px", color: "#999" }}>
                                {Math.round(percentage)}% • {cat.count} transacciones
                              </div>
                            </div>
                          </div>
                          <div style={{
                            width: "100%",
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
              )}

              {activeTab === "savings" && savingsData && (
                <div>
                  <h2 style={{ marginBottom: "24px", color: "#333" }}>Estadísticas de Ahorros - {year}</h2>
                  <div style={{
                    background: "#f8f9fa",
                    padding: "24px",
                    borderRadius: "12px",
                    marginBottom: "24px"
                  }}>
                    <h3 style={{ marginBottom: "16px", color: "#333" }}>Resumen Anual</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                      <div>
                        <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>Ingresos Totales</div>
                        <div style={{ fontSize: "24px", fontWeight: "700", color: "#27ae60" }}>
                          {fmtMoney(savingsData.summary.totalIncome, user.currencyCode)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>Gastos Totales</div>
                        <div style={{ fontSize: "24px", fontWeight: "700", color: "#e74c3c" }}>
                          {fmtMoney(savingsData.summary.totalExpenses, user.currencyCode)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>Ahorros Totales</div>
                        <div style={{ fontSize: "24px", fontWeight: "700", color: "#667eea" }}>
                          {fmtMoney(savingsData.summary.totalSavings, user.currencyCode)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>Tasa de Ahorro</div>
                        <div style={{ fontSize: "24px", fontWeight: "700", color: "#764ba2" }}>
                          {savingsData.summary.averageSavingsRate}%
                        </div>
                      </div>
                    </div>
                  </div>
                  <h3 style={{ marginBottom: "16px", color: "#333" }}>Desglose Mensual</h3>
                  <div style={{ display: "grid", gap: "12px" }}>
                    {savingsData.monthly.map((m: any) => (
                      <div key={m.month} style={{
                        padding: "16px",
                        background: m.goalAchieved ? "#d5f4e6" : "#fff2cc",
                        borderRadius: "12px",
                        borderLeft: `4px solid ${m.goalAchieved ? "#27ae60" : "#f39c12"}`
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div style={{ fontWeight: "600", color: "#333" }}>
                              {monthNames[m.month - 1]} {m.year}
                            </div>
                            <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
                              Meta: {fmtMoney(m.goalCents, user.currencyCode)} • 
                              Real: {fmtMoney(m.actualSavings, user.currencyCode)} • 
                              Tasa: {m.savingsRate}%
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
                            {m.goalAchieved ? "✓ Cumplida" : "⚠ Pendiente"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "income" && incomeData && (
                <div>
                  <h2 style={{ marginBottom: "24px", color: "#333" }}>Estadísticas de Ingresos - {year}</h2>
                  <div style={{ display: "grid", gap: "16px" }}>
                    {incomeData.monthly.map((m: any) => (
                      <div key={m.month} style={{
                        padding: "20px",
                        background: "#f8f9fa",
                        borderRadius: "12px"
                      }}>
                        <div style={{ fontWeight: "600", color: "#333", marginBottom: "12px", fontSize: "18px" }}>
                          {monthNames[m.month - 1]} {m.year}
                        </div>
                        <div style={{ fontSize: "24px", fontWeight: "700", color: "#27ae60", marginBottom: "16px" }}>
                          {fmtMoney(m.totalCents, user.currencyCode)}
                        </div>
                        {m.byCategory.length > 0 && (
                          <div>
                            <div style={{ fontSize: "14px", color: "#666", marginBottom: "8px" }}>Por categoría:</div>
                            {m.byCategory.map((cat: any, i: number) => (
                              <div key={i} style={{
                                display: "flex",
                                justifyContent: "space-between",
                                padding: "8px",
                                background: "white",
                                borderRadius: "6px",
                                marginBottom: "4px"
                              }}>
                                <span>{cat.categoryName}</span>
                                <span style={{ fontWeight: "600" }}>
                                  {fmtMoney(cat.amountCents, user.currencyCode)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "fixed" && fixedCostsData && (
                <div>
                  <h2 style={{ marginBottom: "24px", color: "#333" }}>Costos Fijos y Recurrentes</h2>
                  {fixedCostsData.recurring.length > 0 && (
                    <div style={{ marginBottom: "32px" }}>
                      <h3 style={{ marginBottom: "16px", color: "#333" }}>Transacciones Recurrentes</h3>
                      <div style={{ display: "grid", gap: "12px" }}>
                        {fixedCostsData.recurring.map((r: any, i: number) => (
                          <div key={i} style={{
                            padding: "16px",
                            background: "#f8f9fa",
                            borderRadius: "12px"
                          }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div>
                                <div style={{ fontWeight: "600", color: "#333" }}>
                                  {r.description || "Sin descripción"}
                                </div>
                                <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
                                  {r.categoryName} • Próxima: {r.nextOccurrence ? new Date(r.nextOccurrence).toLocaleDateString() : "N/A"}
                                </div>
                              </div>
                              <div style={{ fontWeight: "700", color: "#e74c3c", fontSize: "18px" }}>
                                {fmtMoney(r.amountCents, r.currencyCode || user.currencyCode)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {fixedCostsData.potentialFixed.length > 0 && (
                    <div>
                      <h3 style={{ marginBottom: "16px", color: "#333" }}>Posibles Costos Fijos (detectados automáticamente)</h3>
                      <div style={{ display: "grid", gap: "12px" }}>
                        {fixedCostsData.potentialFixed.map((pf: any, i: number) => (
                          <div key={i} style={{
                            padding: "16px",
                            background: "#fff2cc",
                            borderRadius: "12px",
                            borderLeft: "4px solid #f39c12"
                          }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div>
                                <div style={{ fontWeight: "600", color: "#333" }}>
                                  {pf.categoryName}
                                </div>
                                <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
                                  Aparece {pf.occurrences} veces • Última: {new Date(pf.lastOccurrence).toLocaleDateString()}
                                </div>
                              </div>
                              <div style={{ fontWeight: "700", color: "#e74c3c", fontSize: "18px" }}>
                                {fmtMoney(pf.amountCents, user.currencyCode)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "ai" && aiInsights && (
                <div>
                  <h2 style={{ marginBottom: "24px", color: "#333" }}>Consejos de IA Basados en tus Datos</h2>
                  <div style={{
                    background: "#f8f9fa",
                    padding: "24px",
                    borderRadius: "12px",
                    marginBottom: "24px"
                  }}>
                    <h3 style={{ marginBottom: "16px", color: "#333" }}>Resumen</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                      <div>
                        <div style={{ fontSize: "12px", color: "#666" }}>Gasto Promedio Mensual</div>
                        <div style={{ fontSize: "20px", fontWeight: "700", color: "#e74c3c" }}>
                          {fmtMoney(aiInsights.summary.avgMonthlyExpenses, user.currencyCode)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: "12px", color: "#666" }}>Ingreso Promedio Mensual</div>
                        <div style={{ fontSize: "20px", fontWeight: "700", color: "#27ae60" }}>
                          {fmtMoney(aiInsights.summary.avgMonthlyIncome, user.currencyCode)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {aiInsights.insights.map((insight: any, i: number) => (
                      <div
                        key={i}
                        style={{
                          padding: "20px",
                          background: insight.type === "warning" ? "#fee" : insight.type === "success" ? "#d5f4e6" : "#e5f5ff",
                          borderRadius: "12px",
                          borderLeft: `4px solid ${
                            insight.type === "warning" ? "#e74c3c" :
                            insight.type === "success" ? "#27ae60" : "#3498db"
                          }`
                        }}
                      >
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          marginBottom: "8px"
                        }}>
                          <div style={{
                            width: "24px",
                            height: "24px",
                            borderRadius: "50%",
                            background: insight.type === "warning" ? "#e74c3c" : insight.type === "success" ? "#27ae60" : "#3498db",
                            color: "white",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "14px",
                            fontWeight: "700"
                          }}>
                            {insight.type === "warning" ? "!" : insight.type === "success" ? "✓" : "i"}
                          </div>
                          <div style={{ fontWeight: "600", color: "#333" }}>
                            {insight.type === "warning" ? "Advertencia" : insight.type === "success" ? "¡Bien hecho!" : "Información"}
                          </div>
                        </div>
                        <div style={{ color: "#333", lineHeight: "1.6" }}>
                          {insight.message}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


