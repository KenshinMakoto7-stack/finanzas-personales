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

export default function PatternsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [patterns, setPatterns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    const token = localStorage.getItem("token");
    if (token) setAuthToken(token);

    loadSuggestions();
    loadPatterns();
  }, [user, selectedDate]);

  async function loadSuggestions() {
    try {
      const res = await api.get(`/patterns/suggestions?date=${selectedDate}`);
      setSuggestions(res.data.suggestions || []);
    } catch (err: any) {
      console.error("Error loading suggestions:", err);
      if (err?.response?.status === 401) {
        router.push("/login");
      }
    }
  }

  async function loadPatterns() {
    setLoading(true);
    try {
      const res = await api.get("/patterns");
      setPatterns(res.data.patterns || []);
    } catch (err: any) {
      console.error("Error loading patterns:", err);
      if (err?.response?.status === 401) {
        router.push("/login");
      }
    } finally {
      setLoading(false);
    }
  }

  async function analyzePatterns() {
    setAnalyzing(true);
    try {
      await api.post("/patterns/analyze?months=6");
      await loadPatterns();
      await loadSuggestions();
      alert("Análisis completado. Se han identificado nuevos patrones.");
    } catch (err: any) {
      alert(err?.response?.data?.error || "Error al analizar patrones");
    } finally {
      setAnalyzing(false);
    }
  }

  async function deletePattern(id: string) {
    if (!confirm("¿Eliminar este patrón?")) return;
    try {
      await api.delete(`/patterns/${id}`);
      loadPatterns();
    } catch (err) {
      alert("Error al eliminar patrón");
    }
  }

  if (!user) return null;

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
          <h1 style={{
            fontSize: "28px",
            fontWeight: "700",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent"
          }}>
            Reconocimiento de Patrones
          </h1>
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              onClick={analyzePatterns}
              disabled={analyzing}
              style={{
                padding: "10px 20px",
                background: analyzing ? "#e0e0e0" : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: analyzing ? "#999" : "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: analyzing ? "not-allowed" : "pointer"
              }}
            >
              {analyzing ? "Analizando..." : "Analizar Patrones"}
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

        {/* Sugerencias para Hoy */}
        <div style={{
          background: "white",
          borderRadius: "20px",
          padding: "24px",
          marginBottom: "24px",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "20px", fontWeight: "700", color: "#333" }}>
              Sugerencias para {new Date(selectedDate).toLocaleDateString("es-ES", { 
                weekday: "long", 
                year: "numeric", 
                month: "long", 
                day: "numeric" 
              })}
            </h3>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                padding: "8px 12px",
                border: "2px solid #e0e0e0",
                borderRadius: "8px",
                fontSize: "14px"
              }}
            />
          </div>
          {suggestions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
              No hay sugerencias disponibles. Analiza tus transacciones para generar patrones.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {suggestions.map((suggestion: any, i: number) => (
                <div
                  key={i}
                  style={{
                    padding: "16px",
                    background: "#f8f9fa",
                    borderRadius: "12px",
                    border: "1px solid #e0e0e0"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                        {suggestion.category && (
                          <div style={{ fontSize: "16px", fontWeight: "600", color: "#333" }}>
                            {suggestion.category.name}
                          </div>
                        )}
                        {suggestion.account && (
                          <div style={{ fontSize: "12px", color: "#666" }}>
                            en {suggestion.account.name}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: "14px", color: "#666", marginBottom: "8px" }}>
                        {suggestion.matchReason}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{
                          padding: "4px 8px",
                          background: suggestion.confidence >= 70 ? "#d4edda" : "#fff3cd",
                          color: suggestion.confidence >= 70 ? "#155724" : "#856404",
                          borderRadius: "4px",
                          fontSize: "12px",
                          fontWeight: "600"
                        }}>
                          Confianza: {suggestion.confidence}%
                        </div>
                        {suggestion.lastMatched && (
                          <div style={{ fontSize: "12px", color: "#999" }}>
                            Última vez: {new Date(suggestion.lastMatched).toLocaleDateString("es-ES")}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "20px", fontWeight: "700", color: "#667eea" }}>
                        {fmtMoney(suggestion.suggestedAmount, user.currencyCode)}
                      </div>
                      <div style={{ fontSize: "12px", color: "#666" }}>
                        Monto sugerido
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Patrones Identificados */}
        <div style={{
          background: "white",
          borderRadius: "20px",
          padding: "24px",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)"
        }}>
          <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "16px", color: "#333" }}>
            Patrones Identificados
          </h3>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px" }}>
              <p style={{ color: "#666" }}>Cargando...</p>
            </div>
          ) : patterns.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
              No hay patrones identificados. Haz clic en "Analizar Patrones" para comenzar.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {patterns.map((pattern: any) => (
                <div
                  key={pattern.id}
                  style={{
                    padding: "16px",
                    background: "#f8f9fa",
                    borderRadius: "12px",
                    border: "1px solid #e0e0e0"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                        {pattern.category && (
                          <div style={{ fontSize: "16px", fontWeight: "600", color: "#333" }}>
                            {pattern.category.name}
                          </div>
                        )}
                        {pattern.account && (
                          <div style={{ fontSize: "12px", color: "#666" }}>
                            en {pattern.account.name}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", fontSize: "12px", color: "#666" }}>
                        {pattern.dayOfWeek !== null && (
                          <span>
                            Día de semana: {["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"][pattern.dayOfWeek]}
                          </span>
                        )}
                        {pattern.dayOfMonth !== null && (
                          <span>
                            Día del mes: {pattern.dayOfMonth}
                          </span>
                        )}
                        <span>Frecuencia: {pattern.frequency} veces</span>
                        {pattern.lastMatched && (
                          <span>
                            Última vez: {new Date(pattern.lastMatched).toLocaleDateString("es-ES")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", marginLeft: "16px" }}>
                      {pattern.amountCents && (
                        <div style={{ fontSize: "18px", fontWeight: "700", color: "#667eea", marginBottom: "4px" }}>
                          {fmtMoney(pattern.amountCents, user.currencyCode)}
                        </div>
                      )}
                      <button
                        onClick={() => deletePattern(pattern.id)}
                        style={{
                          padding: "6px 12px",
                          background: "#f0f0f0",
                          color: "#e74c3c",
                          border: "none",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: "600",
                          cursor: "pointer",
                          marginTop: "8px"
                        }}
                      >
                        Eliminar
                      </button>
                    </div>
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

