"use client";
import { useEffect, useState } from "react";
import api, { setAuthToken } from "../../lib/api";
import { useAuth } from "../../store/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

function fmtMoney(cents: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(cents / 100);
}

// Función helper para formatear fechas desde UTC correctamente
function fmtDateUTC(dateString: string | Date) {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  // Usar los valores UTC directamente para evitar problemas de zona horaria
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth(); // 0-11
  const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${monthNames[month]} de ${year}`;
}

export default function DebtsPage() {
  const { user, token, initialized, initAuth } = useAuth();
  const router = useRouter();
  const [debts, setDebts] = useState<any[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingDebt, setEditingDebt] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    description: "",
    totalAmountCents: "",
    monthlyPaymentCents: "",
    totalInstallments: "",
    paidInstallments: "0",
    startMonth: new Date().toISOString().slice(0, 7), // YYYY-MM
    currencyCode: user?.currencyCode || "USD"
  });

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
  }, [user, token, initialized, router, initAuth]);

  async function loadData() {
    setLoading(true);
    setError(undefined);
    try {
      const [debtsRes, statsRes] = await Promise.all([
        api.get("/debts"),
        api.get("/debts/statistics")
      ]);
      setDebts(debtsRes.data.debts || []);
      setStatistics(statsRes.data);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Error al cargar deudas");
      if (err?.response?.status === 401) {
        router.push("/login");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);

    try {
      const payload = {
        description: formData.description.trim(),
        totalAmountCents: Math.round(Number(formData.totalAmountCents) * 100),
        monthlyPaymentCents: Math.round(Number(formData.monthlyPaymentCents) * 100),
        totalInstallments: Number(formData.totalInstallments),
        paidInstallments: Number(formData.paidInstallments) || 0,
        startMonth: `${formData.startMonth}-01`,
        currencyCode: formData.currencyCode
      };

      if (editingDebt) {
        await api.put(`/debts/${editingDebt}`, payload);
      } else {
        await api.post("/debts", payload);
      }

      setShowCreateForm(false);
      setEditingDebt(null);
      setFormData({
        description: "",
        totalAmountCents: "",
        monthlyPaymentCents: "",
        totalInstallments: "",
        paidInstallments: "0",
        startMonth: new Date().toISOString().slice(0, 7),
        currencyCode: user?.currencyCode || "USD"
      });
      loadData();
    } catch (err: any) {
      setError(err?.response?.data?.error || "Error al guardar deuda");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Estás seguro de eliminar esta deuda? Esta acción no se puede deshacer.")) return;
    try {
      await api.delete(`/debts/${id}`);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error || "Error al eliminar deuda");
    }
  }

  function startEdit(debt: any) {
    setEditingDebt(debt.id);
    setFormData({
      description: debt.description,
      totalAmountCents: String(debt.totalAmountCents / 100),
      monthlyPaymentCents: String(debt.monthlyPaymentCents / 100),
      totalInstallments: String(debt.totalInstallments),
      paidInstallments: String(debt.paidInstallments),
      startMonth: (() => {
        // Convertir la fecha UTC a año-mes correctamente
        const date = new Date(debt.startMonth);
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
      })(),
      currencyCode: debt.currencyCode
    });
    setShowCreateForm(true);
  }

  function calculateDebtInfo(debt: any) {
    const remainingInstallments = debt.totalInstallments - debt.paidInstallments;
    const startDate = new Date(debt.startMonth);
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    // Usar UTC para evitar problemas de zona horaria
    const startMonth = new Date(Date.UTC(
      startDate.getUTCFullYear(), 
      startDate.getUTCMonth(), 
      1
    ));
    
    // Meses desde el inicio hasta hoy (usando UTC para evitar problemas de zona horaria)
    const startYear = startDate.getUTCFullYear();
    const startMonthNum = startDate.getUTCMonth(); // 0-11
    const currentYear = currentMonth.getFullYear();
    const currentMonthNum = currentMonth.getMonth(); // 0-11
    
    const monthsElapsed = Math.max(0, 
      (currentYear - startYear) * 12 + 
      (currentMonthNum - startMonthNum)
    );
    
    const monthsRemaining = Math.max(0, remainingInstallments - monthsElapsed);
    // Calcular fecha de fin usando UTC
    const endYear = startYear + Math.floor((startMonthNum + debt.totalInstallments - 1) / 12);
    const endMonth = (startMonthNum + debt.totalInstallments - 1) % 12;
    const endDate = new Date(Date.UTC(endYear, endMonth, 1));
    
    return {
      remainingInstallments,
      monthsRemaining,
      endDate,
      isActive: remainingInstallments > 0,
      progress: debt.totalInstallments > 0 ? (debt.paidInstallments / debt.totalInstallments) * 100 : 0
    };
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
              fontSize: "28px",
              fontWeight: "700",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              marginTop: "4px"
            }}>
              Gestión de Deudas
            </h1>
          </div>
          <button
            onClick={() => {
              setShowCreateForm(!showCreateForm);
              if (showCreateForm) {
                setEditingDebt(null);
                setFormData({
                  description: "",
                  totalAmountCents: "",
                  monthlyPaymentCents: "",
                  totalInstallments: "",
                  paidInstallments: "0",
                  startMonth: new Date().toISOString().slice(0, 7),
                  currencyCode: user?.currencyCode || "USD"
                });
              }
            }}
            style={{
              padding: "10px 20px",
              background: showCreateForm ? "#e74c3c" : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer"
            }}
          >
            {showCreateForm ? "Cancelar" : "+ Nueva Deuda"}
          </button>
        </div>

        {error && (
          <div style={{
            background: "#fee",
            color: "#e74c3c",
            padding: "16px",
            borderRadius: "12px",
            marginBottom: "24px",
            borderLeft: "4px solid #e74c3c"
          }}>
            {error}
          </div>
        )}

        {/* Statistics */}
        {statistics && (
          <div style={{
            background: "white",
            borderRadius: "16px",
            padding: "24px",
            marginBottom: "24px",
            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "20px"
          }}>
            <div>
              <div style={{ fontSize: "14px", color: "#666", marginBottom: "4px" }}>Total Mensual</div>
              <div style={{ fontSize: "24px", fontWeight: "700", color: "#e74c3c" }}>
                {fmtMoney(statistics.totalMonthlyPayment, user?.currencyCode || "USD")}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "14px", color: "#666", marginBottom: "4px" }}>Duración Promedio</div>
              <div style={{ fontSize: "24px", fontWeight: "700", color: "#667eea" }}>
                {statistics.averageDuration.toFixed(1)} meses
              </div>
            </div>
            <div>
              <div style={{ fontSize: "14px", color: "#666", marginBottom: "4px" }}>Deudas Activas</div>
              <div style={{ fontSize: "24px", fontWeight: "700", color: "#333" }}>
                {statistics.activeDebts} / {statistics.totalDebts}
              </div>
            </div>
            {statistics.latestEndDate && (
              <div>
                <div style={{ fontSize: "14px", color: "#666", marginBottom: "4px" }}>Liberación Estimada</div>
                <div style={{ fontSize: "24px", fontWeight: "700", color: "#27ae60" }}>
                  {new Date(statistics.latestEndDate).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Create/Edit Form */}
        {showCreateForm && (
          <div style={{
            background: "white",
            borderRadius: "16px",
            padding: "24px",
            marginBottom: "24px",
            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)"
          }}>
            <h2 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "20px" }}>
              {editingDebt ? "Editar Deuda" : "Nueva Deuda"}
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "16px", marginBottom: "16px" }}>
                <div>
                  <label htmlFor="debt-description" style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px" }}>
                    Descripción *
                  </label>
                  <input
                    id="debt-description"
                    name="debt-description"
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                    placeholder="Ej: Préstamo personal, Tarjeta de crédito"
                    style={{
                      width: "100%",
                      padding: "12px",
                      border: "2px solid #e0e0e0",
                      borderRadius: "8px",
                      fontSize: "14px"
                    }}
                  />
                </div>
                <div>
                  <label htmlFor="debt-total-amount" style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px" }}>
                    Monto Total *
                  </label>
                  <input
                    id="debt-total-amount"
                    name="debt-total-amount"
                    type="number"
                    step="0.01"
                    value={formData.totalAmountCents}
                    onChange={(e) => setFormData({ ...formData, totalAmountCents: e.target.value })}
                    required
                    min="0"
                    style={{
                      width: "100%",
                      padding: "12px",
                      border: "2px solid #e0e0e0",
                      borderRadius: "8px",
                      fontSize: "14px"
                    }}
                  />
                </div>
                <div>
                  <label htmlFor="debt-monthly-payment" style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px" }}>
                    Cuota Mensual *
                  </label>
                  <input
                    id="debt-monthly-payment"
                    name="debt-monthly-payment"
                    type="number"
                    step="0.01"
                    value={formData.monthlyPaymentCents}
                    onChange={(e) => setFormData({ ...formData, monthlyPaymentCents: e.target.value })}
                    required
                    min="0"
                    style={{
                      width: "100%",
                      padding: "12px",
                      border: "2px solid #e0e0e0",
                      borderRadius: "8px",
                      fontSize: "14px"
                    }}
                  />
                </div>
                <div>
                  <label htmlFor="debt-total-installments" style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px" }}>
                    Total de Cuotas *
                  </label>
                  <input
                    id="debt-total-installments"
                    name="debt-total-installments"
                    type="number"
                    value={formData.totalInstallments}
                    onChange={(e) => setFormData({ ...formData, totalInstallments: e.target.value })}
                    required
                    min="1"
                    style={{
                      width: "100%",
                      padding: "12px",
                      border: "2px solid #e0e0e0",
                      borderRadius: "8px",
                      fontSize: "14px"
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px" }}>
                    Cuotas Pagadas
                  </label>
                  <input
                    type="number"
                    value={formData.paidInstallments}
                    onChange={(e) => setFormData({ ...formData, paidInstallments: e.target.value })}
                    min="0"
                    max={formData.totalInstallments || 999}
                    style={{
                      width: "100%",
                      padding: "12px",
                      border: "2px solid #e0e0e0",
                      borderRadius: "8px",
                      fontSize: "14px"
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px" }}>
                    Mes de Inicio *
                  </label>
                  <input
                    type="month"
                    value={formData.startMonth}
                    onChange={(e) => setFormData({ ...formData, startMonth: e.target.value })}
                    required
                    style={{
                      width: "100%",
                      padding: "12px",
                      border: "2px solid #e0e0e0",
                      borderRadius: "8px",
                      fontSize: "14px"
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px" }}>
                    Moneda
                  </label>
                  <select
                    value={formData.currencyCode}
                    onChange={(e) => setFormData({ ...formData, currencyCode: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "12px",
                      border: "2px solid #e0e0e0",
                      borderRadius: "8px",
                      fontSize: "14px"
                    }}
                  >
                    <option value="USD">USD</option>
                    <option value="UYU">UYU</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  type="submit"
                  style={{
                    padding: "12px 24px",
                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: "600",
                    cursor: "pointer"
                  }}
                >
                  {editingDebt ? "Actualizar" : "Crear Deuda"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setEditingDebt(null);
                  }}
                  style={{
                    padding: "12px 24px",
                    background: "#f0f0f0",
                    color: "#333",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: "600",
                    cursor: "pointer"
                  }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Debts List */}
        <div style={{
          background: "white",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)"
        }}>
          <h2 style={{ fontSize: "22px", fontWeight: "700", marginBottom: "20px" }}>
            Mis Deudas
          </h2>
          {debts.length === 0 ? (
            <p style={{ color: "#666", textAlign: "center", padding: "40px" }}>
              No hay deudas registradas. Crea una nueva deuda para comenzar.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Deudas activas primero */}
              {debts
                .filter((debt: any) => {
                  const info = calculateDebtInfo(debt);
                  return info.isActive;
                })
                .map((debt: any) => {
                  const info = calculateDebtInfo(debt);
                  return (
                    <div key={debt.id} style={{
                      padding: "20px",
                      background: "#fff5f5",
                      borderRadius: "12px",
                      border: "2px solid #e74c3c",
                      borderLeftWidth: "4px"
                    }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "12px" }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#333", marginBottom: "8px" }}>
                          {debt.description}
                        </h3>
                        <div style={{ fontSize: "14px", color: "#666", marginBottom: "8px" }}>
                          <div><strong>Cuota mensual:</strong> {fmtMoney(debt.monthlyPaymentCents, debt.currencyCode)}</div>
                          <div><strong>Total:</strong> {fmtMoney(debt.totalAmountCents, debt.currencyCode)}</div>
                          <div><strong>Inicio:</strong> {fmtDateUTC(debt.startMonth)}</div>
                          {info.isActive ? (
                            <>
                              <div><strong>Cuotas restantes:</strong> {info.remainingInstallments}</div>
                              <div><strong>Meses restantes:</strong> {info.monthsRemaining}</div>
                              <div><strong>Fin estimado:</strong> {fmtDateUTC(info.endDate)}</div>
                            </>
                          ) : (
                            <div style={{ color: "#27ae60", fontWeight: "600" }}>✓ Deuda completada</div>
                          )}
                        </div>
                        {info.isActive && (
                          <div style={{ marginTop: "12px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "14px" }}>
                              <span>Progreso: {debt.paidInstallments} / {debt.totalInstallments} cuotas</span>
                              <span style={{ fontWeight: "600" }}>{Math.round(info.progress)}%</span>
                            </div>
                            <div style={{
                              width: "100%",
                              height: "8px",
                              background: "#e0e0e0",
                              borderRadius: "4px",
                              overflow: "hidden"
                            }}>
                              <div style={{
                                width: `${info.progress}%`,
                                height: "100%",
                                background: info.progress >= 100 ? "#27ae60" : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                transition: "width 0.3s"
                              }} />
                            </div>
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: "8px", flexDirection: "column" }}>
                        <button
                          onClick={() => startEdit(debt)}
                          style={{
                            padding: "8px 16px",
                            background: "#667eea",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: "600",
                            cursor: "pointer"
                          }}
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(debt.id)}
                          style={{
                            padding: "8px 16px",
                            background: "#e74c3c",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: "600",
                            cursor: "pointer"
                          }}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {/* Deudas completadas después */}
              {debts
                .filter((debt: any) => {
                  const info = calculateDebtInfo(debt);
                  return !info.isActive;
                })
                .map((debt: any) => {
                  const info = calculateDebtInfo(debt);
                  return (
                    <div key={debt.id} style={{
                      padding: "20px",
                      background: "#f0f9ff",
                      borderRadius: "12px",
                      border: "2px solid #27ae60",
                      borderLeftWidth: "4px",
                      opacity: 0.8
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "12px" }}>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#333", marginBottom: "8px" }}>
                            {debt.description} <span style={{ color: "#27ae60", fontSize: "14px" }}>✓ Completada</span>
                          </h3>
                          <div style={{ fontSize: "14px", color: "#666", marginBottom: "8px" }}>
                            <div><strong>Cuota mensual:</strong> {fmtMoney(debt.monthlyPaymentCents, debt.currencyCode)}</div>
                            <div><strong>Total:</strong> {fmtMoney(debt.totalAmountCents, debt.currencyCode)}</div>
                            <div><strong>Inicio:</strong> {fmtDateUTC(debt.startMonth)}</div>
                            <div><strong>Completada:</strong> {fmtDateUTC(info.endDate)}</div>
                            <div style={{ color: "#27ae60", fontWeight: "600", marginTop: "8px" }}>✓ Todas las cuotas pagadas</div>
                          </div>
                          <div style={{ marginTop: "12px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "14px" }}>
                              <span>Progreso: {debt.paidInstallments} / {debt.totalInstallments} cuotas</span>
                              <span style={{ fontWeight: "600" }}>100%</span>
                            </div>
                            <div style={{
                              width: "100%",
                              height: "8px",
                              background: "#e0e0e0",
                              borderRadius: "4px",
                              overflow: "hidden"
                            }}>
                              <div style={{
                                width: "100%",
                                height: "100%",
                                background: "#27ae60",
                                transition: "width 0.3s"
                              }} />
                            </div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "8px", flexDirection: "column" }}>
                          <button
                            onClick={() => startEdit(debt)}
                            style={{
                              padding: "8px 16px",
                              background: "#667eea",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: "600",
                              cursor: "pointer"
                            }}
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDelete(debt.id)}
                            style={{
                              padding: "8px 16px",
                              background: "#e74c3c",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: "600",
                              cursor: "pointer"
                            }}
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

