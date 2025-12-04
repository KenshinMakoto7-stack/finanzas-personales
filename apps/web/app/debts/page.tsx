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
  const [debtTypeFilter, setDebtTypeFilter] = useState<"ALL" | "CREDIT" | "OTHER">("ALL");
  const [debtStatusFilter, setDebtStatusFilter] = useState<"ALL" | "ACTIVE" | "COMPLETED">("ALL");
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);
  const [showExchangeConfirmation, setShowExchangeConfirmation] = useState(false);
  const [globalExchangeRate, setGlobalExchangeRate] = useState<number | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    description: "",
    totalAmountCents: "",
    monthlyPaymentCents: "",
    totalInstallments: "",
    paidInstallments: "0",
    startMonth: new Date().toISOString().slice(0, 7), // YYYY-MM
    currencyCode: "USD" // Se actualizará cuando user esté disponible
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
    // Actualizar currencyCode cuando user esté disponible
    if (user?.currencyCode && formData.currencyCode !== user.currencyCode) {
      setFormData(prev => ({ ...prev, currencyCode: user.currencyCode }));
    }
    loadData();
  }, [user, token, initialized, router, initAuth]);

  async function loadData() {
    setLoading(true);
    setError(undefined);
    try {
      const [debtsRes, statsRes, accountsRes, exchangeRes] = await Promise.all([
        api.get(`/debts${debtTypeFilter !== "ALL" ? `?type=${debtTypeFilter}` : ""}`),
        api.get("/debts/statistics"),
        api.get("/accounts"),
        api.get("/exchange/rate").catch(() => ({ data: { rate: null } }))
      ]);
      setDebts(debtsRes.data.debts || []);
      setStatistics(statsRes.data);
      setAccounts(accountsRes.data.accounts || []);
      setGlobalExchangeRate(exchangeRes.data.rate);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Error al cargar deudas");
      if (err?.response?.status === 401) {
        router.push("/login");
      }
    } finally {
      setLoading(false);
    }
  }
  
  const checkExchangeRate = async (debt: any, account: any) => {
    try {
      const res = await api.get("/exchange/rate");
      const rate = res.data.rate;
      setExchangeRate(rate);
      
      // Calcular monto convertido
      const debtAmount = debt.monthlyPaymentCents / 100;
      let converted: number;
      if (debt.currencyCode === "USD" && account.currencyCode === "UYU") {
        converted = debtAmount * rate;
      } else if (debt.currencyCode === "UYU" && account.currencyCode === "USD") {
        converted = debtAmount / rate;
      } else {
        converted = debtAmount; // Misma moneda o no soportada
      }
      setConvertedAmount(converted);
    } catch (err) {
      console.error("Error obteniendo tipo de cambio:", err);
      setExchangeRate(null);
      setConvertedAmount(null);
    }
  };

  const handleMarkAsPaid = async (debt: any) => {
    setSelectedDebt(debt);
    setPaymentAmount((debt.monthlyPaymentCents / 100).toFixed(2));
    setPaymentAccountId(accounts.length > 0 ? accounts[0].id : "");
    setExchangeRate(null);
    setConvertedAmount(null);
    setShowExchangeConfirmation(false);
    setShowMarkPaidModal(true);
    
    // Si hay cuenta seleccionada, verificar si necesita conversión
    if (accounts.length > 0) {
      const selectedAccount = accounts[0];
      if (selectedAccount.currencyCode !== debt.currencyCode) {
        await checkExchangeRate(debt, selectedAccount);
      }
    }
  };
  
  const confirmMarkAsPaid = async () => {
    if (!selectedDebt) return;
    
    // Si hay conversión de moneda y no se ha confirmado, mostrar confirmación
    if (exchangeRate && convertedAmount !== null && !showExchangeConfirmation) {
      setShowExchangeConfirmation(true);
      return;
    }
    
    try {
      const selectedAccount = accounts.find(acc => acc.id === paymentAccountId);
      const needsConversion = selectedAccount && selectedAccount.currencyCode !== selectedDebt.currencyCode;
      
      // El monto a enviar es el que se pagará de la cuenta (convertido si aplica)
      // IMPORTANTE: Si hay conversión, convertedAmount ya está en la moneda de destino (ej: UYU)
      // y debe multiplicarse por 100 para convertir a centavos
      let amountCents: number;
      if (needsConversion && convertedAmount !== null && exchangeRate) {
        // Usar el monto convertido (ya está en la moneda de destino)
        amountCents = Math.round(convertedAmount * 100);
      } else if (needsConversion && exchangeRate) {
        // Si convertedAmount es null pero hay conversión, calcularlo ahora
        const debtAmount = Number(paymentAmount);
        if (selectedDebt.currencyCode === "USD" && selectedAccount.currencyCode === "UYU") {
          amountCents = Math.round(debtAmount * exchangeRate * 100);
        } else if (selectedDebt.currencyCode === "UYU" && selectedAccount.currencyCode === "USD") {
          amountCents = Math.round((debtAmount / exchangeRate) * 100);
        } else {
          amountCents = Math.round(debtAmount * 100);
        }
      } else {
        // Sin conversión, usar monto original
        amountCents = Math.round(Number(paymentAmount) * 100);
      }
      
      // Normalizar la fecha actual al inicio del día en UTC para evitar problemas de zona horaria
      const now = new Date();
      const normalizedDate = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0, 0, 0, 0
      ));
      
      const payload: any = {
        amountCents,
        accountId: paymentAccountId || undefined,
        occurredAt: normalizedDate.toISOString(),
        currencyCode: selectedAccount?.currencyCode || selectedDebt.currencyCode
      };
      
      // Si hay conversión, enviar información de auditoría
      if (needsConversion && exchangeRate) {
        payload.exchangeRate = exchangeRate;
        payload.originalAmountCents = Math.round(Number(paymentAmount) * 100);
        payload.originalCurrencyCode = selectedDebt.currencyCode;
      }
      
      await api.post(`/debts/${selectedDebt.id}/mark-paid`, payload);
      
      setShowMarkPaidModal(false);
      setSelectedDebt(null);
      setPaymentAmount("");
      setPaymentAccountId("");
      setExchangeRate(null);
      setConvertedAmount(null);
      setShowExchangeConfirmation(false);
      loadData();
    } catch (err: any) {
      setError(err?.response?.data?.error || "Error al registrar el pago");
    }
  };
  
  useEffect(() => {
    if (user && token) {
      loadData();
    }
  }, [debtTypeFilter, debtStatusFilter, user, token]);

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
        background: "var(--color-bg-primary, #FAFBFC)"
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
              background: "var(--color-primary, #4F46E5)",
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
              background: "var(--color-bg-primary, #FAFBFC)",
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
              background: showCreateForm ? "var(--color-expense, #B45309)" : "var(--color-primary, #4F46E5)",
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
              color: "var(--color-expense, #B45309)",
            padding: "16px",
            borderRadius: "12px",
            marginBottom: "24px",
            borderLeft: "4px solid var(--color-expense, #B45309)"
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
              <div className="secondary-number" style={{ color: "var(--color-expense, #B45309)" }}>
                {fmtMoney(statistics.totalMonthlyPayment, statistics.baseCurrency || user?.currencyCode || "USD")}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "14px", color: "#666", marginBottom: "4px" }}>Duración Promedio</div>
              <div className="secondary-number" style={{ color: "var(--color-primary, #4F46E5)" }}>
                {statistics.averageDuration.toFixed(1)} meses
              </div>
            </div>
            <div>
              <div style={{ fontSize: "14px", color: "#666", marginBottom: "4px" }}>Deudas Activas</div>
              <div style={{ fontSize: "24px", fontWeight: "700", color: "#333" }}>
                {statistics.activeDebts} / {statistics.totalDebts}
              </div>
            </div>
            {statistics.completedDebts !== undefined && (
              <div>
                <div style={{ fontSize: "14px", color: "#666", marginBottom: "4px" }}>Deudas Completadas</div>
                <div className="secondary-number" style={{ color: "var(--color-income, #059669)" }}>
                  {statistics.completedDebts}
                </div>
              </div>
            )}
            {statistics.completionRate !== undefined && (
              <div>
                <div style={{ fontSize: "14px", color: "#666", marginBottom: "4px" }}>Tasa de Finalización</div>
                <div className="secondary-number" style={{ color: "var(--color-primary, #4F46E5)" }}>
                  {statistics.completionRate.toFixed(1)}%
                </div>
              </div>
            )}
            {statistics.averageTimeToComplete !== undefined && statistics.averageTimeToComplete > 0 && (
              <div>
                <div style={{ fontSize: "14px", color: "#666", marginBottom: "4px" }}>Tiempo Promedio</div>
                <div style={{ fontSize: "24px", fontWeight: "700", color: "#f59e0b" }}>
                  {statistics.averageTimeToComplete.toFixed(1)} meses
                </div>
              </div>
            )}
            {statistics.latestEndDate && (
              <div>
                <div style={{ fontSize: "14px", color: "#666", marginBottom: "4px" }}>Liberación Estimada</div>
                <div className="secondary-number" style={{ color: "var(--color-income, #059669)" }}>
                  {fmtDateUTC(statistics.latestEndDate)}
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
                    background: "var(--color-primary, #4F46E5)",
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
          <div style={{ marginBottom: "20px" }}>
            <h2 style={{ fontSize: "22px", fontWeight: "700", marginBottom: "16px" }}>
              Mis Deudas
            </h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#666", marginRight: "8px", alignSelf: "center" }}>Tipo:</span>
              <button
                onClick={() => setDebtTypeFilter("ALL")}
                style={{
                  padding: "8px 16px",
                  background: debtTypeFilter === "ALL" ? "var(--color-primary, #4F46E5)" : "var(--color-bg-secondary, #F8F9FA)",
                  color: debtTypeFilter === "ALL" ? "white" : "var(--color-text-primary, #111827)",
                  border: debtTypeFilter === "ALL" ? "none" : "1px solid var(--color-border, #E5E7EB)",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer"
                }}
              >
                Todas
              </button>
              <button
                onClick={() => setDebtTypeFilter("CREDIT")}
                style={{
                  padding: "8px 16px",
                  background: debtTypeFilter === "CREDIT" ? "var(--color-primary, #4F46E5)" : "var(--color-bg-secondary, #F8F9FA)",
                  color: debtTypeFilter === "CREDIT" ? "white" : "var(--color-text-primary, #111827)",
                  border: debtTypeFilter === "CREDIT" ? "none" : "1px solid var(--color-border, #E5E7EB)",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer"
                }}
              >
                Crédito
              </button>
              <button
                onClick={() => setDebtTypeFilter("OTHER")}
                style={{
                  padding: "8px 16px",
                  background: debtTypeFilter === "OTHER" ? "var(--color-primary, #4F46E5)" : "var(--color-bg-secondary, #F8F9FA)",
                  color: debtTypeFilter === "OTHER" ? "white" : "var(--color-text-primary, #111827)",
                  border: debtTypeFilter === "OTHER" ? "none" : "1px solid var(--color-border, #E5E7EB)",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer"
                }}
              >
                Otros
              </button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#666", marginRight: "8px", alignSelf: "center" }}>Estado:</span>
              <button
                onClick={() => setDebtStatusFilter("ALL")}
                style={{
                  padding: "8px 16px",
                  background: debtStatusFilter === "ALL" ? "var(--color-primary, #4F46E5)" : "var(--color-bg-secondary, #F8F9FA)",
                  color: debtStatusFilter === "ALL" ? "white" : "var(--color-text-primary, #111827)",
                  border: debtStatusFilter === "ALL" ? "none" : "1px solid var(--color-border, #E5E7EB)",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer"
                }}
              >
                Todas
              </button>
              <button
                onClick={() => setDebtStatusFilter("ACTIVE")}
                style={{
                  padding: "8px 16px",
                  background: debtStatusFilter === "ACTIVE" ? "var(--color-primary, #4F46E5)" : "var(--color-bg-secondary, #F8F9FA)",
                  color: debtStatusFilter === "ACTIVE" ? "white" : "var(--color-text-primary, #111827)",
                  border: debtStatusFilter === "ACTIVE" ? "none" : "1px solid var(--color-border, #E5E7EB)",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer"
                }}
              >
                Activas
              </button>
              <button
                onClick={() => setDebtStatusFilter("COMPLETED")}
                style={{
                  padding: "8px 16px",
                  background: debtStatusFilter === "COMPLETED" ? "var(--color-primary, #4F46E5)" : "var(--color-bg-secondary, #F8F9FA)",
                  color: debtStatusFilter === "COMPLETED" ? "white" : "var(--color-text-primary, #111827)",
                  border: debtStatusFilter === "COMPLETED" ? "none" : "1px solid var(--color-border, #E5E7EB)",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer"
                }}
              >
                Completadas
              </button>
            </div>
          </div>
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
                  // Aplicar filtro de estado
                  if (debtStatusFilter === "ACTIVE" && !info.isActive) return false;
                  if (debtStatusFilter === "COMPLETED" && info.isActive) return false;
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
                          {debt.debtType === "CREDIT" && (
                            <span style={{
                              marginLeft: "8px",
                              padding: "4px 8px",
                              background: "#e74c3c",
                              color: "white",
                              borderRadius: "4px",
                              fontSize: "12px",
                              fontWeight: "600"
                            }}>
                              Crédito
                            </span>
                          )}
                        </h3>
                        <div style={{ fontSize: "14px", color: "#666", marginBottom: "8px" }}>
                          <div><strong>Cuota mensual:</strong> {fmtMoney(debt.monthlyPaymentCents, debt.currencyCode)}
                            {debt.currencyCode === "USD" && user?.currencyCode === "UYU" && globalExchangeRate && (
                              <span style={{ color: "#856404", marginLeft: "4px" }}>
                                ({fmtMoney(Math.round((debt.monthlyPaymentCents / 100) * globalExchangeRate * 100), "UYU")})
                              </span>
                            )}
                          </div>
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
                                background: info.progress >= 100 ? "var(--color-income, #059669)" : "var(--color-primary, #4F46E5)",
                                transition: "width 0.3s"
                              }} />
                            </div>
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: "8px", flexDirection: "column" }}>
                        <button
                          onClick={() => handleMarkAsPaid(debt)}
                          style={{
                            padding: "8px 16px",
                            background: "#27ae60",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: "600",
                            cursor: "pointer"
                          }}
                        >
                          Marcar como Pagada
                        </button>
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
                  // Aplicar filtro de estado
                  if (debtStatusFilter === "ACTIVE") return false;
                  if (debtStatusFilter === "COMPLETED" && info.isActive) return false;
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
        
        {/* Modal de Confirmación de Pago */}
        {showMarkPaidModal && selectedDebt && (
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
            padding: "20px"
          }}>
            <div style={{
              background: "white",
              borderRadius: "16px",
              padding: "24px",
              maxWidth: "500px",
              width: "100%",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)"
            }}>
              <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "16px" }}>
                Confirmar Pago de Cuota
              </h3>
              <div style={{ marginBottom: "16px" }}>
                <p style={{ fontSize: "14px", color: "#666", marginBottom: "8px" }}>
                  <strong>Deuda:</strong> {selectedDebt.description}
                </p>
                <p style={{ fontSize: "14px", color: "#666", marginBottom: "8px" }}>
                  <strong>Cuota mensual:</strong> {fmtMoney(selectedDebt.monthlyPaymentCents, selectedDebt.currencyCode)}
                </p>
              </div>
              
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px" }}>
                  Monto a pagar *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "2px solid #e0e0e0",
                    borderRadius: "8px",
                    fontSize: "14px"
                  }}
                />
              </div>
              
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px" }}>
                  Cuenta
                </label>
                <select
                  value={paymentAccountId}
                  onChange={async (e) => {
                    setPaymentAccountId(e.target.value);
                    const selectedAccount = accounts.find(acc => acc.id === e.target.value);
                    if (selectedAccount && selectedDebt && selectedAccount.currencyCode !== selectedDebt.currencyCode) {
                      await checkExchangeRate(selectedDebt, selectedAccount);
                    } else {
                      setExchangeRate(null);
                      setConvertedAmount(null);
                      setShowExchangeConfirmation(false);
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "2px solid #e0e0e0",
                    borderRadius: "8px",
                    fontSize: "14px",
                    background: "white",
                    cursor: "pointer"
                  }}
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.currencyCode})
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Mostrar información de conversión si aplica */}
              {exchangeRate && convertedAmount !== null && selectedDebt && (
                <div style={{
                  padding: "12px",
                  background: "#fff3cd",
                  borderRadius: "8px",
                  fontSize: "13px",
                  color: "#856404",
                  marginBottom: "16px",
                  border: "1px solid #ffc107"
                }}>
                  <div style={{ marginBottom: "8px", fontWeight: "600" }}>
                    💱 Conversión de Moneda
                  </div>
                  <div style={{ marginBottom: "4px" }}>
                    <strong>Monto original:</strong> {fmtMoney(selectedDebt.monthlyPaymentCents, selectedDebt.currencyCode)}
                  </div>
                  <div style={{ marginBottom: "4px" }}>
                    <strong>Tipo de cambio:</strong> {exchangeRate.toFixed(2)} ({selectedDebt.currencyCode} → {accounts.find(acc => acc.id === paymentAccountId)?.currencyCode})
                  </div>
                  <div style={{ marginBottom: "4px", fontWeight: "600", color: "#d32f2f" }}>
                    <strong>Monto a pagar:</strong> {fmtMoney(Math.round(convertedAmount * 100), accounts.find(acc => acc.id === paymentAccountId)?.currencyCode || selectedDebt.currencyCode)}
                  </div>
                  {!showExchangeConfirmation && (
                    <div style={{ marginTop: "8px", fontSize: "12px", fontStyle: "italic" }}>
                      ⚠️ Se descontará el monto convertido de tu cuenta. La deuda se registrará en su moneda original ({selectedDebt.currencyCode}).
                    </div>
                  )}
                </div>
              )}
              
              {/* Confirmación de conversión */}
              {showExchangeConfirmation && exchangeRate && convertedAmount !== null && (
                <div style={{
                  padding: "12px",
                  background: "#ffebee",
                  borderRadius: "8px",
                  fontSize: "13px",
                  color: "#c62828",
                  marginBottom: "16px",
                  border: "1px solid #f44336"
                }}>
                  <div style={{ marginBottom: "8px", fontWeight: "600" }}>
                    ⚠️ Confirmar Conversión de Moneda
                  </div>
                  <div style={{ marginBottom: "4px" }}>
                    Se descontarán <strong>{fmtMoney(Math.round(convertedAmount * 100), accounts.find(acc => acc.id === paymentAccountId)?.currencyCode || "UYU")}</strong> de tu cuenta.
                  </div>
                  <div style={{ marginBottom: "4px" }}>
                    La deuda se registrará como pago de <strong>{fmtMoney(selectedDebt.monthlyPaymentCents, selectedDebt.currencyCode)}</strong>.
                  </div>
                  <div style={{ fontSize: "12px", fontStyle: "italic", marginTop: "8px" }}>
                    Tipo de cambio usado: {exchangeRate.toFixed(2)}
                  </div>
                </div>
              )}
              
              <div style={{
                padding: "12px",
                background: "#e8f5e9",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#2e7d32",
                marginBottom: "16px"
              }}>
                ✅ Se creará una transacción de gasto automáticamente
              </div>
              
              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  onClick={confirmMarkAsPaid}
                  style={{
                    flex: 1,
                    padding: "12px 24px",
                    background: showExchangeConfirmation ? "#d32f2f" : "#27ae60",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: "600",
                    cursor: "pointer"
                  }}
                >
                  {showExchangeConfirmation ? "Confirmar con Conversión" : "Confirmar Pago"}
                </button>
                <button
                  onClick={() => {
                    setShowMarkPaidModal(false);
                    setSelectedDebt(null);
                    setPaymentAmount("");
                    setPaymentAccountId("");
                    setExchangeRate(null);
                    setConvertedAmount(null);
                    setShowExchangeConfirmation(false);
                  }}
                  style={{
                    flex: 1,
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

