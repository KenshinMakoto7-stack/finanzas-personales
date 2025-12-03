"use client";
import { useEffect, useState } from "react";
import api, { setAuthToken } from "../../lib/api";
import { useAuth } from "../../store/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

function fmtMoney(cents: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(cents / 100);
}

export default function RecurringPage() {
  const { user, token, initialized, initAuth } = useAuth();
  const router = useRouter();
  const [recurringTransactions, setRecurringTransactions] = useState<any[]>([]);
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
    loadRecurring();
  }, [user, token, initialized, router, initAuth]);

  async function loadRecurring() {
    setLoading(true);
    setError(undefined);
    try {
      const res = await api.get("/transactions?isRecurring=true&pageSize=100");
      setRecurringTransactions(res.data.transactions || []);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Error al cargar transacciones recurrentes");
      if (err?.response?.status === 401) {
        router.push("/login");
      }
    } finally {
      setLoading(false);
    }
  }

  async function confirmPayment(tx: any) {
    if (!confirm(`¿Confirmar pago de ${fmtMoney(tx.amountCents, tx.currencyCode)} para "${tx.description || tx.category?.name}"?`)) {
      return;
    }

    try {
      // Crear nueva transacción con fecha de hoy
      const today = new Date().toISOString().slice(0, 16);
      await api.post("/transactions", {
        accountId: tx.accountId,
        categoryId: tx.categoryId,
        type: tx.type,
        amountCents: tx.amountCents,
        currencyCode: tx.currencyCode,
        occurredAt: new Date(today).toISOString(),
        description: tx.description || `Pago recurrente: ${tx.category?.name}`,
        isRecurring: false // Esta instancia no es recurrente
      });

      // Actualizar la transacción recurrente: marcar como no pagada (para próxima ocurrencia) y decrementar ocurrencias
      const updateData: any = { isPaid: false }; // Resetear para próxima ocurrencia
      if (tx.remainingOccurrences !== null && tx.remainingOccurrences > 0) {
        updateData.remainingOccurrences = tx.remainingOccurrences - 1;
        // Calcular próxima ocurrencia
        const nextDate = new Date();
        if (tx.recurringRule) {
          const rule = JSON.parse(tx.recurringRule);
          if (rule.type === "daily") nextDate.setDate(nextDate.getDate() + 1);
          else if (rule.type === "weekly") nextDate.setDate(nextDate.getDate() + 7);
          else if (rule.type === "monthly") nextDate.setMonth(nextDate.getMonth() + 1);
        }
        updateData.nextOccurrence = nextDate.toISOString();
      } else if (tx.remainingOccurrences === null) {
        // Indefinido: solo actualizar próxima ocurrencia
        const nextDate = new Date();
        if (tx.recurringRule) {
          const rule = JSON.parse(tx.recurringRule);
          if (rule.type === "daily") nextDate.setDate(nextDate.getDate() + 1);
          else if (rule.type === "weekly") nextDate.setDate(nextDate.getDate() + 7);
          else if (rule.type === "monthly") nextDate.setMonth(nextDate.getMonth() + 1);
        }
        updateData.nextOccurrence = nextDate.toISOString();
      }

      await api.put(`/transactions/${tx.id}`, updateData);
      loadRecurring();
      alert("Pago confirmado y registrado");
    } catch (err: any) {
      alert(err?.response?.data?.error || "Error al confirmar pago");
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

  const expenses = recurringTransactions.filter(t => t.type === "EXPENSE");
  const incomes = recurringTransactions.filter(t => t.type === "INCOME");

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--color-primary, #4F46E5)",
      padding: "20px"
    }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
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
              Deudas y Recurrentes
            </h1>
          </div>
          <Link href="/transactions/new">
            <button style={{
              padding: "10px 20px",
              background: "var(--color-bg-primary, #FAFBFC)",
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

        {/* Gastos Recurrentes */}
        <div style={{
          background: "white",
          borderRadius: "16px",
          padding: "24px",
          marginBottom: "24px",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)"
        }}>
          <h2 style={{ fontSize: "22px", fontWeight: "700", marginBottom: "20px", color: "#333" }}>
            Gastos Recurrentes (Deudas)
          </h2>
          {expenses.length === 0 ? (
            <p style={{ color: "#666", textAlign: "center", padding: "40px" }}>
              No hay gastos recurrentes registrados
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {expenses.map((tx: any) => {
                const rule = tx.recurringRule ? JSON.parse(tx.recurringRule) : { type: "monthly" };
                const ruleLabels: Record<string, string> = { daily: "Diario", weekly: "Semanal", monthly: "Mensual" };
                const isIndefinite = tx.totalOccurrences === null;
                const paidCount = tx.totalOccurrences && tx.remainingOccurrences !== null
                  ? tx.totalOccurrences - tx.remainingOccurrences
                  : 0;
                const progress = tx.totalOccurrences && tx.totalOccurrences > 0
                  ? (paidCount / tx.totalOccurrences) * 100
                  : 0;

                return (
                  <div key={tx.id} style={{
                    padding: "20px",
                    background: tx.isPaid ? "#f0f9ff" : "#fff5f5",
                    borderRadius: "12px",
                    border: `2px solid ${tx.isPaid ? "#27ae60" : "#e74c3c"}`,
                    borderLeftWidth: "4px"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "12px" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                          <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#333", margin: 0 }}>
                            {tx.description || tx.category?.name || "Sin descripción"}
                          </h3>
                          <span style={{
                            padding: "4px 8px",
                            background: tx.isPaid ? "#27ae60" : "#e74c3c",
                            color: "white",
                            borderRadius: "4px",
                            fontSize: "12px",
                            fontWeight: "600"
                          }}>
                            {tx.isPaid ? "✓ Pagado" : "Pendiente"}
                          </span>
                        </div>
                        <div style={{ fontSize: "14px", color: "#666", marginBottom: "8px" }}>
                          <div><strong>Monto:</strong> {fmtMoney(tx.amountCents, tx.currencyCode)}</div>
                          <div><strong>Frecuencia:</strong> {ruleLabels[rule.type] || rule.type}</div>
                          <div><strong>Próxima fecha:</strong> {tx.nextOccurrence ? new Date(tx.nextOccurrence).toLocaleDateString() : "N/A"}</div>
                        </div>
                        {!isIndefinite && (
                          <div style={{ marginTop: "12px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "14px" }}>
                              <span>Progreso: {paidCount} / {tx.totalOccurrences} pagos</span>
                              <span style={{ fontWeight: "600" }}>{Math.round(progress)}%</span>
                            </div>
                            <div style={{
                              width: "100%",
                              height: "8px",
                              background: "#e0e0e0",
                              borderRadius: "4px",
                              overflow: "hidden"
                            }}>
                              <div style={{
                                width: `${progress}%`,
                                height: "100%",
                                background: progress >= 100 ? "var(--color-income, #059669)" : "var(--color-primary, #4F46E5)",
                                transition: "width 0.3s"
                              }} />
                            </div>
                            <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
                              {tx.remainingOccurrences !== null && tx.remainingOccurrences > 0
                                ? `${tx.remainingOccurrences} pago${tx.remainingOccurrences !== 1 ? "s" : ""} restante${tx.remainingOccurrences !== 1 ? "s" : ""}`
                                : "Completado"}
                            </div>
                          </div>
                        )}
                        {isIndefinite && (
                          <div style={{ fontSize: "12px", color: "#666", marginTop: "8px" }}>
                            Recurrencia indefinida
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: "8px", flexDirection: "column" }}>
                        {!tx.isPaid && (
                          <button
                            onClick={() => confirmPayment(tx)}
                            style={{
                              padding: "10px 20px",
                              background: "#27ae60",
                              color: "white",
                              border: "none",
                              borderRadius: "8px",
                              fontSize: "14px",
                              fontWeight: "600",
                              cursor: "pointer",
                              whiteSpace: "nowrap"
                            }}
                          >
                            ✓ Confirmar Pago
                          </button>
                        )}
                        <Link href={`/transactions/new?recurringId=${tx.id}`}>
                          <button
                            style={{
                              padding: "10px 20px",
                              background: "#667eea",
                              color: "white",
                              border: "none",
                              borderRadius: "8px",
                              fontSize: "14px",
                              fontWeight: "600",
                              cursor: "pointer",
                              whiteSpace: "nowrap"
                            }}
                          >
                            Crear Manualmente
                          </button>
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Ingresos Recurrentes */}
        <div style={{
          background: "white",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)"
        }}>
          <h2 style={{ fontSize: "22px", fontWeight: "700", marginBottom: "20px", color: "#333" }}>
            Ingresos Recurrentes
          </h2>
          {incomes.length === 0 ? (
            <p style={{ color: "#666", textAlign: "center", padding: "40px" }}>
              No hay ingresos recurrentes registrados
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {incomes.map((tx: any) => {
                const rule = tx.recurringRule ? JSON.parse(tx.recurringRule) : { type: "monthly" };
                const ruleLabels: Record<string, string> = { daily: "Diario", weekly: "Semanal", monthly: "Mensual" };
                const isIndefinite = tx.totalOccurrences === null;

                return (
                  <div key={tx.id} style={{
                    padding: "20px",
                    background: "#f0f9ff",
                    borderRadius: "12px",
                    border: "2px solid #27ae60",
                    borderLeftWidth: "4px"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#333", marginBottom: "8px" }}>
                          {tx.description || tx.category?.name || "Sin descripción"}
                        </h3>
                        <div style={{ fontSize: "14px", color: "#666" }}>
                          <div><strong>Monto:</strong> {fmtMoney(tx.amountCents, tx.currencyCode)}</div>
                          <div><strong>Frecuencia:</strong> {ruleLabels[rule.type] || rule.type}</div>
                          <div><strong>Próxima fecha:</strong> {tx.nextOccurrence ? new Date(tx.nextOccurrence).toLocaleDateString() : "N/A"}</div>
                          {!isIndefinite && tx.remainingOccurrences !== null && (
                            <div><strong>Restantes:</strong> {tx.remainingOccurrences} ocurrencias</div>
                          )}
                        </div>
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

