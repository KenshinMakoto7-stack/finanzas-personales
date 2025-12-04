"use client";
import { useEffect, useState } from "react";
import api, { setAuthToken } from "../../../lib/api";
import { useAuth } from "../../../store/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewTransactionPage() {
  const { user, token, initialized, initAuth } = useAuth();
  const router = useRouter();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [desc, setDesc] = useState("");
  const [type, setType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().slice(0, 16)); // YYYY-MM-DDTHH:mm
  const [msg, setMsg] = useState<string>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryParentId, setNewCategoryParentId] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringType, setRecurringType] = useState("monthly");
  const [recurringOccurrences, setRecurringOccurrences] = useState<number | "indefinite">("indefinite");
  const [isPaid, setIsPaid] = useState(false);
  const [notifications, setNotifications] = useState<Array<{ date: string; time: string }>>([]);
  const [authReady, setAuthReady] = useState(false);
  const [payInInstallments, setPayInInstallments] = useState(false);
  const [numberOfInstallments, setNumberOfInstallments] = useState(1);
  const [totalAmountForInstallments, setTotalAmountForInstallments] = useState("");

  const loadData = async () => {
    try {
      const [accRes, catRes] = await Promise.all([
        api.get("/accounts"),
        api.get(`/categories?type=${type}`)
      ]);
      setAccounts(accRes.data.accounts || []);
      setCategories(catRes.data.categories || catRes.data.flat || []);
      if (accRes.data.accounts && accRes.data.accounts.length > 0 && !accountId) {
        setAccountId(accRes.data.accounts[0].id);
        if (typeof window !== "undefined" && !new URLSearchParams(window.location.search).get("currency")) {
          setCurrencyCode(accRes.data.accounts[0].currencyCode || user?.currencyCode || "USD");
        }
      }
    } catch (err: any) {
      setError("Error al cargar datos");
    }
  };

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
    setAuthReady(true);
    setCurrencyCode(user.currencyCode || "USD");

    // Leer parámetros de URL para prellenar campos (después de cargar datos)
    const loadUrlParams = () => {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const categoryParam = params.get("category");
        const typeParam = params.get("type");
        const amountParam = params.get("amount");
        const currencyParam = params.get("currency");
        const descriptionParam = params.get("description");
        
        if (categoryParam) setCategoryId(categoryParam);
        if (typeParam) setType(typeParam as "EXPENSE" | "INCOME");
        if (amountParam) setAmount(String(Number(amountParam) / 100)); // Convertir de centavos
        if (currencyParam) setCurrencyCode(currencyParam);
        if (descriptionParam) setDesc(decodeURIComponent(descriptionParam));
      }
    };

    loadData().then(loadUrlParams);

    // Recargar datos cuando la ventana gana foco (usuario vuelve de crear cuenta/categoría)
    const handleFocus = () => loadData();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [type, user, token, initialized, router, initAuth]);

  async function createCategoryQuick() {
    if (!newCategoryName.trim()) {
      alert("Ingresa un nombre para la categoría");
      return;
    }
    try {
      const res = await api.post("/categories", {
        name: newCategoryName.trim(),
        type: type,
        parentId: newCategoryParentId && newCategoryParentId.trim() !== "" ? newCategoryParentId : null
      });
      setCategories([...categories, res.data.category]);
      setCategoryId(res.data.category.id);
      setNewCategoryName("");
      setNewCategoryParentId("");
      setShowCreateCategory(false);
    } catch (err: any) {
      alert(err?.response?.data?.error || "Error al crear categoría");
    }
  }

  async function save() {
    if (!accountId) {
      setError("Selecciona una cuenta");
      return;
    }
    if (!categoryId) {
      setError("Selecciona o crea una categoría");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setError("El importe debe ser mayor a 0");
      return;
    }

    setError(undefined);
    setLoading(true);
    try {
      // Redondear a entero (sin decimales)
      const amountRounded = Math.round(Number(amount));
      const amountCents = amountRounded * 100; // Convertir a centavos pero sin decimales

      // Convertir fecha y hora a ISO string
      // Si está marcado como pagado, usar fecha y hora de hoy
      const finalDate = isPaid 
        ? new Date().toISOString().slice(0, 16) 
        : occurredAt; // Usar el estado occurredAt del componente
      
      // Normalizar la fecha para evitar problemas de zona horaria
      // Extraer año, mes, día, hora y minutos de la fecha seleccionada
      const dateObj = new Date(finalDate);
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth();
      const day = dateObj.getDate();
      const hours = dateObj.getHours();
      const minutes = dateObj.getMinutes();
      
      // Crear una nueva fecha en UTC con esos valores
      // Esto asegura que la fecha se guarde exactamente como el usuario la seleccionó
      const normalizedDate = new Date(Date.UTC(year, month, day, hours, minutes, 0, 0));
      const occurredAtISO = normalizedDate.toISOString();

      const selectedAccount = accounts.find(a => a.id === accountId);
      const isCreditAccount = selectedAccount?.type === "CREDIT";
      
      const payload: any = {
        accountId,
        categoryId,
        type,
        amountCents,
        currencyCode,
        occurredAt: occurredAtISO,
        description: desc && desc.trim() !== "" ? desc.trim() : null,
        isRecurring: isRecurring,
        isPaid: isRecurring ? isPaid : false
      };
      
      // Si es cuenta de crédito y está en modo cuotas, agregar información de cuotas
      if (isCreditAccount && type === "EXPENSE" && payInInstallments && numberOfInstallments > 1 && totalAmountForInstallments) {
        payload.installments = numberOfInstallments;
        payload.totalAmountCents = Math.round(Number(totalAmountForInstallments) * 100);
      }

      if (isRecurring) {
        payload.recurringRule = JSON.stringify({ type: recurringType });
        // Calcular próxima ocurrencia basada en el tipo
        const baseDate = new Date(occurredAtISO);
        const nextDate = new Date(baseDate);
        if (recurringType === "daily") nextDate.setDate(nextDate.getDate() + 1);
        else if (recurringType === "weekly") nextDate.setDate(nextDate.getDate() + 7);
        else if (recurringType === "monthly") nextDate.setMonth(nextDate.getMonth() + 1);
        payload.nextOccurrence = nextDate.toISOString();
        
        // Guardar notificaciones programadas
        if (notifications.length > 0) {
          payload.notificationSchedule = notifications.map(n => ({
            date: n.date,
            time: n.time
          }));
        }
        
        // Guardar información de ocurrencias
        if (recurringOccurrences === "indefinite") {
          payload.totalOccurrences = null;
          payload.remainingOccurrences = null;
        } else {
          payload.totalOccurrences = recurringOccurrences;
          payload.remainingOccurrences = isPaid ? recurringOccurrences - 1 : recurringOccurrences;
        }
      }

      await api.post("/transactions", payload);
      setMsg("Transacción guardada exitosamente");
      setAmount("");
      setDesc("");
      setCategoryId("");
      setIsRecurring(false);
      setIsPaid(false);
      setRecurringOccurrences("indefinite");
      setNotifications([]);
      setTimeout(() => {
        // Forzar recarga del dashboard agregando timestamp a la URL
        router.push("/dashboard?refresh=" + Date.now());
        // También recargar la página para asegurar que los datos se actualicen
        setTimeout(() => {
          window.location.reload();
        }, 100);
      }, 1500);
    } catch (err: any) {
      const errorData = err?.response?.data?.error;
      let errorMessage = "Error al guardar la transacción";
      
      if (errorData) {
        if (typeof errorData === "string") {
          errorMessage = errorData;
        } else if (typeof errorData === "object") {
          // Si es un objeto con formErrors/fieldErrors (Zod)
          if (errorData.formErrors && Array.isArray(errorData.formErrors)) {
            errorMessage = errorData.formErrors.join(", ");
          } else if (errorData.fieldErrors && typeof errorData.fieldErrors === "object") {
            const fieldMessages = Object.entries(errorData.fieldErrors)
              .map(([field, errors]: [string, any]) => {
                const errList = Array.isArray(errors) ? errors.join(", ") : String(errors);
                return `${field}: ${errList}`;
              })
              .join("; ");
            errorMessage = fieldMessages || "Error de validación en los campos";
          } else {
            // Intentar convertir el objeto a string
            errorMessage = JSON.stringify(errorData);
          }
        }
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--color-bg-primary, #FAFBFC)",
      padding: "20px"
    }}>
      <div style={{ maxWidth: "600px", margin: "0 auto" }}>
        <div style={{
          background: "var(--color-bg-white, #FFFFFF)",
          borderRadius: "20px",
          boxShadow: "var(--shadow-xl, 0 20px 25px -5px rgba(0, 0, 0, 0.1))",
          border: "1px solid var(--color-border-light, #F3F4F6)",
          padding: "40px"
        }}>
          <div style={{ marginBottom: "32px" }}>
            <Link href="/dashboard" style={{
              color: "var(--color-primary, #4F46E5)",
              textDecoration: "none",
              fontSize: "14px",
              fontWeight: "600",
              marginBottom: "16px",
              display: "inline-block",
              fontFamily: "'Inter', sans-serif"
            }}>
              ← Volver al Dashboard
            </Link>
            <h1 style={{
              fontSize: "32px",
              fontWeight: "700",
              color: "var(--color-primary, #4F46E5)",
              marginTop: "8px",
              fontFamily: "'Inter', sans-serif"
            }}>
              Nueva Transacción
            </h1>
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label style={{
              display: "block",
              marginBottom: "8px",
              color: "#333",
              fontWeight: "600",
              fontSize: "14px"
            }}>
              Tipo de Transacción *
            </label>
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value as any);
                setCategoryId("");
                setShowCreateCategory(false);
              }}
              style={{
                width: "100%",
                padding: "14px 16px",
                border: "2px solid #e0e0e0",
                borderRadius: "10px",
                fontSize: "16px",
                background: "white",
                cursor: "pointer"
              }}
            >
              <option value="EXPENSE">Gasto</option>
              <option value="INCOME">Ingreso</option>
            </select>
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label style={{
              display: "block",
              marginBottom: "8px",
              color: "#333",
              fontWeight: "600",
              fontSize: "14px"
            }}>
              Cuenta *
            </label>
            <select
              value={accountId}
              onChange={(e) => {
                const selected = accounts.find(a => a.id === e.target.value);
                setAccountId(e.target.value);
                if (selected) {
                  setCurrencyCode(selected.currencyCode || user.currencyCode || "USD");
                  // Si no es cuenta de crédito o no es gasto, desactivar cuotas
                  if (selected.type !== "CREDIT" || type !== "EXPENSE") {
                    setPayInInstallments(false);
                  }
                }
              }}
              required
              style={{
                width: "100%",
                padding: "14px 16px",
                border: "2px solid #e0e0e0",
                borderRadius: "10px",
                fontSize: "16px",
                background: "white",
                cursor: "pointer"
              }}
            >
              <option value="">Selecciona una cuenta</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.currencyCode})</option>
              ))}
            </select>
            <Link href="/accounts" style={{
              display: "inline-block",
              marginTop: "8px",
              color: "#667eea",
              fontSize: "12px",
              textDecoration: "none"
            }}>
              + Crear nueva cuenta
            </Link>
          </div>

          <div style={{ marginBottom: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <label style={{
                color: "#333",
                fontWeight: "600",
                fontSize: "14px"
              }}>
                Categoría *
              </label>
              {!showCreateCategory && (
                <button
                  type="button"
                  onClick={() => setShowCreateCategory(true)}
                  style={{
                    padding: "6px 12px",
                    background: "#27ae60",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "12px",
                    cursor: "pointer"
                  }}
                >
                  + Crear nueva
                </button>
              )}
            </div>
            {showCreateCategory ? (
              <div style={{
                padding: "16px",
                background: "#f8f9fa",
                borderRadius: "8px",
                marginBottom: "12px"
              }}>
                <input
                  id="new-category-name"
                  name="new-category-name"
                  type="text"
                  placeholder="Nombre de la categoría"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "2px solid #e0e0e0",
                    borderRadius: "8px",
                    fontSize: "14px",
                    marginBottom: "8px"
                  }}
                />
                <select
                  value={newCategoryParentId}
                  onChange={(e) => setNewCategoryParentId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "2px solid #e0e0e0",
                    borderRadius: "8px",
                    fontSize: "14px",
                    marginBottom: "8px",
                    background: "white"
                  }}
                >
                  <option value="">Sin categoría padre (raíz)</option>
                  {categories
                    .filter(c => c.type === type)
                    .map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={createCategoryQuick}
                    style={{
                      padding: "8px 16px",
                      background: "#27ae60",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "14px",
                      cursor: "pointer"
                    }}
                  >
                    Crear
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateCategory(false);
                      setNewCategoryName("");
                      setNewCategoryParentId("");
                    }}
                    style={{
                      padding: "8px 16px",
                      background: "#f0f0f0",
                      color: "#333",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "14px",
                      cursor: "pointer"
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  border: categoryId ? "2px solid #e0e0e0" : "2px solid #e74c3c",
                  borderRadius: "10px",
                  fontSize: "16px",
                  background: "white",
                  cursor: "pointer"
                }}
              >
                <option value="">Selecciona una categoría *</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label style={{
              display: "block",
              marginBottom: "8px",
              color: "#333",
              fontWeight: "600",
              fontSize: "14px"
            }}>
              Moneda
            </label>
            <select
              value={currencyCode}
              onChange={(e) => setCurrencyCode(e.target.value)}
              style={{
                width: "100%",
                padding: "14px 16px",
                border: "2px solid #e0e0e0",
                borderRadius: "10px",
                fontSize: "16px",
                background: "white",
                cursor: "pointer"
              }}
            >
              <option value="USD">USD - Dólar Estadounidense</option>
              <option value="UYU">UYU - Peso Uruguayo</option>
            </select>
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label htmlFor="transaction-amount" style={{
              display: "block",
              marginBottom: "8px",
              color: "#333",
              fontWeight: "600",
              fontSize: "14px"
            }}>
              Importe * (solo números enteros)
            </label>
            <input
              id="transaction-amount"
              name="transaction-amount"
              type="number"
              step="1"
              min="1"
              placeholder="0"
              value={amount}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "" || (Number(val) > 0 && Number.isInteger(Number(val)))) {
                  setAmount(val);
                  // Si está en modo cuotas, actualizar el monto total también
                  if (payInInstallments && !totalAmountForInstallments) {
                    setTotalAmountForInstallments(val);
                  }
                }
              }}
              required
              style={{
                width: "100%",
                padding: "14px 16px",
                border: "2px solid #e0e0e0",
                borderRadius: "10px",
                fontSize: "16px"
              }}
            />
            <small style={{ color: "#666", fontSize: "12px", marginTop: "4px", display: "block" }}>
              Ejemplo: 100 (se redondeará automáticamente, sin decimales)
            </small>
          </div>

          {/* Formulario condicional para cuotas de tarjeta de crédito */}
          {accountId && type === "EXPENSE" && accounts.find(a => a.id === accountId)?.type === "CREDIT" && (
            <div style={{
              marginBottom: "24px",
              padding: "16px",
              background: "#fff5f5",
              borderRadius: "10px",
              border: "2px solid #e74c3c"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <span style={{ fontSize: "20px" }}>⚠️</span>
                <span style={{ fontWeight: "600", fontSize: "14px", color: "#e74c3c" }}>
                  Cuenta de Crédito detectada
                </span>
              </div>
              
              <label style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: "#333",
                fontWeight: "600",
                fontSize: "14px",
                cursor: "pointer",
                marginBottom: "12px"
              }}>
                <input
                  type="checkbox"
                  checked={payInInstallments}
                  onChange={(e) => {
                    setPayInInstallments(e.target.checked);
                    if (!e.target.checked) {
                      setNumberOfInstallments(1);
                      setTotalAmountForInstallments("");
                    } else if (!totalAmountForInstallments && amount) {
                      setTotalAmountForInstallments(amount);
                    }
                  }}
                  style={{ width: "20px", height: "20px", cursor: "pointer" }}
                />
                Pagar en cuotas
              </label>
              
              {payInInstallments && (
                <>
                  <div style={{ marginBottom: "12px" }}>
                    <label style={{
                      display: "block",
                      marginBottom: "8px",
                      color: "#333",
                      fontWeight: "600",
                      fontSize: "14px"
                    }}>
                      Cantidad de cuotas *
                    </label>
                    <select
                      value={numberOfInstallments}
                      onChange={(e) => setNumberOfInstallments(Number(e.target.value))}
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
                      {Array.from({ length: 60 }, (_, i) => i + 1).map(num => (
                        <option key={num} value={num}>{num} {num === 1 ? "cuota" : "cuotas"}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div style={{ marginBottom: "12px" }}>
                    <label style={{
                      display: "block",
                      marginBottom: "8px",
                      color: "#333",
                      fontWeight: "600",
                      fontSize: "14px"
                    }}>
                      Monto total comprometido *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={totalAmountForInstallments}
                      onChange={(e) => setTotalAmountForInstallments(e.target.value)}
                      required={payInInstallments}
                      style={{
                        width: "100%",
                        padding: "12px",
                        border: "2px solid #e0e0e0",
                        borderRadius: "8px",
                        fontSize: "14px"
                      }}
                    />
                  </div>
                  
                  {totalAmountForInstallments && numberOfInstallments > 1 && (
                    <div style={{
                      padding: "12px",
                      background: "#e8f5e9",
                      borderRadius: "8px",
                      fontSize: "14px",
                      color: "#2e7d32",
                      fontWeight: "600"
                    }}>
                      Cuota mensual: {new Intl.NumberFormat(undefined, {
                        style: "currency",
                        currency: currencyCode,
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      }).format(Number(totalAmountForInstallments) / numberOfInstallments)}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div style={{ marginBottom: "24px" }}>
            <label htmlFor="transaction-date" style={{
              display: "block",
              marginBottom: "8px",
              color: "#333",
              fontWeight: "600",
              fontSize: "14px"
            }}>
              Fecha y Hora *
            </label>
            <input
              id="transaction-date"
              name="transaction-date"
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "14px 16px",
                border: "2px solid #e0e0e0",
                borderRadius: "10px",
                fontSize: "16px"
              }}
            />
            <small style={{ color: "#666", fontSize: "12px", marginTop: "4px", display: "block" }}>
              Selecciona la fecha y hora en que ocurrió o ocurrirá esta transacción
            </small>
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label style={{
              display: "block",
              marginBottom: "8px",
              color: "#333",
              fontWeight: "600",
              fontSize: "14px"
            }}>
              Descripción (opcional)
            </label>
            <input
              id="transaction-description"
              name="transaction-description"
              type="text"
              placeholder="Nota sobre esta transacción"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              style={{
                width: "100%",
                padding: "14px 16px",
                border: "2px solid #e0e0e0",
                borderRadius: "10px",
                fontSize: "16px"
              }}
            />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "#333",
              fontWeight: "600",
              fontSize: "14px",
              cursor: "pointer"
            }}>
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => {
                  setIsRecurring(e.target.checked);
                  if (!e.target.checked) {
                    setIsPaid(false);
                    setRecurringOccurrences("indefinite");
                  }
                }}
                style={{ width: "20px", height: "20px", cursor: "pointer" }}
              />
              Transacción recurrente (recordatorio)
            </label>
            {isRecurring && (
              <>
                <select
                  value={recurringType}
                  onChange={(e) => setRecurringType(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "2px solid #e0e0e0",
                    borderRadius: "8px",
                    fontSize: "14px",
                    marginTop: "8px",
                    background: "white",
                    cursor: "pointer"
                  }}
                >
                  <option value="daily">Diario</option>
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensual</option>
                </select>
                
                <div style={{ marginTop: "12px", marginBottom: "12px" }}>
                  <label style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    color: "#333",
                    fontWeight: "600",
                    fontSize: "14px",
                    cursor: "pointer",
                    marginBottom: "8px"
                  }}>
                    <input
                      type="checkbox"
                      checked={isPaid}
                      onChange={(e) => setIsPaid(e.target.checked)}
                      style={{ width: "20px", height: "20px", cursor: "pointer" }}
                    />
                    Ya está pagado (crear transacción con fecha de hoy)
                  </label>
                </div>
                
                <div style={{ marginTop: "12px", marginBottom: "12px" }}>
                  <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px" }}>
                    Duración de la recurrencia
                  </label>
                  <select
                    value={recurringOccurrences === "indefinite" ? "indefinite" : String(recurringOccurrences)}
                    onChange={(e) => {
                      if (e.target.value === "indefinite") {
                        setRecurringOccurrences("indefinite");
                      } else {
                        setRecurringOccurrences(Number(e.target.value));
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
                    <option value="indefinite">Indefinido</option>
                    {Array.from({ length: 60 }, (_, i) => i + 1).map(num => (
                      <option key={num} value={num}>
                        {num} {recurringType === "monthly" ? "meses" : recurringType === "weekly" ? "semanas" : "días"}
                      </option>
                    ))}
                  </select>
                  <small style={{ color: "#666", fontSize: "12px", marginTop: "4px", display: "block" }}>
                    {recurringOccurrences === "indefinite" 
                      ? "La transacción se repetirá indefinidamente"
                      : `La transacción se repetirá ${recurringOccurrences} ${recurringType === "monthly" ? "veces" : recurringType === "weekly" ? "veces" : "veces"} más`}
                  </small>
                </div>
                
                <div style={{ marginTop: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <label style={{ color: "#333", fontWeight: "600", fontSize: "14px" }}>
                      Notificaciones
                    </label>
                    <button
                      type="button"
                      onClick={() => setNotifications([...notifications, { date: "", time: "09:00" }])}
                      style={{
                        padding: "6px 12px",
                        background: "#27ae60",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "12px",
                        cursor: "pointer"
                      }}
                    >
                      + Agregar Notificación
                    </button>
                  </div>
                  {notifications.map((notif, idx) => (
                    <div key={idx} style={{
                      display: "flex",
                      gap: "8px",
                      marginBottom: "8px",
                      alignItems: "center"
                    }}>
                      <input
                        type="date"
                        value={notif.date}
                        onChange={(e) => {
                          const updated = [...notifications];
                          updated[idx].date = e.target.value;
                          setNotifications(updated);
                        }}
                        placeholder="Fecha"
                        style={{
                          flex: 1,
                          padding: "8px",
                          border: "2px solid #e0e0e0",
                          borderRadius: "6px",
                          fontSize: "14px"
                        }}
                      />
                      <input
                        type="time"
                        value={notif.time}
                        onChange={(e) => {
                          const updated = [...notifications];
                          updated[idx].time = e.target.value;
                          setNotifications(updated);
                        }}
                        style={{
                          flex: 1,
                          padding: "8px",
                          border: "2px solid #e0e0e0",
                          borderRadius: "6px",
                          fontSize: "14px"
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setNotifications(notifications.filter((_, i) => i !== idx))}
                        style={{
                          padding: "8px 12px",
                          background: "#e74c3c",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          fontSize: "12px",
                          cursor: "pointer"
                        }}
                      >
                        Eliminar
                      </button>
                    </div>
                  ))}
                  {notifications.length === 0 && (
                    <small style={{ color: "#666", fontSize: "12px", display: "block" }}>
                      Agrega notificaciones para recordarte de esta transacción recurrente
                    </small>
                  )}
                </div>
              </>
            )}
          </div>

          {error && (
            <div style={{
              background: "#fee",
              color: "#e74c3c",
              padding: "12px 16px",
              borderRadius: "8px",
              marginBottom: "20px",
              borderLeft: "4px solid #e74c3c",
              fontSize: "14px"
            }}>
              {typeof error === "string" ? error : String(error)}
            </div>
          )}

          {msg && (
            <div style={{
              background: "#d5f4e6",
              color: "#27ae60",
              padding: "12px 16px",
              borderRadius: "8px",
              marginBottom: "20px",
              borderLeft: "4px solid #27ae60",
              fontSize: "14px"
            }}>
              {msg}
            </div>
          )}

          <button
            onClick={save}
            disabled={loading || !accountId || !categoryId || !amount}
            style={{
              width: "100%",
              padding: "14px",
              background: loading || !accountId || !categoryId || !amount ? "var(--color-border, #E5E7EB)" : "var(--color-primary, #4F46E5)",
              color: "white",
              border: "none",
              borderRadius: "10px",
              fontSize: "16px",
              fontWeight: "600",
              cursor: loading || !accountId || !categoryId || !amount ? "not-allowed" : "pointer",
              transition: "all 0.3s"
            }}
          >
            {loading ? "Guardando..." : "Guardar Transacción"}
          </button>
        </div>
      </div>
    </div>
  );
}
