"use client";

import Spinner from "./Spinner";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export default function Button({
  loading = false,
  variant = "primary",
  size = "md",
  children,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const variants = {
    primary: {
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      color: "white",
      border: "none",
    },
    secondary: {
      background: "white",
      color: "#667eea",
      border: "2px solid #667eea",
    },
    danger: {
      background: "#e74c3c",
      color: "white",
      border: "none",
    },
    ghost: {
      background: "transparent",
      color: "#667eea",
      border: "none",
    },
  };

  const sizes = {
    sm: { padding: "8px 16px", fontSize: 14, minHeight: 36 },
    md: { padding: "12px 24px", fontSize: 16, minHeight: 44 },
    lg: { padding: "16px 32px", fontSize: 18, minHeight: 52 },
  };

  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      disabled={isDisabled}
      style={{
        ...variants[variant],
        ...sizes[size],
        borderRadius: 8,
        fontWeight: 600,
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled ? 0.7 : 1,
        transition: "all 0.2s",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        width: "100%",
        ...style,
      }}
    >
      {loading && <Spinner size="sm" color={variant === "primary" || variant === "danger" ? "white" : "#667eea"} />}
      {children}
    </button>
  );
}

