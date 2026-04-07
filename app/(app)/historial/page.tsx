"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/store/auth";
import { apiFetch } from "@/lib/api";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function fmt(n: number): string {
  return `$ ${Math.abs(n).toLocaleString("es-UY")}`;
}

function formatDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAY_NAMES[date.getDay()]} ${d}`;
}

interface Transaction {
  id: string;
  amount: number;
  type: string;
  categoryName: string;
  note: string;
  date: string;
  createdAt: string;
}

export default function HistorialPage() {
  const { user } = useAuth();
  const today = new Date();

  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const txns = await apiFetch<Transaction[]>(`/transactions?month=${monthKey}`);
      setTransactions(txns);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, [monthKey]);

  useEffect(() => {
    if (user) loadTransactions();
  }, [user, loadTransactions]);

  function prevMonth() {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    const isCurrentMonth = selectedYear === today.getFullYear() && selectedMonth === today.getMonth();
    if (isCurrentMonth) return;
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiFetch(`/transactions/${id}`, { method: "DELETE" });
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar");
    }
  }

  const isCurrentMonth = selectedYear === today.getFullYear() && selectedMonth === today.getMonth();

  // Group by date
  const grouped: Record<string, Transaction[]> = {};
  for (const tx of transactions) {
    const key = tx.date || "sin-fecha";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(tx);
  }
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  // Totals
  const totalExpenses = transactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((s, t) => s + t.amount, 0);
  const totalIncome = transactions
    .filter((t) => t.type === "INCOME")
    .reduce((s, t) => s + t.amount, 0);

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 md:max-w-none md:mx-0 md:px-8 lg:px-12 md:pt-8">
      {/* Header with month nav */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Historial</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
          >
            ←
          </button>
          <span className="text-sm font-semibold text-slate-700 min-w-[120px] text-center">
            {MONTH_NAMES[selectedMonth]} {selectedYear}
          </span>
          <button
            onClick={nextMonth}
            disabled={isCurrentMonth}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            →
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-expense text-sm p-3 rounded-xl border-l-4 border-expense mb-4">
          {error}
        </div>
      )}

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
          <p className="text-xs font-semibold text-slate-500 mb-1">Ingresos</p>
          <p className="text-lg font-bold text-income">{fmt(totalIncome)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
          <p className="text-xs font-semibold text-slate-500 mb-1">Gastos</p>
          <p className="text-lg font-bold text-expense">{fmt(totalExpenses)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
          <p className="text-xs font-semibold text-slate-500 mb-1">Transacciones</p>
          <p className="text-lg font-bold text-slate-900">{transactions.length}</p>
        </div>
      </div>

      {/* Transactions grouped by day */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-3 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
          <p className="text-slate-400 text-sm">
            No hay transacciones en {MONTH_NAMES[selectedMonth]} {selectedYear}
          </p>
        </div>
      ) : (
        <div className="space-y-4 mb-8">
          {sortedDates.map((dateKey) => {
            const dayTxns = grouped[dateKey];
            const dayTotal = dayTxns.reduce(
              (s, t) => s + (t.type === "EXPENSE" ? -t.amount : t.amount),
              0
            );
            return (
              <div key={dateKey}>
                {/* Day header */}
                <div className="flex items-center justify-between mb-2 px-1">
                  <p className="text-sm font-bold text-slate-700">
                    {formatDay(dateKey)}
                  </p>
                  <p
                    className={`text-sm font-bold ${
                      dayTotal >= 0 ? "text-income" : "text-expense"
                    }`}
                  >
                    {dayTotal < 0 ? "-" : "+"}{fmt(Math.abs(dayTotal))}
                  </p>
                </div>

                {/* Day transactions */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  {dayTxns.map((tx, i) => (
                    <div
                      key={tx.id}
                      className={`flex items-center gap-3 px-4 py-3 ${
                        i < dayTxns.length - 1 ? "border-b border-slate-50" : ""
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {tx.categoryName}
                        </p>
                        {tx.note && (
                          <p className="text-xs text-slate-400 truncate">{tx.note}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <p
                          className={`text-sm font-bold ${
                            tx.type === "EXPENSE" ? "text-expense" : "text-income"
                          }`}
                        >
                          {tx.type === "EXPENSE" ? "-" : "+"}
                          {fmt(tx.amount)}
                        </p>
                        <button
                          onClick={() => handleDelete(tx.id)}
                          className="p-1.5 rounded-lg text-slate-300 hover:text-expense hover:bg-red-50 transition-colors"
                          title="Eliminar"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
