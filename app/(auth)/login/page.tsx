"use client";

import { useState } from "react";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
      router.replace("/hoy");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "auth/invalid-credential" || code === "auth/user-not-found" || code === "auth/wrong-password") {
        setError("Email o contraseña incorrectos");
      } else if (code === "auth/too-many-requests") {
        setError("Demasiados intentos. Esperá unos minutos.");
      } else {
        setError("Error al iniciar sesión. Intentá de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetEmail) return;
    setResetLoading(true);
    setError("");
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), resetEmail);
      setResetSent(true);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "auth/user-not-found") {
        setError("No existe una cuenta con ese email");
      } else {
        setError("Error al enviar el email. Intentá de nuevo.");
      }
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-brand mb-1">Finanzas</h1>
          <p className="text-slate-500 text-sm">
            {showReset ? "Recuperá tu contraseña" : "Iniciá sesión en tu cuenta"}
          </p>
        </div>

        {showReset ? (
          resetSent ? (
            <div className="text-center space-y-4">
              <div className="bg-green-50 text-income text-sm font-semibold p-4 rounded-xl border border-income/20">
                Te enviamos un email a <strong>{resetEmail}</strong> con instrucciones para restablecer tu contraseña.
              </div>
              <button onClick={() => { setShowReset(false); setResetSent(false); setResetEmail(""); }}
                className="text-brand font-semibold text-sm hover:underline">
                Volver al login
              </button>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label htmlFor="reset-email" className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Email de tu cuenta
                </label>
                <input id="reset-email" type="email" required value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-brand focus:outline-none transition-colors"
                  placeholder="tu@email.com" />
              </div>
              {error && (
                <div className="bg-red-50 text-expense text-sm p-3 rounded-xl border-l-4 border-expense">{error}</div>
              )}
              <button type="submit" disabled={resetLoading}
                className="w-full py-3.5 bg-brand text-white font-semibold rounded-xl hover:bg-brand-hover active:scale-[0.98] transition-all disabled:opacity-50">
                {resetLoading ? "Enviando..." : "Enviar email de recuperación"}
              </button>
              <button type="button" onClick={() => { setShowReset(false); setError(""); }}
                className="w-full text-center text-sm text-brand font-semibold hover:underline">
                Volver al login
              </button>
            </form>
          )
        ) : (
        <>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-brand focus:outline-none transition-colors"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-brand focus:outline-none transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-expense text-sm p-3 rounded-xl border-l-4 border-expense">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-brand text-white font-semibold rounded-xl hover:bg-brand-hover active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Ingresando..." : "Iniciar Sesión"}
          </button>
        </form>

        <p className="text-center mt-4">
          <button type="button" onClick={() => { setShowReset(true); setError(""); setResetEmail(email); }}
            className="text-sm text-slate-500 hover:text-brand hover:underline transition-colors">
            ¿Olvidaste tu contraseña?
          </button>
        </p>

        <p className="text-center text-sm text-slate-500 mt-3">
          ¿No tenés cuenta?{" "}
          <Link href="/registro" className="text-brand font-semibold hover:underline">
            Registrate
          </Link>
        </p>
        </>
        )}
      </div>
    </div>
  );
}
