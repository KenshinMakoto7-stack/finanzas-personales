"use client";
import { useEffect, useState } from "react";
import api, { setAuthToken } from "../../lib/api";
import { useAuth } from "../../store/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

function fmtMoney(cents: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(cents / 100);
}

export default function CalendarPage() {
  const { user, token, initialized, initAuth } = useAuth();
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [transactions, setTransactions] = useState<any[]>([]);
  const [plannedEvents, setPlannedEvents] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showEventForm, setShowEventForm] = useState(false);
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    currencyCode: "USD",
    type: "EXPENSE" as "EXPENSE" | "INCOME",
    categoryId: "",
    accountId: "",
    scheduledDate: ""
  });

  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

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
  }, [user, token, initialized, month, year, initAuth]);

  async function loadData() {
    setLoading(true);
    try {
      const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
      const monthEnd = `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}`;

      const [transactionsRes, eventsRes, accountsRes, categoriesRes] = await Promise.all([
        api.get(`/transactions?from=${monthStart}&to=${monthEnd}&pageSize=500`),
        api.get(`/planned-events?month=${month}&year=${year}`),
        api.get("/accounts"),
        api.get("/categories")
      ]);

      setTransactions(transactionsRes.data.transactions || []);
      setPlannedEvents(eventsRes.data.events || []);
      setAccounts(accountsRes.data.accounts || []);
      setCategories(categoriesRes.data.categories || categoriesRes.data.flat || []);
    } catch (err: any) {
      console.error("Error loading data:", err);
      if (err?.response?.status === 401) {
        router.push("/login");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleDayClick(day: number) {
    const clickedDate = new Date(year, month - 1, day);
    setSelectedDay(clickedDate);
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setFormData(prev => ({
      ...prev,
      scheduledDate: dateStr,
      currencyCode: user?.currencyCode || "USD",
      accountId: accounts.length > 0 ? accounts[0].id : ""
    }));
    setShowEventForm(true);
  }

  async function handleSubmitEvent(e: React.FormEvent) {
    e.preventDefault();
    try {
      const amountCents = Math.round(Number(formData.amount) * 100);
      await api.post("/planned-events", {
        description: formData.description,
        amountCents,
        currencyCode: formData.currencyCode,
        type: formData.type,
        scheduledDate: formData.scheduledDate,
        categoryId: formData.categoryId || null,
        accountId: formData.accountId || null
      });

      setShowEventForm(false);
      setSelectedDay(null);
      setFormData({
        description: "",
        amount: "",
        currencyCode: user?.currencyCode || "USD",
        type: "EXPENSE",
        categoryId: "",
        accountId: "",
        scheduledDate: ""
      });
      loadData();
    } catch (err: any) {
      console.error("Error creating event:", err);
      alert(err?.response?.data?.error || "Error al crear evento");
    }
  }

  function getDayTransactions(day: number) {
    return transactions.filter((tx: any) => {
      const txDate = new Date(tx.occurredAt);
      return txDate.getDate() === day && 
             txDate.getMonth() === month - 1 && 
             txDate.getFullYear() === year;
    });
  }

  function getDayPlannedEvents(day: number) {
    return plannedEvents.filter((event: any) => {
      const eventDate = event.scheduledDate?.toDate ? event.scheduledDate.toDate() : new Date(event.scheduledDate);
      return eventDate.getDate() === day && 
             eventDate.getMonth() === month - 1 && 
             eventDate.getFullYear() === year;
    });
  }

  function getDaysInMonth() {
    return new Date(year, month, 0).getDate();
  }

  function getFirstDayOfMonth() {
    return new Date(year, month - 1, 1).getDay();
  }

  function navigateMonth(direction: number) {
    setCurrentDate(new Date(year, month - 1 + direction, 1));
  }

  if (!user) return null;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-bg-primary, #FAFBFC)" }}>
        <div style={{ background: "white", padding: "40px", borderRadius: "20px", boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)" }}>
          <p style={{ fontSize: "18px", color: "#667eea", fontWeight: "600" }}>Cargando...</p>
        </div>
      </div>
    );
  }

  const daysInMonth = getDaysInMonth();
  const firstDay = getFirstDayOfMonth();
  const days = [];

  // Días vacíos al inicio
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }

  // Días del mes
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day);
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg-primary, #FAFBFC)", padding: "24px" }}>
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: "700", color: "var(--color-text-primary, #111827)", marginBottom: "8px" }}>
              Calendario
            </h1>
            <p style={{ color: "var(--color-text-secondary, #6B7280)", fontSize: "14px" }}>
              Visualiza tus transacciones y eventos planificados
            </p>
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <button
              onClick={() => navigateMonth(-1)}
              style={{
                padding: "10px 16px",
                background: "white",
                border: "1px solid var(--color-border, #E5E7EB)",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "600"
              }}
            >
              ← Anterior
            </button>
            <div style={{ fontSize: "18px", fontWeight: "600", color: "var(--color-text-primary, #111827)", minWidth: "200px", textAlign: "center" }}>
              {monthNames[month - 1]} {year}
            </div>
            <button
              onClick={() => navigateMonth(1)}
              style={{
                padding: "10px 16px",
                background: "white",
                border: "1px solid var(--color-border, #E5E7EB)",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "600"
              }}
            >
              Siguiente →
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              style={{
                padding: "10px 16px",
                background: "var(--color-primary, #4F46E5)",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "600"
              }}
            >
              Hoy
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div style={{
          background: "white",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)"
        }}>
          {/* Day Headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "8px", marginBottom: "8px" }}>
            {dayNames.map(day => (
              <div key={day} style={{
                padding: "12px",
                textAlign: "center",
                fontWeight: "600",
                color: "var(--color-text-secondary, #6B7280)",
                fontSize: "14px"
              }}>
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "8px" }}>
            {days.map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} style={{ minHeight: "120px" }} />;
              }

              const dayTransactions = getDayTransactions(day);
              const dayEvents = getDayPlannedEvents(day);
              const isToday = new Date().getDate() === day && 
                             new Date().getMonth() === month - 1 && 
                             new Date().getFullYear() === year;
              const isSelected = selectedDay && 
                                selectedDay.getDate() === day && 
                                selectedDay.getMonth() === month - 1 && 
                                selectedDay.getFullYear() === year;

              return (
                <div
                  key={day}
                  onClick={() => handleDayClick(day)}
                  style={{
                    minHeight: "120px",
                    padding: "8px",
                    background: isSelected ? "#e0e7ff" : isToday ? "#f0f9ff" : "white",
                    border: isSelected ? "2px solid var(--color-primary, #4F46E5)" : isToday ? "2px solid #0ea5e9" : "1px solid var(--color-border, #E5E7EB)",
                    borderRadius: "8px",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    position: "relative"
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected && !isToday) {
                      e.currentTarget.style.background = "#f9fafb";
                      e.currentTarget.style.borderColor = "var(--color-primary, #4F46E5)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected && !isToday) {
                      e.currentTarget.style.background = "white";
                      e.currentTarget.style.borderColor = "var(--color-border, #E5E7EB)";
                    }
                  }}
                >
                  <div style={{
                    fontSize: "16px",
                    fontWeight: isToday ? "700" : "600",
                    color: isToday ? "#0ea5e9" : "var(--color-text-primary, #111827)",
                    marginBottom: "4px"
                  }}>
                    {day}
                  </div>

                  {/* Transacciones */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "11px" }}>
                    {dayTransactions.slice(0, 3).map((tx: any) => (
                      <div
                        key={tx.id}
                        style={{
                          padding: "4px 6px",
                          background: tx.type === "INCOME" ? "#d1fae5" : tx.type === "EXPENSE" ? "#fee2e2" : "#dbeafe",
                          color: tx.type === "INCOME" ? "#065f46" : tx.type === "EXPENSE" ? "#991b1b" : "#1e40af",
                          borderRadius: "4px",
                          fontWeight: "600",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          title: `${tx.description || tx.category?.name || "Sin descripción"} - ${fmtMoney(tx.amountCents, tx.currencyCode || user.currencyCode)}`
                        }}
                      >
                        {tx.type === "INCOME" ? "+" : "-"} {fmtMoney(tx.amountCents, tx.currencyCode || user.currencyCode)}
                      </div>
                    ))}
                    {dayTransactions.length > 3 && (
                      <div style={{ fontSize: "10px", color: "#6b7280", fontWeight: "600" }}>
                        +{dayTransactions.length - 3} más
                      </div>
                    )}

                    {/* Eventos Planificados */}
                    {dayEvents.map((event: any) => (
                      <div
                        key={event.id}
                        style={{
                          padding: "4px 6px",
                          background: "#fef3c7",
                          color: "#92400e",
                          borderRadius: "4px",
                          fontWeight: "600",
                          border: "1px dashed #f59e0b",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          title: `${event.description} - ${fmtMoney(event.amountCents, event.currencyCode || user.currencyCode)} (Planificado)`
                        }}
                      >
                        📅 {fmtMoney(event.amountCents, event.currencyCode || user.currencyCode)}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal de Formulario */}
        {showEventForm && (
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
          }}
          onClick={() => {
            setShowEventForm(false);
            setSelectedDay(null);
          }}
          >
            <div
              style={{
                background: "white",
                borderRadius: "16px",
                padding: "24px",
                maxWidth: "500px",
                width: "100%",
                maxHeight: "90vh",
                overflowY: "auto",
                boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)"
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ fontSize: "24px", fontWeight: "700", marginBottom: "20px", color: "var(--color-text-primary, #111827)" }}>
                Nuevo Evento Planificado
              </h2>
              <form onSubmit={handleSubmitEvent}>
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px" }}>
                    Fecha *
                  </label>
                  <input
                    type="date"
                    value={formData.scheduledDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, scheduledDate: e.target.value }))}
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

                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px" }}>
                    Tipo *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as "EXPENSE" | "INCOME" }))}
                    required
                    style={{
                      width: "100%",
                      padding: "12px",
                      border: "2px solid #e0e0e0",
                      borderRadius: "8px",
                      fontSize: "14px"
                    }}
                  >
                    <option value="EXPENSE">Gasto</option>
                    <option value="INCOME">Ingreso</option>
                  </select>
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px" }}>
                    Descripción *
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    required
                    placeholder="Ej: Pago de factura de luz"
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
                    Monto *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                    required
                    placeholder="0.00"
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
                    Moneda *
                  </label>
                  <select
                    value={formData.currencyCode}
                    onChange={(e) => setFormData(prev => ({ ...prev, currencyCode: e.target.value }))}
                    required
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

                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px" }}>
                    Cuenta
                  </label>
                  <select
                    value={formData.accountId}
                    onChange={(e) => setFormData(prev => ({ ...prev, accountId: e.target.value }))}
                    style={{
                      width: "100%",
                      padding: "12px",
                      border: "2px solid #e0e0e0",
                      borderRadius: "8px",
                      fontSize: "14px"
                    }}
                  >
                    <option value="">Seleccionar cuenta (opcional)</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px" }}>
                    Categoría
                  </label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData(prev => ({ ...prev, categoryId: e.target.value }))}
                    style={{
                      width: "100%",
                      padding: "12px",
                      border: "2px solid #e0e0e0",
                      borderRadius: "8px",
                      fontSize: "14px"
                    }}
                  >
                    <option value="">Seleccionar categoría (opcional)</option>
                    {categories
                      .filter((cat: any) => !cat.parentId)
                      .map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                  </select>
                </div>

                <div style={{ display: "flex", gap: "12px" }}>
                  <button
                    type="submit"
                    style={{
                      flex: 1,
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
                    Guardar Evento
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEventForm(false);
                      setSelectedDay(null);
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
          </div>
        )}
      </div>
    </div>
  );
}

