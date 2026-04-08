"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const STORAGE_KEY = "firstSteps_done";

interface FirstStepsProps {
  hasIncome: boolean;
  hasFixedExpenses: boolean;
  hasTransactions: boolean;
  onComplete?: () => void;
}

interface Step {
  id: string;
  label: string;
  description: string;
  href: string;
  linkText: string;
  done: boolean;
  optional: boolean;
}

export default function FirstSteps({ hasIncome, hasFixedExpenses, hasTransactions, onComplete }: FirstStepsProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      // ignore
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // ignore
    }
    setVisible(false);
    onComplete?.();
  }

  if (!visible) return null;

  const steps: Step[] = [
    {
      id: "income",
      label: "Configura tu sueldo",
      description: "Indicá cuánto ganás por mes para que calculemos tu presupuesto diario.",
      href: "/ajustes",
      linkText: "Ir a Ajustes",
      done: hasIncome,
      optional: false,
    },
    {
      id: "fixed",
      label: "Agrega gastos fijos",
      description: "Alquiler, servicios, suscripciones — lo que pagás todos los meses.",
      href: "/ajustes",
      linkText: "Ir a Ajustes",
      done: hasFixedExpenses,
      optional: true,
    },
    {
      id: "debts",
      label: "Registra tus deudas",
      description: "Si tenés cuotas mensuales, agregalas para llevar el seguimiento.",
      href: "/ajustes",
      linkText: "Ir a Ajustes",
      done: false,
      optional: true,
    },
    {
      id: "first-tx",
      label: "Registra tu primer gasto",
      description: "Usá el formulario de arriba para registrar un gasto o ingreso.",
      href: "#tour-formulario",
      linkText: "Ver formulario",
      done: hasTransactions,
      optional: false,
    },
  ];

  const requiredDone = steps.filter((s) => !s.optional).every((s) => s.done);
  if (requiredDone) {
    dismiss();
    return null;
  }

  const completedCount = steps.filter((s) => s.done).length;

  return (
    <div className="bg-gradient-to-br from-brand/5 via-white to-brand/5 border border-brand/20 rounded-2xl p-5 mb-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Bienvenido a Finanzas</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Seguí estos pasos para configurar tu app ({completedCount}/{steps.length} completados)
          </p>
        </div>
        <button
          onClick={dismiss}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors shrink-0 ml-2 mt-1"
        >
          Ocultar
        </button>
      </div>

      <div className="space-y-3">
        {steps.map((step, i) => (
          <div
            key={step.id}
            className={`flex items-start gap-3 p-3 rounded-xl transition-all ${
              step.done ? "bg-income/5 border border-income/20" : "bg-white border border-slate-100"
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold ${
                step.done
                  ? "bg-income text-white"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {step.done ? "✓" : i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className={`text-sm font-semibold ${step.done ? "text-income line-through" : "text-slate-900"}`}>
                  {step.label}
                </p>
                {step.optional && !step.done && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400">Opcional</span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{step.description}</p>
              {!step.done && (
                step.href.startsWith("#") ? (
                  <button
                    onClick={() => {
                      const el = document.querySelector(step.href);
                      el?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }}
                    className="text-xs font-semibold text-brand mt-1.5 hover:underline"
                  >
                    {step.linkText} →
                  </button>
                ) : (
                  <Link href={step.href} className="text-xs font-semibold text-brand mt-1.5 inline-block hover:underline">
                    {step.linkText} →
                  </Link>
                )
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={dismiss}
        className="w-full mt-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
      >
        Ya lo sé, ocultar guía
      </button>
    </div>
  );
}
