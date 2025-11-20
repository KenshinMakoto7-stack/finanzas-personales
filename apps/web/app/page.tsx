import Link from "next/link";

export default function Home() {
  return (
    <div style={{ 
      minHeight: "100vh", 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      padding: "20px"
    }}>
      <div style={{
        background: "white",
        borderRadius: "20px",
        boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
        padding: "60px 40px",
        maxWidth: "500px",
        width: "100%",
        textAlign: "center"
      }}>
        <h1 style={{
          fontSize: "42px",
          fontWeight: "700",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          marginBottom: "16px"
        }}>
          Finanzas Personales
        </h1>
        <p style={{ color: "#666", fontSize: "18px", marginBottom: "32px" }}>
          Controla tu dinero día a día con un sistema claro de ingresos, metas de ahorro y presupuesto diario dinámico.
        </p>
        <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/login" style={{
            padding: "14px 32px",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
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
            background: "white",
            color: "#667eea",
            textDecoration: "none",
            borderRadius: "10px",
            fontSize: "16px",
            fontWeight: "600",
            border: "2px solid #667eea",
            display: "inline-block"
          }}>
            Crear Cuenta
          </Link>
        </div>
      </div>
    </div>
  );
}


