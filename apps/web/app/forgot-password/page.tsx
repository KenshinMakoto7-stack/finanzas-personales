"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "../../lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setSuccess(false);
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Error al solicitar recuperación de contraseña");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ 
      minHeight: "100vh", 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center",
      padding: "20px",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
    }}>
      <div style={{
        background: "white",
        borderRadius: "20px",
        boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
        padding: "40px",
        maxWidth: "420px",
        width: "100%"
      }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h1 style={{ 
            fontSize: "32px", 
            fontWeight: "700", 
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            marginBottom: "8px"
          }}>
            Recuperar Contraseña
          </h1>
          <p style={{ color: "#666", fontSize: "16px" }}>
            Ingresa tu email para recibir un enlace de recuperación
          </p>
        </div>

        {success ? (
          <div>
            <div style={{
              background: "#d4edda",
              color: "#155724",
              padding: "16px",
              borderRadius: "8px",
              marginBottom: "20px",
              borderLeft: "4px solid #27ae60"
            }}>
              <p style={{ margin: 0, fontSize: "14px" }}>
                Si el email existe en nuestro sistema, recibirás un enlace para recuperar tu contraseña.
              </p>
              <p style={{ margin: "12px 0 0 0", fontSize: "13px", color: "#666" }}>
                <strong>Nota para desarrollo:</strong> Revisa la consola del servidor para ver el token de recuperación.
              </p>
            </div>
            <Link href="/login">
              <button
                style={{
                  width: "100%",
                  padding: "14px",
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "10px",
                  fontSize: "16px",
                  fontWeight: "600",
                  cursor: "pointer"
                }}
              >
                Volver al Login
              </button>
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit}>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ 
                display: "block", 
                marginBottom: "8px", 
                color: "#333", 
                fontWeight: "600",
                fontSize: "14px"
              }}>
                Email
              </label>
              <input
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  border: "2px solid #e0e0e0",
                  borderRadius: "10px",
                  fontSize: "16px",
                  transition: "all 0.3s"
                }}
                onFocus={(e) => e.target.style.borderColor = "#667eea"}
                onBlur={(e) => e.target.style.borderColor = "#e0e0e0"}
              />
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
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "14px",
                background: loading ? "#ccc" : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: "white",
                border: "none",
                borderRadius: "10px",
                fontSize: "16px",
                fontWeight: "600",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "all 0.3s",
                marginBottom: "20px"
              }}
            >
              {loading ? "Enviando..." : "Enviar Enlace de Recuperación"}
            </button>

            <div style={{ textAlign: "center" }}>
              <Link href="/login" style={{ 
                color: "#667eea", 
                textDecoration: "none", 
                fontWeight: "600",
                fontSize: "14px"
              }}>
                ← Volver al Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

