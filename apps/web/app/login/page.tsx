"use client";
import { useState } from "react";
import { useAuth } from "../../store/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useZodForm, Form, FormInput, Button } from "../../components/ui";
import { LoginSchema, LoginInput } from "../../lib/schemas";

export default function LoginPage() {
  const { login } = useAuth();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const form = useZodForm(LoginSchema, {
    email: "",
    password: "",
  });

  async function onSubmit(data: LoginInput) {
    setError(undefined);
    setLoading(true);
    try {
      await login(data.email, data.password);
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

        <Form form={form} onSubmit={onSubmit}>
          <FormInput
            form={form}
            name="email"
            label="Email"
            type="email"
            placeholder="tu@email.com"
          />

          <FormInput
            form={form}
            name="password"
            label="Contraseña"
            type="password"
            placeholder="••••••••"
          />

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

          <Button type="submit" loading={loading} disabled={!form.formState.isValid}>
            Iniciar Sesión
          </Button>

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
        </Form>
      </div>
    </div>
  );
}
