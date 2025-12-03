"use client";
import { useState } from "react";
import { useAuth } from "../../store/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useZodForm, Form, FormInput, FormSelect, Button } from "../../components/ui";
import { RegisterSchema, RegisterInput } from "../../lib/schemas";

export default function SignupPage() {
  const { register } = useAuth();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const form = useZodForm(RegisterSchema, {
    email: "",
    password: "",
    currencyCode: "UYU",
    timeZone: "America/Montevideo",
  });

  async function onSubmit(data: RegisterInput) {
    setError(undefined);
    setLoading(true);
    try {
      await register({ 
        email: data.email, 
        password: data.password, 
        currencyCode: data.currencyCode, 
        timeZone: data.timeZone 
      });
      router.push("/dashboard");
    } catch (err: any) {
      // Mejorar manejo de errores
      let errorMessage = "Error al crear la cuenta. Intenta nuevamente.";
      
      if (err?.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err?.message) {
        errorMessage = err.message;
      } else if (err?.code === "ECONNABORTED") {
        errorMessage = "La solicitud tardó demasiado. Verifica tu conexión e intenta nuevamente.";
      } else if (err?.code === "ECONNREFUSED" || err?.message?.includes("Network Error")) {
        errorMessage = "No se pudo conectar con el servidor. Verifica tu conexión.";
      }
      
      setError(errorMessage);
      console.error("Error en registro:", err);
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
        background: "var(--color-bg-white, #FFFFFF)",
        borderRadius: "20px",
        boxShadow: "var(--shadow-xl, 0 20px 25px -5px rgba(0, 0, 0, 0.1))",
        border: "1px solid var(--color-border-light, #F3F4F6)",
        padding: "40px",
        maxWidth: "420px",
        width: "100%"
      }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h1 style={{ 
            fontSize: "32px", 
            fontWeight: "700", 
            color: "var(--color-primary, #4F46E5)",
            marginBottom: "8px",
            fontFamily: "'Inter', sans-serif"
          }}>
            Crear Cuenta
          </h1>
          <p style={{ color: "var(--color-text-secondary, #6B7280)", fontSize: "16px" }}>Comienza a gestionar tus finanzas</p>
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
            label="Contraseña (mínimo 8 caracteres)"
            type="password"
            placeholder="••••••••"
          />

          <FormSelect
            form={form}
            name="currencyCode"
            label="Moneda"
            options={[
              { value: "UYU", label: "UYU - Peso Uruguayo" },
              { value: "USD", label: "USD - Dólar Estadounidense" },
            ]}
          />

          <FormInput
            form={form}
            name="timeZone"
            label="Zona Horaria"
            placeholder="America/Montevideo"
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
            Crear Cuenta
          </Button>

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
        </Form>
      </div>
    </div>
  );
}
