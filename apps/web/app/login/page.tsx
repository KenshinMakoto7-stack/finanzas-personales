"use client";
import { useState } from "react";
import { useAuth } from "../../store/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setLoading(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Error al iniciar sesión. Verifica tus credenciales.");
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
      padding: "20px"
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
            Finanzas Personales
          </h1>
          <p style={{ color: "#666", fontSize: "16px" }}>Inicia sesión en tu cuenta</p>
        </div>

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

          <div style={{ marginBottom: "24px" }}>
            <label style={{ 
              display: "block", 
              marginBottom: "8px", 
              color: "#333", 
              fontWeight: "600",
              fontSize: "14px"
            }}>
              Contraseña
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 5px 20px rgba(102, 126, 234, 0.4)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
          </button>

          <div style={{ textAlign: "center", marginTop: "24px" }}>
            <p style={{ color: "#666", fontSize: "14px", marginBottom: "8px" }}>
              <Link href="/forgot-password" style={{ 
                color: "#667eea", 
                textDecoration: "none", 
                fontWeight: "600",
                fontSize: "13px"
              }}>
                ¿Olvidaste tu contraseña?
              </Link>
            </p>
            <p style={{ color: "#666", fontSize: "14px" }}>
              ¿No tienes cuenta?{" "}
              <Link href="/signup" style={{ 
                color: "#667eea", 
                textDecoration: "none", 
                fontWeight: "600" 
              }}>
                Crear cuenta
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
