"use client";
import { useEffect, useState } from "react";
import api, { setAuthToken } from "../../lib/api";
import { useAuth } from "../../store/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function CategoriesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<any[]>([]);
  const [tree, setTree] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "EXPENSE" as "INCOME" | "EXPENSE",
    parentId: "",
    icon: "",
    color: "#667eea"
  });

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    const token = localStorage.getItem("token");
    if (token) setAuthToken(token);

    loadCategories();
  }, [user, router]);

  async function loadCategories() {
    try {
      const res = await api.get("/categories?tree=true");
      setTree(res.data.categories || []);
      setCategories(res.data.flat || []);
    } catch (err: any) {
      console.error("Error loading categories:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editing) {
        // Al editar, permitir cambiar nombre, parentId, icon y color
        await api.put(`/categories/${editing}`, {
          name: formData.name.trim(),
          parentId: formData.parentId && formData.parentId.trim() !== "" ? formData.parentId : null,
          icon: formData.icon && formData.icon.trim() !== "" ? formData.icon.trim() : null,
          color: formData.color && formData.color.trim() !== "" ? formData.color.trim() : null
        });
      } else {
        await api.post("/categories", {
          name: formData.name.trim(),
          type: formData.type,
          parentId: formData.parentId && formData.parentId.trim() !== "" ? formData.parentId : null,
          icon: formData.icon && formData.icon.trim() !== "" ? formData.icon.trim() : null,
          color: formData.color && formData.color.trim() !== "" ? formData.color.trim() : null
        });
      }
      setShowCreate(false);
      setEditing(null);
      setFormData({ name: "", type: "EXPENSE", parentId: "", icon: "", color: "#667eea" });
      loadCategories();
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error;
      if (typeof errorMsg === "string") {
        alert(errorMsg);
      } else if (errorMsg && typeof errorMsg === "object") {
        // Si es un objeto, intentar extraer mensajes
        const messages = Object.values(errorMsg).flat().join(", ");
        alert(messages || "Error al guardar la categoría");
      } else {
        alert("Error al guardar la categoría. Verifica que todos los campos estén completos.");
      }
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Estás seguro de eliminar esta categoría?")) return;
    try {
      await api.delete(`/categories/${id}`);
      loadCategories();
    } catch (err: any) {
      alert(err?.response?.data?.error || "Error al eliminar");
    }
  }

  function renderCategory(category: any, level = 0) {
    const hasChildren = category.subcategories && category.subcategories.length > 0;
    return (
      <div key={category.id} style={{ marginLeft: `${level * 24}px`, marginBottom: "12px" }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "12px",
          background: level === 0 ? "#f8f9fa" : "white",
          borderRadius: "8px",
          border: `2px solid ${category.color || "#e0e0e0"}`,
          borderLeftWidth: "4px"
        }}>
          <div style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            background: category.color || "#667eea",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontWeight: "700",
            fontSize: "14px"
          }}>
            {category.icon || category.name.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: "600", color: "#333" }}>{category.name}</div>
            <div style={{ fontSize: "12px", color: "#666" }}>
              {category.type === "EXPENSE" ? "Gasto" : "Ingreso"}
              {category.subcategories?.length > 0 && ` • ${category.subcategories.length} subcategorías`}
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => {
                setEditing(category.id);
                setFormData({
                  name: category.name,
                  type: category.type,
                  parentId: category.parentId || "",
                  icon: category.icon || "",
                  color: category.color || "#667eea"
                });
                setShowCreate(true);
              }}
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
              Editar
            </button>
            <button
              onClick={() => {
                setEditing(null); // Limpiar edición
                setFormData({
                  name: "",
                  type: category.type,
                  parentId: category.id,
                  icon: "",
                  color: category.color || "#667eea"
                });
                setShowCreate(true);
                // Scroll al formulario después de un pequeño delay para que se renderice
                setTimeout(() => {
                  const formElement = document.querySelector('[data-category-form]');
                  if (formElement) {
                    formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }, 100);
              }}
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
              + Sub
            </button>
            <button
              onClick={() => handleDelete(category.id)}
              style={{
                padding: "6px 12px",
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
        </div>
        {hasChildren && (
          <div style={{ marginTop: "8px" }}>
            {category.subcategories.map((sub: any) => renderCategory(sub, level + 1))}
          </div>
        )}
      </div>
    );
  }

  if (!user) return null;

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
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
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                marginTop: "8px"
              }}>
                Gestión de Categorías
              </h1>
            </div>
            <button
              onClick={() => {
                setShowCreate(true);
                setEditing(null);
                setFormData({ name: "", type: "EXPENSE", parentId: "", icon: "", color: "#667eea" });
              }}
              style={{
                padding: "12px 24px",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: "white",
                border: "none",
                borderRadius: "10px",
                fontSize: "16px",
                fontWeight: "600",
                cursor: "pointer"
              }}
            >
              + Nueva Categoría
            </button>
          </div>

          {showCreate && (
            <div 
              data-category-form
              style={{
                background: "#f8f9fa",
                padding: "24px",
                borderRadius: "12px",
                marginBottom: "24px",
                border: "2px solid #667eea"
              }}>
              <h3 style={{ marginBottom: "16px", color: "#333" }}>
                {editing ? "Editar Categoría" : formData.parentId ? "Nueva Subcategoría" : "Nueva Categoría"}
              </h3>
              {formData.parentId && !editing && (
                <div style={{
                  padding: "8px 12px",
                  background: "#e8f5e9",
                  borderRadius: "6px",
                  marginBottom: "16px",
                  fontSize: "14px",
                  color: "#2e7d32"
                }}>
                  ✓ Creando subcategoría de: <strong>{categories.find(c => c.id === formData.parentId)?.name || "Categoría padre"}</strong>
                </div>
              )}
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>Nombre *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                    <option value="EXPENSE">Gasto</option>
                    <option value="INCOME">Ingreso</option>
                  </select>
                </div>
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>
                    Categoría Padre {formData.parentId ? "(ya seleccionada)" : "(opcional)"}
                  </label>
                  <select
                    value={formData.parentId}
                    onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                    disabled={!!formData.parentId && !editing} // Deshabilitar si ya está seleccionada desde +Sub (pero permitir cambiar si está editando)
                    style={{
                      width: "100%",
                      padding: "12px",
                      border: "2px solid #e0e0e0",
                      borderRadius: "8px",
                      fontSize: "16px",
                      background: formData.parentId && !editing ? "#f0f0f0" : "white",
                      cursor: formData.parentId && !editing ? "not-allowed" : "pointer"
                    }}
                  >
                    <option value="">Sin categoría padre (raíz)</option>
                    {categories
                      .filter(c => c.type === formData.type && c.id !== editing && c.id !== formData.parentId)
                      .map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                  </select>
                  {formData.parentId && !editing && (
                    <small style={{ color: "#666", fontSize: "12px", marginTop: "4px", display: "block" }}>
                      Creando subcategoría de: {categories.find(c => c.id === formData.parentId)?.name || "Categoría padre"}
                    </small>
                  )}
                  {editing && formData.parentId && (
                    <small style={{ color: "#667eea", fontSize: "12px", marginTop: "4px", display: "block" }}>
                      Puedes cambiar la categoría padre para mover esta categoría
                    </small>
                  )}
                </div>
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>Icono (opcional)</label>
                  <input
                    type="text"
                    placeholder="Ej: 🏠, 💰, 🍔"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "12px",
                      border: "2px solid #e0e0e0",
                      borderRadius: "8px",
                      fontSize: "16px"
                    }}
                  />
                </div>
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>Color</label>
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    style={{
                      width: "100%",
                      height: "40px",
                      border: "2px solid #e0e0e0",
                      borderRadius: "8px"
                    }}
                  />
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
                      setFormData({ name: "", type: "EXPENSE", parentId: "", icon: "", color: "#667eea" });
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
          ) : (
            <div>
              <h2 style={{ marginBottom: "16px", color: "#333" }}>Categorías de Gastos</h2>
              <div style={{ marginBottom: "32px" }}>
                {tree.filter(c => c.type === "EXPENSE").map(c => renderCategory(c))}
              </div>

              <h2 style={{ marginBottom: "16px", color: "#333" }}>Categorías de Ingresos</h2>
              <div>
                {tree.filter(c => c.type === "INCOME").map(c => renderCategory(c))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


