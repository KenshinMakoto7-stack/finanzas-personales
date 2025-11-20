"use client";
import { useState } from "react";
import { useAuth } from "../../store/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [timeZone, setTimeZone] = useState("America/Montevideo");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setLoading(true);
    try {
      await register({ email, password, currencyCode, timeZone });
      router.push("/dashboard");
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Error al crear la cuenta. Intenta nuevamente.");
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
            Crear Cuenta
          </h1>
          <p style={{ color: "#666", fontSize: "16px" }}>Comienza a gestionar tus finanzas</p>
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

          <div style={{ marginBottom: "20px" }}>
            <label style={{ 
              display: "block", 
              marginBottom: "8px", 
              color: "#333", 
              fontWeight: "600",
              fontSize: "14px"
            }}>
              Contraseña (mínimo 8 caracteres)
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
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

          <div style={{ marginBottom: "20px" }}>
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
              required
              style={{
                width: "100%",
                padding: "14px 16px",
                border: "2px solid #e0e0e0",
                borderRadius: "10px",
                fontSize: "16px",
                background: "white",
                cursor: "pointer",
                transition: "all 0.3s"
              }}
              onFocus={(e) => e.target.style.borderColor = "#667eea"}
              onBlur={(e) => e.target.style.borderColor = "#e0e0e0"}
            >
              <option value="USD">USD - Dólar Estadounidense</option>
              <option value="UYU">UYU - Peso Uruguayo</option>
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
              Zona Horaria
            </label>
            <input
              type="text"
              placeholder="America/Montevideo"
              value={timeZone}
              onChange={(e) => setTimeZone(e.target.value)}
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
            <small style={{ color: "#666", fontSize: "12px", marginTop: "4px", display: "block" }}>
              Por defecto: America/Montevideo (Uruguay)
            </small>
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
            {loading ? "Creando cuenta..." : "Crear Cuenta"}
          </button>

          <div style={{ textAlign: "center", marginTop: "24px" }}>
            <p style={{ color: "#666", fontSize: "14px" }}>
              ¿Ya tienes cuenta?{" "}
              <Link href="/login" style={{ 
                color: "#667eea", 
                textDecoration: "none", 
                fontWeight: "600" 
              }}>
                Iniciar sesión
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
