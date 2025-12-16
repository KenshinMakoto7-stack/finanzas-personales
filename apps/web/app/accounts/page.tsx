"use client";
import { useEffect, useState } from "react";
import api, { setAuthToken } from "../../lib/api";
import { useAuth } from "../../store/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AccountsPage() {
  const { user, token, initialized, initAuth } = useAuth();
  const router = useRouter();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingAccount, setEditingAccount] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "CASH" as "CASH" | "BANK" | "CREDIT" | "SAVINGS" | "OTHER",
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
    setFormData({ ...formData, currencyCode: user.currencyCode || "USD" });

    loadAccounts();
  }, [user, token, initialized, router, initAuth]);

  async function loadAccounts() {
    try {
      const res = await api.get("/accounts");
      setAccounts(res.data.accounts);
    } catch (err: any) {
      console.error("Error loading accounts:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post("/accounts", formData);
      setShowCreate(false);
      setFormData({ name: "", type: "CASH", currencyCode: user?.currencyCode || "USD" });
      loadAccounts();
    } catch (err: any) {
      alert(err?.response?.data?.error || "Error al crear cuenta");
    }
  }

  async function handleEdit(account: any) {
    setEditingAccount(account.id);
    setFormData({
      name: account.name,
      type: account.type,
      currencyCode: account.currencyCode
    });
    setShowCreate(false);
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingAccount) return;
    try {
      await api.put(`/accounts/${editingAccount}`, { name: formData.name });
      setEditingAccount(null);
      setFormData({ name: "", type: "CASH", currencyCode: user?.currencyCode || "USD" });
      loadAccounts();
    } catch (err: any) {
      alert(err?.response?.data?.error || "Error al actualizar cuenta");
    }
  }

  function handleCancelEdit() {
    setEditingAccount(null);
    setFormData({ name: "", type: "CASH", currencyCode: user?.currencyCode || "USD" });
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Estás seguro de eliminar esta cuenta? Las transacciones asociadas se mantendrán.")) return;
    try {
      await api.delete(`/accounts/${id}`);
      loadAccounts();
    } catch (err: any) {
      alert(err?.response?.data?.error || "Error al eliminar");
    }
  }

  if (!user) return null;

  const typeLabels: Record<string, string> = {
    CASH: "Efectivo",
    BANK: "Banco",
    CREDIT: "Tarjeta de Crédito",
    SAVINGS: "Ahorro",
    OTHER: "Otro"
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--color-bg-primary, #FAFBFC)",
      padding: "20px"
    }}>
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
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
                Gestión de Cuentas
              </h1>
            </div>
            <button
              onClick={() => setShowCreate(true)}
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
              + Nueva Cuenta
            </button>
          </div>

          {(showCreate || editingAccount) && (
            <div style={{
              background: "#f8f9fa",
              padding: "24px",
              borderRadius: "12px",
              marginBottom: "24px"
            }}>
              <h3 style={{ marginBottom: "16px", color: "#333" }}>
                {editingAccount ? "Editar Cuenta" : "Nueva Cuenta"}
              </h3>
              <form onSubmit={editingAccount ? handleUpdate : handleSubmit}>
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>Nombre *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Efectivo, Banco Santander, Tarjeta Visa..."
                    required
                    style={{
                      width: "100%",
                      padding: "12px",
                      border: "2px solid #e0e0e0",
                      borderRadius: "8px",
                      fontSize: "16px"
                    }}
                  />
                </div>
                {!editingAccount && (
                  <>
                    <div style={{ marginBottom: "16px" }}>
                      <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>Tipo *</label>
                      <select
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                        required
                        style={{
                          width: "100%",
                          padding: "12px",
                          border: "2px solid #e0e0e0",
                          borderRadius: "8px",
                          fontSize: "16px"
                        }}
                      >
                        <option value="CASH">Efectivo</option>
                        <option value="BANK">Banco</option>
                        <option value="CREDIT">Tarjeta de Crédito</option>
                        <option value="SAVINGS">Ahorro</option>
                        <option value="OTHER">Otro</option>
                      </select>
                    </div>
                    <div style={{ marginBottom: "16px" }}>
                      <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>Moneda *</label>
                      <select
                        value={formData.currencyCode}
                        onChange={(e) => setFormData({ ...formData, currencyCode: e.target.value })}
                        required
                        style={{
                          width: "100%",
                          padding: "12px",
                          border: "2px solid #e0e0e0",
                          borderRadius: "8px",
                          fontSize: "16px"
                        }}
                      >
                        <option value="USD">USD - Dólar Estadounidense</option>
                        <option value="UYU">UYU - Peso Uruguayo</option>
                      </select>
                    </div>
                  </>
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
                    {editingAccount ? "Actualizar" : "Crear"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (editingAccount) {
                        handleCancelEdit();
                      } else {
                        setShowCreate(false);
                        setFormData({ name: "", type: "CASH", currencyCode: user?.currencyCode || "USD" });
                      }
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
              </form>
            </div>
          )}

          {loading ? (
            <p>Cargando...</p>
          ) : accounts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
              <p style={{ marginBottom: "16px" }}>No tienes cuentas creadas</p>
              <button
                onClick={() => setShowCreate(true)}
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
                Crear Primera Cuenta
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {accounts.map(account => (
                <div
                  key={account.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px",
                    background: "#f8f9fa",
                    borderRadius: "12px",
                    border: "2px solid #e0e0e0"
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "600", color: "#333", marginBottom: "4px", fontSize: "18px" }}>
                      {account.name}
                    </div>
                    <div style={{ fontSize: "14px", color: "#666" }}>
                      {typeLabels[account.type]} • {account.currencyCode}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => handleEdit(account)}
                      style={{
                        padding: "8px 16px",
                        background: "#667eea",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "14px",
                        cursor: "pointer"
                      }}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(account.id)}
                      style={{
                        padding: "8px 16px",
                        background: "var(--color-expense, #B45309)",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "14px",
                        cursor: "pointer"
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


