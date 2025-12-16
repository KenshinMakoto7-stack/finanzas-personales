"use client";
import { useEffect, useState } from "react";
import api, { setAuthToken } from "../../lib/api";
import { useAuth } from "../../store/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

function fmtMoney(cents: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(cents / 100);
}

export default function LimitsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [limits, setLimits] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [formData, setFormData] = useState({
    categoryId: "",
    month: new Date().toISOString().slice(0, 7), // YYYY-MM
    budgetCents: "",
    alertThresholds: [80] as number[] // Array de umbrales
  });
  const [error, setError] = useState<string>();

  const { token, initialized, initAuth } = useAuth();

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
  }, [user, token, initialized, router, initAuth, selectedMonth]);

  async function loadData() {
    try {
      setLoading(true);
      const [limitsRes, categoriesRes] = await Promise.all([
        api.get(`/budgets?month=${selectedMonth}-01`),
        api.get("/categories?tree=true")
      ]);
      setLimits(limitsRes.data.budgets || []);
      setCategories(categoriesRes.data.flat || []);
    } catch (err: any) {
      console.error("Error loading data:", err);
      setError(err?.response?.data?.error || "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }

  function addAlertThreshold() {
    if (formData.alertThresholds.length >= 5) {
      alert("Máximo 5 alertas permitidas");
      return;
    }
    setFormData({
      ...formData,
      alertThresholds: [...formData.alertThresholds, 80]
    });
  }

  function removeAlertThreshold(index: number) {
    if (formData.alertThresholds.length <= 1) {
      alert("Debe tener al menos una alerta");
      return;
    }
    setFormData({
      ...formData,
      alertThresholds: formData.alertThresholds.filter((_, i) => i !== index)
    });
  }

  function updateAlertThreshold(index: number, value: number) {
    const newThresholds = [...formData.alertThresholds];
    newThresholds[index] = Math.max(0, Math.min(100, value));
    setFormData({
      ...formData,
      alertThresholds: newThresholds
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    
    if (!formData.categoryId) {
      setError("Debes seleccionar una categoría");
      return;
    }
    
    if (!formData.budgetCents || parseFloat(formData.budgetCents) <= 0) {
      setError("El límite debe ser mayor a 0");
      return;
    }

    // Validar que los umbrales estén ordenados y sean únicos
    const sortedThresholds = [...formData.alertThresholds].sort((a, b) => a - b);
    const uniqueThresholds = [...new Set(sortedThresholds)];
    if (uniqueThresholds.length !== formData.alertThresholds.length) {
      setError("Los porcentajes de alerta deben ser únicos");
      return;
    }

    try {
      const budgetCents = Math.round(parseFloat(formData.budgetCents) * 100);
      
      if (editing) {
        await api.put(`/budgets/${editing}`, {
          budgetCents,
          alertThresholds: uniqueThresholds
        });
      } else {
        await api.post("/budgets", {
          categoryId: formData.categoryId,
          month: `${formData.month}-01`,
          budgetCents,
          alertThresholds: uniqueThresholds
        });
      }
      
      setShowCreate(false);
      setEditing(null);
      setFormData({
        categoryId: "",
        month: new Date().toISOString().slice(0, 7),
        budgetCents: "",
        alertThresholds: [80]
      });
      loadData();
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error;
      setError(typeof errorMsg === "string" ? errorMsg : "Error al guardar el límite");
    }
  }

  function handleEdit(limit: any) {
    setEditing(limit.id);
    setFormData({
      categoryId: limit.categoryId,
      month: limit.month instanceof Date 
        ? limit.month.toISOString().slice(0, 7)
        : new Date(limit.month).toISOString().slice(0, 7),
      budgetCents: (limit.budgetCents / 100).toString(),
      alertThresholds: limit.alertThresholds && Array.isArray(limit.alertThresholds)
        ? limit.alertThresholds
        : limit.alertThreshold !== undefined
        ? [limit.alertThreshold]
        : [80]
    });
    setShowCreate(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Estás seguro de eliminar este límite?")) return;
    try {
      await api.delete(`/budgets/${id}`);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error || "Error al eliminar");
    }
  }

  const expenseCategories = categories.filter(c => c.type === "EXPENSE");

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--color-bg-primary, #FAFBFC)",
      padding: "20px"
    }}>
      <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
        <div style={{
          background: "white",
          borderRadius: "20px",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
          padding: "40px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
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
                fontSize: "32px",
                fontWeight: "700",
                background: "var(--color-bg-primary, #FAFBFC)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                marginTop: "8px"
              }}>
                Gestión de Límites
              </h1>
            </div>
            <button
              onClick={() => {
                setShowCreate(true);
                setEditing(null);
                setFormData({
                  categoryId: "",
                  month: new Date().toISOString().slice(0, 7),
                  budgetCents: "",
                  alertThresholds: [80]
                });
              }}
              style={{
                padding: "12px 24px",
                background: "var(--color-bg-primary, #FAFBFC)",
                color: "white",
                border: "none",
                borderRadius: "10px",
                fontSize: "16px",
                fontWeight: "600",
                cursor: "pointer"
              }}
            >
              + Nuevo Límite
            </button>
          </div>

          {/* Filtro de mes */}
          <div style={{ marginBottom: "24px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: "#666" }}>
              Mes a visualizar:
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                padding: "10px",
                border: "1px solid #ddd",
                borderRadius: "8px",
                fontSize: "14px",
                width: "200px"
              }}
            />
          </div>

          {showCreate && (
            <div style={{
              background: "#f8f9fa",
              padding: "24px",
              borderRadius: "12px",
              marginBottom: "24px",
              border: "2px solid #667eea"
            }}>
              <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "20px" }}>
                {editing ? "Editar Límite" : "Nuevo Límite"}
              </h3>
              <form onSubmit={handleSubmit}>
                <div style={{ display: "grid", gap: "16px" }}>
                  <div>
                    <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600" }}>
                      Categoría *
                    </label>
                    <select
                      value={formData.categoryId}
                      onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                      required
                      style={{
                        width: "100%",
                        padding: "10px",
                        border: "1px solid #ddd",
                        borderRadius: "8px",
                        fontSize: "14px"
                      }}
                    >
                      <option value="">Seleccionar categoría</option>
                      {expenseCategories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600" }}>
                      Mes *
                    </label>
                    <input
                      type="month"
                      value={formData.month}
                      onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                      required
                      style={{
                        width: "100%",
                        padding: "10px",
                        border: "1px solid #ddd",
                        borderRadius: "8px",
                        fontSize: "14px"
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600" }}>
                      Límite ({user?.currencyCode || "USD"}) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={formData.budgetCents}
                      onChange={(e) => setFormData({ ...formData, budgetCents: e.target.value })}
                      required
                      placeholder="0.00"
                      style={{
                        width: "100%",
                        padding: "10px",
                        border: "1px solid #ddd",
                        borderRadius: "8px",
                        fontSize: "14px"
                      }}
                    />
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <label style={{ fontSize: "14px", fontWeight: "600" }}>
                        Alertas (Porcentajes) *
                      </label>
                      {formData.alertThresholds.length < 5 && (
                        <button
                          type="button"
                          onClick={addAlertThreshold}
                          style={{
                            padding: "6px 12px",
                            background: "#667eea",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            fontSize: "12px",
                            cursor: "pointer"
                          }}
                        >
                          + Agregar Alerta
                        </button>
                      )}
                    </div>
                    {formData.alertThresholds.map((threshold, index) => (
                      <div key={index} style={{ display: "flex", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={threshold}
                          onChange={(e) => updateAlertThreshold(index, parseInt(e.target.value) || 0)}
                          required
                          style={{
                            flex: 1,
                            padding: "8px",
                            border: "1px solid #ddd",
                            borderRadius: "6px",
                            fontSize: "14px"
                          }}
                        />
                        <span style={{ fontSize: "14px", color: "#666" }}>%</span>
                        {formData.alertThresholds.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeAlertThreshold(index)}
                            style={{
                              padding: "8px 12px",
                              background: "#dc3545",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              fontSize: "12px",
                              cursor: "pointer"
                            }}
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    ))}
                    <div style={{ fontSize: "12px", color: "#666", marginTop: "8px" }}>
                      Se enviará una notificación cuando el gasto alcance cada porcentaje configurado.
                    </div>
                  </div>

                  {error && (
                    <div style={{
                      padding: "12px",
                      background: "#fee",
                      color: "#c33",
                      borderRadius: "8px",
                      fontSize: "14px"
                    }}>
                      {error}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "12px" }}>
                    <button
                      type="submit"
                      style={{
                        padding: "12px 24px",
                        background: "var(--color-bg-primary, #FAFBFC)",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        fontSize: "16px",
                        fontWeight: "600",
                        cursor: "pointer"
                      }}
                    >
                      {editing ? "Actualizar" : "Crear"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreate(false);
                        setEditing(null);
                        setError(undefined);
                      }}
                      style={{
                        padding: "12px 24px",
                        background: "#f0f0f0",
                        color: "#333",
                        border: "none",
                        borderRadius: "8px",
                        fontSize: "16px",
                        fontWeight: "600",
                        cursor: "pointer"
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: "center", padding: "40px" }}>Cargando...</div>
          ) : limits.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
              No hay límites configurados para este mes.
            </div>
          ) : (
            <div style={{ display: "grid", gap: "16px" }}>
              {limits.map((limit: any) => {
                const percentage = limit.budgetCents > 0
                  ? Math.round((limit.spentCents / limit.budgetCents) * 100)
                  : 0;
                const isAlert = limit.hasActiveAlert || percentage >= 100;
                
                return (
                  <div
                    key={limit.id}
                    style={{
                      background: isAlert ? "rgba(245, 158, 11, 0.1)" : "white",
                      border: `2px solid ${isAlert ? "#F59E0B" : "#e0e0e0"}`,
                      borderRadius: "12px",
                      padding: "20px"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                      <div>
                        <div style={{ fontSize: "18px", fontWeight: "700", marginBottom: "4px" }}>
                          {limit.category?.name || "Categoría desconocida"}
                        </div>
                        <div style={{ fontSize: "12px", color: "#666" }}>
                          {new Date(limit.month).toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          onClick={() => handleEdit(limit)}
                          style={{
                            padding: "8px 16px",
                            background: "#667eea",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            fontSize: "12px",
                            cursor: "pointer"
                          }}
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(limit.id)}
                          style={{
                            padding: "8px 16px",
                            background: "#dc3545",
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
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "12px" }}>
                      <div>
                        <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>Límite</div>
                        <div style={{ fontSize: "16px", fontWeight: "600" }}>
                          {fmtMoney(limit.budgetCents, user?.currencyCode || "USD")}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>Gastado</div>
                        <div style={{ fontSize: "16px", fontWeight: "600", color: percentage >= 100 ? "#dc3545" : "#333" }}>
                          {fmtMoney(limit.spentCents || 0, user?.currencyCode || "USD")}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>Progreso</div>
                        <div style={{ 
                          fontSize: "16px", 
                          fontWeight: "600",
                          color: percentage >= 100 ? "#dc3545" : percentage >= 80 ? "#F59E0B" : "#059669"
                        }}>
                          {percentage}%
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: "12px" }}>
                      <div style={{ width: "100%", height: "8px", background: "#e0e0e0", borderRadius: "4px", overflow: "hidden" }}>
                        <div style={{
                          width: `${Math.min(100, percentage)}%`,
                          height: "100%",
                          background: percentage >= 100 ? "#dc3545" : percentage >= 80 ? "#F59E0B" : "#059669",
                          transition: "width 0.3s"
                        }} />
                      </div>
                    </div>

                    {limit.alertThresholds && limit.alertThresholds.length > 0 && (
                      <div style={{ marginTop: "12px", fontSize: "12px", color: "#666" }}>
                        Alertas configuradas: {limit.alertThresholds.join("%, ")}%
                      </div>
                    )}
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

