"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import api from "../../lib/api";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [email, setEmail] = useState<string>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      setError("Token de recuperación no válido");
      setVerifying(false);
      return;
    }

    // Verificar token
    api.get(`/auth/verify-reset-token?token=${token}`)
      .then(res => {
        if (res.data.valid) {
          setEmail(res.data.email);
          setVerifying(false);
        } else {
          setError("Token inválido o expirado");
          setVerifying(false);
        }
      })
      .catch(() => {
        setError("Token inválido o expirado");
        setVerifying(false);
      });
  }, [token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Error al restablecer la contraseña");
    } finally {
      setLoading(false);
    }
  }

  if (verifying) {
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
          width: "100%",
          textAlign: "center"
        }}>
          <p style={{ color: "#667eea", fontSize: "16px", fontWeight: "600" }}>
            Verificando token...
          </p>
        </div>
      </div>
    );
  }

  if (error && !email) {
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
          <div style={{
            background: "#fee",
            color: "#e74c3c",
            padding: "16px",
            borderRadius: "8px",
            marginBottom: "20px",
            borderLeft: "4px solid #e74c3c"
          }}>
            <p style={{ margin: 0, fontSize: "14px" }}>{error}</p>
          </div>
          <Link href="/forgot-password">
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
              Solicitar Nuevo Enlace
            </button>
          </Link>
        </div>
      </div>
    );
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
            Nueva Contraseña
          </h1>
          <p style={{ color: "#666", fontSize: "16px" }}>
            {email && `Ingresa una nueva contraseña para ${email}`}
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
                Contraseña actualizada exitosamente. Redirigiendo al login...
              </p>
            </div>
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
                Nueva Contraseña
              </label>
              <input
                type="password"
                placeholder="Mínimo 8 caracteres"
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

            <div style={{ marginBottom: "24px" }}>
              <label style={{ 
                display: "block", 
                marginBottom: "8px", 
                color: "#333", 
                fontWeight: "600",
                fontSize: "14px"
              }}>
                Confirmar Contraseña
              </label>
              <input
                type="password"
                placeholder="Repite la contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
              {loading ? "Actualizando..." : "Actualizar Contraseña"}
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

