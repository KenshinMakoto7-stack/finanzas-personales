"use client";
import { useEffect, useState } from "react";
import api, { setAuthToken } from "../../lib/api";
import { useAuth } from "../../store/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function TagsPage() {
  const { user, token, initialized, initAuth } = useAuth();
  const router = useRouter();
  const [tags, setTags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    color: "#667eea"
  });
  const [editingId, setEditingId] = useState<string | null>(null);

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
    loadTags();
  }, [user, token, initialized, initAuth]);

  async function loadTags() {
    setLoading(true);
    try {
      const res = await api.get("/tags");
      setTags(res.data.tags || []);
    } catch (err: any) {
      console.error("Error loading tags:", err);
      if (err?.response?.status === 401) {
        router.push("/login");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/tags/${editingId}`, formData);
      } else {
        await api.post("/tags", formData);
      }
      setShowForm(false);
      setFormData({ name: "", color: "#667eea" });
      setEditingId(null);
      loadTags();
    } catch (err: any) {
      alert(err?.response?.data?.error || "Error al guardar tag");
    }
  }

  function startEdit(tag: any) {
    setFormData({ name: tag.name, color: tag.color || "#667eea" });
    setEditingId(tag.id);
    setShowForm(true);
  }

  async function deleteTag(id: string) {
    if (!confirm("¿Eliminar este tag?")) return;
    try {
      await api.delete(`/tags/${id}`);
      loadTags();
    } catch (err) {
      alert("Error al eliminar tag");
    }
  }

  if (!user) return null;

  return (
    <div style={{ 
      minHeight: "100vh",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      padding: "20px"
    }}>
      <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
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
          <h1 style={{
            fontSize: "28px",
            fontWeight: "700",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent"
          }}>
            Etiquetas (Tags)
          </h1>
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              onClick={() => {
                setShowForm(!showForm);
                if (!showForm) {
                  setFormData({ name: "", color: "#667eea" });
                  setEditingId(null);
                }
              }}
              style={{
                padding: "10px 20px",
                background: showForm ? "#f0f0f0" : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: showForm ? "#333" : "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer"
              }}
            >
              {showForm ? "Cancelar" : "Nueva Etiqueta"}
            </button>
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
          </div>
        </div>

        {/* Formulario */}
        {showForm && (
          <div style={{
            background: "white",
            borderRadius: "20px",
            padding: "24px",
            marginBottom: "24px",
            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)"
          }}>
            <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "16px" }}>
              {editingId ? "Editar Etiqueta" : "Nueva Etiqueta"}
            </h3>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label htmlFor="tag-name-input" style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600" }}>
                  Nombre
                </label>
                <input
                  id="tag-name-input"
                  name="tag-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="Ej: Urgente, Personal, Trabajo..."
                  style={{
                    width: "100%",
                    padding: "10px",
                    border: "2px solid #e0e0e0",
                    borderRadius: "8px",
                    fontSize: "14px"
                  }}
                />
              </div>
              <div>
                <label htmlFor="tag-color-input" style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600" }}>
                  Color
                </label>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <input
                    id="tag-color-picker-input"
                    name="tag-color-picker"
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    style={{
                      width: "60px",
                      height: "40px",
                      border: "2px solid #e0e0e0",
                      borderRadius: "8px",
                      cursor: "pointer"
                    }}
                  />
                  <input
                    id="tag-color-input"
                    name="tag-color"
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    placeholder="#667eea"
                    style={{
                      flex: 1,
                      padding: "10px",
                      border: "2px solid #e0e0e0",
                      borderRadius: "8px",
                      fontSize: "14px"
                    }}
                  />
                </div>
              </div>
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
                {editingId ? "Actualizar" : "Crear"} Etiqueta
              </button>
            </form>
          </div>
        )}

        {/* Lista de Tags */}
        <div style={{
          background: "white",
          borderRadius: "20px",
          padding: "24px",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)"
        }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px" }}>
              <p style={{ color: "#666" }}>Cargando...</p>
            </div>
          ) : tags.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px" }}>
              <p style={{ color: "#666" }}>No hay etiquetas creadas</p>
            </div>
          ) : (
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", 
              gap: "16px" 
            }}>
              {tags.map((tag: any) => (
                <div
                  key={tag.id}
                  style={{
                    padding: "20px",
                    background: "#f8f9fa",
                    borderRadius: "12px",
                    border: "1px solid #e0e0e0"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        display: "inline-block",
                        padding: "8px 16px",
                        borderRadius: "8px",
                        background: tag.color || "#667eea",
                        color: "white",
                        fontSize: "14px",
                        fontWeight: "600",
                        marginBottom: "8px"
                      }}>
                        {tag.name}
                      </div>
                      <div style={{ fontSize: "12px", color: "#666" }}>
                        {tag.transactionCount || 0} transacción{tag.transactionCount !== 1 ? "es" : ""}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => startEdit(tag)}
                      style={{
                        flex: 1,
                        padding: "8px",
                        background: "#f0f0f0",
                        color: "#333",
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
                      onClick={() => deleteTag(tag.id)}
                      style={{
                        flex: 1,
                        padding: "8px",
                        background: "#f0f0f0",
                        color: "#e74c3c",
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
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

