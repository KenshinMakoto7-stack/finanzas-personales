import Link from "next/link";

export default function Home() {
  return (
    <div style={{ 
      minHeight: "100vh", 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center",
      background: "var(--color-bg-primary, #FAFBFC)",
      padding: "20px"
    }}>
      <div style={{
        background: "var(--color-bg-white, #FFFFFF)",
        borderRadius: "20px",
        boxShadow: "var(--shadow-xl, 0 20px 25px -5px rgba(0, 0, 0, 0.1))",
        border: "1px solid var(--color-border-light, #F3F4F6)",
        padding: "60px 40px",
        maxWidth: "500px",
        width: "100%",
        textAlign: "center"
      }}>
        <h1 style={{
          fontSize: "42px",
          fontWeight: "700",
          color: "var(--color-primary, #4F46E5)",
          fontFamily: "'Inter', sans-serif",
          marginBottom: "16px"
        }}>
          Finanzas Personales
        </h1>
        <p style={{ color: "var(--color-text-secondary, #6B7280)", fontSize: "18px", marginBottom: "32px" }}>
          Controla tu dinero día a día con un sistema claro de ingresos, metas de ahorro y límites de gasto.
        </p>
        <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/login" style={{
            padding: "14px 32px",
            background: "var(--color-primary, #4F46E5)",
            color: "white",
            textDecoration: "none",
            borderRadius: "10px",
            fontSize: "16px",
            fontWeight: "600",
            display: "inline-block"
          }}>
            Iniciar Sesión
          </Link>
          <Link href="/signup" style={{
            padding: "14px 32px",
            background: "var(--color-bg-white, #FFFFFF)",
            color: "var(--color-primary, #4F46E5)",
            textDecoration: "none",
            borderRadius: "10px",
            fontSize: "16px",
            fontWeight: "600",
            border: "1px solid var(--color-primary, #4F46E5)",
            display: "inline-block"
          }}>
            Crear Cuenta
          </Link>
        </div>
      </div>
    </div>
  );
}


