"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/store/auth";
import { apiFetch } from "@/lib/api";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function fmt(n: number): string {
  return `$ ${Math.abs(n).toLocaleString("es-UY")}`;
}

interface Transaction {
  id: string;
  amount: number;
  type: string;
  categoryName: string;
  categoryId: string;
  date: string;
  note?: string;
}

interface Category {
  id: string;
  name: string;
  color: string;
  type: string;
  parentId: string | null;
  children?: Category[];
}

interface CategoryBreakdown {
  name: string;
  color: string;
  total: number;
  percent: number;
  count: number;
}

export default function ResumenPage() {
  const { user, categories: cachedCats, categoriesLoaded, setCategories: setCachedCats } = useAuth();
  const today = new Date();

  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>(cachedCats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const needCats = !categoriesLoaded;
      const [txns, cats] = await Promise.all([
        apiFetch<Transaction[]>(`/transactions?month=${monthKey}`),
        needCats ? apiFetch<Category[]>("/categories") : Promise.resolve(null),
      ]);
      setTransactions(txns);
      if (cats) {
        setCategories(cats);
        setCachedCats(cats);
      }
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, [monthKey, categoriesLoaded, setCachedCats]);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

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

  const isCurrentMonth = selectedYear === today.getFullYear() && selectedMonth === today.getMonth();

  // Compute totals
  const expenses = transactions.filter((t) => t.type === "EXPENSE");
  const totalExpenses = expenses.reduce((s, t) => s + t.amount, 0);
  const totalIncome = transactions
    .filter((t) => t.type === "INCOME")
    .reduce((s, t) => s + t.amount, 0);

  // Build category ID → parent name+color map
  const catMap = new Map<string, { name: string; color: string }>();
  for (const cat of categories) {
    catMap.set(cat.id, { name: cat.name, color: cat.color });
    if (cat.children) {
      for (const child of cat.children) {
        catMap.set(child.id, { name: cat.name, color: cat.color });
      }
    }
  }

  // Group expenses by parent category
  const byCategory = new Map<string, { color: string; total: number; count: number }>();
  for (const tx of expenses) {
    const parent = catMap.get(tx.categoryId);
    const key = parent?.name || tx.categoryName;
    const color = parent?.color || "#94a3b8";
    const existing = byCategory.get(key) || { color, total: 0, count: 0 };
    existing.total += tx.amount;
    existing.count += 1;
    byCategory.set(key, existing);
  }

  const breakdown: CategoryBreakdown[] = Array.from(byCategory.entries())
    .map(([name, data]) => ({
      name,
      color: data.color,
      total: data.total,
      percent: totalExpenses > 0 ? (data.total / totalExpenses) * 100 : 0,
      count: data.count,
    }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 md:max-w-none md:mx-0 md:px-8 lg:px-12 md:pt-8">
      {/* Header with month nav */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Resumen</h1>
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

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-3 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Overview cards */}
          <div className="md:grid md:grid-cols-2 md:gap-8">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
                  <p className="text-xs font-semibold text-slate-500 mb-1">Total ingresos</p>
                  <p className="text-2xl font-bold text-income">{fmt(totalIncome)}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
                  <p className="text-xs font-semibold text-slate-500 mb-1">Total gastos</p>
                  <p className="text-2xl font-bold text-expense">{fmt(totalExpenses)}</p>
                </div>
              </div>

              {/* Balance */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
                <p className="text-xs font-semibold text-slate-500 mb-1">Balance del mes</p>
                <p className={`text-2xl font-bold ${totalIncome - totalExpenses >= 0 ? "text-income" : "text-expense"}`}>
                  {totalIncome - totalExpenses < 0 ? "-" : "+"}{fmt(Math.abs(totalIncome - totalExpenses))}
                </p>
              </div>
            </div>

            {/* Visual bar chart */}
            <div className="mt-4 md:mt-0">
              {breakdown.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
                  <p className="text-slate-400 text-sm">
                    No hay gastos en {MONTH_NAMES[selectedMonth]}
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
                  <p className="text-sm font-bold text-slate-900 mb-4">
                    Distribución de gastos
                  </p>
                  {/* Stacked bar */}
                  <div className="h-6 rounded-full overflow-hidden flex mb-5">
                    {breakdown.map((cat) => (
                      <div
                        key={cat.name}
                        title={`${cat.name}: ${fmt(cat.total)} (${cat.percent.toFixed(0)}%)`}
                        className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                        style={{
                          width: `${cat.percent}%`,
                          backgroundColor: cat.color,
                          minWidth: cat.percent > 0 ? "4px" : "0",
                        }}
                      />
                    ))}
                  </div>

                  {/* Legend */}
                  <div className="space-y-2">
                    {breakdown.map((cat) => (
                      <div key={cat.name} className="flex items-center gap-3">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="flex-1 text-sm text-slate-700 truncate">
                          {cat.name}
                        </span>
                        <span className="text-xs text-slate-400 shrink-0">
                          {cat.count} gasto{cat.count !== 1 ? "s" : ""}
                        </span>
                        <span className="text-sm font-bold text-slate-900 shrink-0 min-w-[70px] text-right">
                          {fmt(cat.total)}
                        </span>
                        <span className="text-xs font-semibold text-slate-500 shrink-0 w-10 text-right">
                          {cat.percent.toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Top expenses */}
          {expenses.length > 0 && (
            <div className="mt-6 mb-8">
              <h2 className="text-lg font-bold text-slate-900 mb-3">
                Gastos más grandes
              </h2>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                {[...expenses]
                  .sort((a, b) => b.amount - a.amount)
                  .slice(0, 5)
                  .map((tx, i, arr) => (
                    <div
                      key={tx.id}
                      className={`flex items-center gap-3 px-4 py-3 ${
                        i < arr.length - 1 ? "border-b border-slate-50" : ""
                      }`}
                    >
                      <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {tx.categoryName}
                        </p>
                        {tx.note && (
                          <p className="text-xs text-slate-400 truncate">{tx.note}</p>
                        )}
                      </div>
                      <p className="text-sm font-bold text-expense shrink-0">
                        -{fmt(tx.amount)}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
