"use client";
import { useEffect, useState } from "react";
import api, { setAuthToken } from "../../lib/api";
import { useAuth } from "../../store/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

function fmtMoney(cents: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, { 
    style: "currency", 
    currency, 
    minimumFractionDigits: 0, 
    maximumFractionDigits: 0 
  }).format(cents / 100);
}

export default function TransactionsPage() {
  const { user, token, initialized, initAuth } = useAuth();
  const router = useRouter();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Filtros
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    categoryId: "",
    accountId: "",
    type: "",
    tagId: "",
    minAmount: "",
    maxAmount: "",
    search: "",
    sortBy: "occurredAt",
    sortOrder: "desc"
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

    loadCategories();
    loadAccounts();
    loadTags();
    loadTransactions();
  }, [user, token, initialized, page, filters, initAuth]);

  async function loadCategories() {
    try {
      const res = await api.get("/categories");
      setCategories(res.data.categories || []);
    } catch (err) {
      console.error("Error loading categories:", err);
    }
  }

  async function loadAccounts() {
    try {
      const res = await api.get("/accounts");
      setAccounts(res.data.accounts || []);
    } catch (err) {
      console.error("Error loading accounts:", err);
    }
  }

  async function loadTags() {
    try {
      const res = await api.get("/tags");
      setTags(res.data.tags || []);
    } catch (err) {
      console.error("Error loading tags:", err);
    }
  }

  async function loadTransactions() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.from) params.append("from", filters.from);
      if (filters.to) params.append("to", filters.to);
      if (filters.categoryId) params.append("categoryId", filters.categoryId);
      if (filters.accountId) params.append("accountId", filters.accountId);
      if (filters.type) params.append("type", filters.type);
      if (filters.tagId) params.append("tagId", filters.tagId);
      if (filters.minAmount) params.append("minAmount", filters.minAmount);
      if (filters.maxAmount) params.append("maxAmount", filters.maxAmount);
      if (filters.search) params.append("search", filters.search);
      params.append("page", page.toString());
      params.append("pageSize", pageSize.toString());
      params.append("sortBy", filters.sortBy);
      params.append("sortOrder", filters.sortOrder);

      const res = await api.get(`/transactions?${params.toString()}`);
      setTransactions(res.data.transactions || []);
      setTotal(res.data.total || 0);
    } catch (err: any) {
      console.error("Error loading transactions:", err);
      if (err?.response?.status === 401) {
        router.push("/login");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleFilterChange(key: string, value: string) {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page when filters change
  }

  function clearFilters() {
    setFilters({
      from: "",
      to: "",
      categoryId: "",
      accountId: "",
      type: "",
      tagId: "",
      minAmount: "",
      maxAmount: "",
      search: "",
      sortBy: "occurredAt",
      sortOrder: "desc"
    });
    setPage(1);
  }

  if (!user) return null;

  return (
    <div style={{ 
      minHeight: "100vh",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      padding: "20px"
    }}>
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
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
            Historial de Transacciones
          </h1>
          <div style={{ display: "flex", gap: "12px" }}>
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
            <Link href="/transactions/new">
              <button style={{
                padding: "10px 20px",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
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
        </div>

        {/* Filtros */}
        <div style={{
          background: "white",
          borderRadius: "20px",
          padding: "24px",
          marginBottom: "24px",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)"
        }}>
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
            gap: "16px",
            marginBottom: "16px"
          }}>
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: "#666" }}>
                Desde
              </label>
              <input
                type="date"
                value={filters.from}
                onChange={(e) => handleFilterChange("from", e.target.value)}
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
              <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: "#666" }}>
                Hasta
              </label>
              <input
                type="date"
                value={filters.to}
                onChange={(e) => handleFilterChange("to", e.target.value)}
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
              <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: "#666" }}>
                Categoría
              </label>
              <select
                value={filters.categoryId}
                onChange={(e) => handleFilterChange("categoryId", e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "2px solid #e0e0e0",
                  borderRadius: "8px",
                  fontSize: "14px"
                }}
              >
                <option value="">Todas</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: "#666" }}>
                Cuenta
              </label>
              <select
                value={filters.accountId}
                onChange={(e) => handleFilterChange("accountId", e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "2px solid #e0e0e0",
                  borderRadius: "8px",
                  fontSize: "14px"
                }}
              >
                <option value="">Todas</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: "#666" }}>
                Tipo
              </label>
              <select
                value={filters.type}
                onChange={(e) => handleFilterChange("type", e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "2px solid #e0e0e0",
                  borderRadius: "8px",
                  fontSize: "14px"
                }}
              >
                <option value="">Todos</option>
                <option value="INCOME">Ingreso</option>
                <option value="EXPENSE">Gasto</option>
                <option value="TRANSFER">Transferencia</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: "#666" }}>
                Tag
              </label>
              <select
                value={filters.tagId}
                onChange={(e) => handleFilterChange("tagId", e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "2px solid #e0e0e0",
                  borderRadius: "8px",
                  fontSize: "14px"
                }}
              >
                <option value="">Todos</option>
                {tags.map(tag => (
                  <option key={tag.id} value={tag.id}>{tag.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: "#666" }}>
                Monto Mínimo
              </label>
              <input
                type="number"
                value={filters.minAmount}
                onChange={(e) => handleFilterChange("minAmount", e.target.value)}
                placeholder="0"
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
              <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: "#666" }}>
                Monto Máximo
              </label>
              <input
                type="number"
                value={filters.maxAmount}
                onChange={(e) => handleFilterChange("maxAmount", e.target.value)}
                placeholder="999999"
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
              <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: "#666" }}>
                Buscar en Descripción
              </label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
                placeholder="Buscar..."
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
              <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: "#666" }}>
                Ordenar por
              </label>
              <select
                value={`${filters.sortBy}-${filters.sortOrder}`}
                onChange={(e) => {
                  const [sortBy, sortOrder] = e.target.value.split("-");
                  setFilters(prev => ({ ...prev, sortBy, sortOrder }));
                }}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "2px solid #e0e0e0",
                  borderRadius: "8px",
                  fontSize: "14px"
                }}
              >
                <option value="occurredAt-desc">Fecha (Más reciente)</option>
                <option value="occurredAt-asc">Fecha (Más antiguo)</option>
                <option value="amountCents-desc">Monto (Mayor)</option>
                <option value="amountCents-asc">Monto (Menor)</option>
              </select>
            </div>
          </div>
          <button
            onClick={clearFilters}
            style={{
              padding: "10px 20px",
              background: "#f0f0f0",
              color: "#333",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer"
            }}
          >
            Limpiar Filtros
          </button>
        </div>

        {/* Lista de Transacciones */}
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
          ) : transactions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px" }}>
              <p style={{ color: "#666" }}>No se encontraron transacciones</p>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: "16px", color: "#666", fontSize: "14px" }}>
                Mostrando {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, total)} de {total} transacciones
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {transactions.map((tx: any) => (
                  <div
                    key={tx.id}
                    style={{
                      padding: "16px",
                      background: "#f8f9fa",
                      borderRadius: "12px",
                      border: "1px solid #e0e0e0"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                          <div style={{
                            padding: "6px 12px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: "600",
                            background: tx.type === "INCOME" ? "#d4edda" : tx.type === "EXPENSE" ? "#f8d7da" : "#d1ecf1",
                            color: tx.type === "INCOME" ? "#155724" : tx.type === "EXPENSE" ? "#721c24" : "#0c5460"
                          }}>
                            {tx.type === "INCOME" ? "Ingreso" : tx.type === "EXPENSE" ? "Gasto" : "Transferencia"}
                          </div>
                          {tx.category && (
                            <div style={{ fontSize: "14px", fontWeight: "600", color: "#333" }}>
                              {tx.category.name}
                            </div>
                          )}
                        </div>
                        {tx.description && (
                          <div style={{ fontSize: "14px", color: "#666", marginBottom: "8px" }}>
                            {tx.description}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", fontSize: "12px", color: "#999" }}>
                          <span>{tx.account?.name}</span>
                          <span>•</span>
                          <span>{new Date(tx.occurredAt).toLocaleDateString("es-ES", { 
                            year: "numeric", 
                            month: "short", 
                            day: "numeric" 
                          })}</span>
                          {tx.tags && tx.tags.length > 0 && (
                            <>
                              <span>•</span>
                              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                {tx.tags.map((tag: any) => (
                                  <span
                                    key={tag.id}
                                    style={{
                                      padding: "2px 8px",
                                      borderRadius: "4px",
                                      background: tag.color || "#667eea",
                                      color: "white",
                                      fontSize: "11px"
                                    }}
                                  >
                                    {tag.name}
                                  </span>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{
                          fontSize: "20px",
                          fontWeight: "700",
                          color: tx.type === "INCOME" ? "#27ae60" : tx.type === "EXPENSE" ? "#e74c3c" : "#3498db"
                        }}>
                          {tx.type === "EXPENSE" ? "-" : tx.type === "INCOME" ? "+" : ""}
                          {fmtMoney(tx.amountCents, tx.currencyCode || user.currencyCode)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Paginación */}
              <div style={{ 
                display: "flex", 
                justifyContent: "center", 
                alignItems: "center", 
                gap: "12px", 
                marginTop: "24px" 
              }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{
                    padding: "10px 20px",
                    background: page === 1 ? "#e0e0e0" : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    color: page === 1 ? "#999" : "white",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: "600",
                    cursor: page === 1 ? "not-allowed" : "pointer"
                  }}
                >
                  Anterior
                </button>
                <span style={{ color: "#666", fontSize: "14px" }}>
                  Página {page} de {Math.ceil(total / pageSize)}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(Math.ceil(total / pageSize), p + 1))}
                  disabled={page >= Math.ceil(total / pageSize)}
                  style={{
                    padding: "10px 20px",
                    background: page >= Math.ceil(total / pageSize) ? "#e0e0e0" : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    color: page >= Math.ceil(total / pageSize) ? "#999" : "white",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: "600",
                    cursor: page >= Math.ceil(total / pageSize) ? "not-allowed" : "pointer"
                  }}
                >
                  Siguiente
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

