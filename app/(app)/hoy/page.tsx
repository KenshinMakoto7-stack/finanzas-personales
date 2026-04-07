"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/store/auth";
import { apiFetch } from "@/lib/api";
import ConfirmDialog from "@/components/ConfirmDialog";
import PageTour from "@/components/PageTour";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function fmt(amount: number): string {
  return `$ ${Math.abs(amount).toLocaleString("es-UY")}`;
}

interface Category {
  id: string;
  name: string;
  type: string;
  color: string;
  parentId: string | null;
  children?: Category[];
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

interface Settings {
  monthlyIncome: number;
  monthlySavings: number;
}

interface FixedExpense {
  id: string;
  name: string;
  amount: number;
}

interface Debt {
  id: string;
  name: string;
  installmentAmount: number;
  totalInstallments: number;
  paidInstallments: number;
  dueDay: number;
  status: "active" | "completed";
}

export default function HoyPage() {
  const { user, categories: cachedCats, categoriesLoaded, setCategories: setCachedCats } = useAuth();
  const today = new Date();
  const month = MONTH_NAMES[today.getMonth()];
  const year = today.getFullYear();
  const dayOfMonth = today.getDate();
  const daysInMonth = new Date(year, today.getMonth() + 1, 0).getDate();
  const daysRemaining = daysInMonth - dayOfMonth + 1;

  const [categories, setCategories] = useState<Category[]>(cachedCats);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<Settings>({ monthlyIncome: 0, monthlySavings: 0 });
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Form state
  const [txType, setTxType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [amount, setAmount] = useState("");
  const [selectedParent, setSelectedParent] = useState<Category | null>(null);
  const [selectedChild, setSelectedChild] = useState<Category | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");

  // Inline new category
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatParentId, setNewCatParentId] = useState<string | null>(null);
  const [creatingCat, setCreatingCat] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
      const needCats = !categoriesLoaded;
      const [cats, txns, stngs, fixed, dts] = await Promise.all([
        needCats ? apiFetch<Category[]>("/categories") : Promise.resolve(null),
        apiFetch<Transaction[]>(`/transactions?month=${currentMonth}&limit=200`),
        apiFetch<Settings>("/settings"),
        apiFetch<FixedExpense[]>("/fixed-expenses"),
        apiFetch<Debt[]>("/debts").catch(() => [] as Debt[]),
      ]);
      if (cats) {
        setCategories(cats);
        setCachedCats(cats);
      }
      setTransactions(txns);
      setSettings(stngs);
      setFixedExpenses(fixed);
      setDebts(dts);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [categoriesLoaded, setCachedCats]);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

  const filteredCategories = categories.filter((c) => c.type === txType);

  const selectedCategory = selectedChild || selectedParent;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || !selectedCategory) return;

    setSubmitting(true);
    try {
      const newTx = await apiFetch<Transaction>("/transactions", {
        method: "POST",
        body: {
          amount: Number(amount),
          type: txType,
          categoryId: selectedCategory.id,
          categoryName: selectedCategory.name,
          note,
        },
      });
      setTransactions((prev) => [newTx, ...prev]);
      setAmount("");
      setSelectedParent(null);
      setSelectedChild(null);
      setNote("");
      setSuccess(txType === "EXPENSE" ? "Gasto registrado" : "Ingreso registrado");
      setTimeout(() => setSuccess(""), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setCreatingCat(true);
    try {
      const parentCat = newCatParentId
        ? filteredCategories.find((c) => c.id === newCatParentId)
        : null;

      const created = await apiFetch<Category>("/categories", {
        method: "POST",
        body: {
          name: newCatName.trim(),
          type: txType,
          color: parentCat?.color || "#94a3b8",
          parentId: newCatParentId || undefined,
        },
      });
      const cats = await apiFetch<Category[]>("/categories");
      setCategories(cats);
      setCachedCats(cats);

      if (newCatParentId) {
        const parent = cats.find((c) => c.id === newCatParentId);
        if (parent) {
          setSelectedParent(parent);
          const child = parent.children?.find((ch) => ch.id === created.id);
          setSelectedChild(child || null);
        }
      } else {
        const newParent = cats.find((c) => c.id === created.id);
        if (newParent) {
          setSelectedParent(newParent);
          setSelectedChild(null);
        }
      }
      setNewCatName("");
      setNewCatParentId(null);
      setShowNewCat(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear categoría");
    } finally {
      setCreatingCat(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiFetch(`/transactions/${id}`, { method: "DELETE" });
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setDeleteId(null);
    }
  }

  function handleParentClick(cat: Category) {
    if (selectedParent?.id === cat.id) {
      setSelectedParent(null);
      setSelectedChild(null);
    } else {
      setSelectedParent(cat);
      setSelectedChild(null);
    }
  }

  // Totals from loaded transactions (current month)
  const totalExpenses = transactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((s, t) => s + t.amount, 0);
  const totalIncome = transactions
    .filter((t) => t.type === "INCOME")
    .reduce((s, t) => s + t.amount, 0);

  // Disponible por día = (Ingresos - gastos fijos - cuotas activas - gastos variables - ahorro) / días restantes
  const totalFixed = fixedExpenses.reduce((s, f) => s + f.amount, 0);
  const totalDebtInstallments = debts
    .filter((d) => d.status === "active")
    .reduce((s, d) => s + d.installmentAmount, 0);
  const { monthlyIncome, monthlySavings } = settings;
  const ingresoReal = monthlyIncome + totalIncome;
  const disponibleTotal = ingresoReal - totalFixed - totalDebtInstallments - totalExpenses - monthlySavings;
  const disponiblePorDia = daysRemaining > 0 ? Math.round(disponibleTotal / daysRemaining) : 0;
  const baseDisponible = ingresoReal - totalFixed - totalDebtInstallments - monthlySavings;
  const budgetUsedPercent = baseDisponible > 0
    ? Math.max(0, Math.min(100, (disponibleTotal / baseDisponible) * 100))
    : 100;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 md:max-w-none md:mx-0 md:px-8 lg:px-12 md:pt-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
            {month} {year}
          </h1>
          <p className="text-sm text-slate-500">
            Día {dayOfMonth} — {daysRemaining} días restantes
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-expense text-sm p-3 rounded-xl border-l-4 border-expense mb-4">
          {error}
        </div>
      )}

      {/* Desktop: two columns / Mobile: stacked */}
      <div className="md:grid md:grid-cols-2 md:gap-8">
        {/* Left column: Budget overview */}
        <div className="space-y-4">
          {/* Disponible por día */}
          <div id="tour-disponible" className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <p className="text-sm font-semibold text-slate-500 mb-1">
              Disponible por día
            </p>
            <p className={`text-4xl font-bold ${disponiblePorDia >= 0 ? "text-income" : "text-expense"}`}>
              {disponiblePorDia < 0 ? "-" : ""}{fmt(Math.abs(disponiblePorDia))}
            </p>
            {ingresoReal > 0 ? (
              <>
                <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      budgetUsedPercent > 30 ? "bg-income" : budgetUsedPercent > 10 ? "bg-warning" : "bg-expense"
                    }`}
                    style={{ width: `${Math.max(0, budgetUsedPercent)}%` }}
                  />
                </div>
                <p className="text-sm text-slate-500 mt-3">
                  Libre del mes:{" "}
                  <span className={`font-bold ${disponibleTotal >= 0 ? "text-income" : "text-expense"}`}>
                    {fmt(Math.max(0, disponibleTotal))}
                  </span>
                  {" "}de{" "}
                  <span className="font-semibold text-slate-700">
                    {fmt(baseDisponible)}
                  </span>
                </p>
              </>
            ) : (
              <p className="text-xs text-slate-400 mt-2">
                Configurá tu ingreso en Ajustes para activar este cálculo
              </p>
            )}
          </div>

          {/* Ingresos / Gastos */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
              <p className="text-xs font-semibold text-slate-500 mb-1">
                Ingresos
              </p>
              <p className="text-xl font-bold text-income">{fmt(totalIncome)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
              <p className="text-xs font-semibold text-slate-500 mb-1">
                Gastos
              </p>
              <p className="text-xl font-bold text-expense">{fmt(totalExpenses)}</p>
            </div>
          </div>
        </div>

        {/* Right column: Quick expense form */}
        <div className="mt-4 md:mt-0">
          <form
            id="tour-formulario"
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6"
          >
            {/* Type toggle */}
            <div className="flex rounded-xl bg-slate-100 p-1 mb-5">
              <button
                type="button"
                onClick={() => { setTxType("EXPENSE"); setSelectedParent(null); setSelectedChild(null); }}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                  txType === "EXPENSE"
                    ? "bg-white text-expense shadow-sm"
                    : "text-slate-500"
                }`}
              >
                Gasto
              </button>
              <button
                type="button"
                onClick={() => { setTxType("INCOME"); setSelectedParent(null); setSelectedChild(null); }}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                  txType === "INCOME"
                    ? "bg-white text-income shadow-sm"
                    : "text-slate-500"
                }`}
              >
                Ingreso
              </button>
            </div>

            {/* Amount */}
            <div className="flex items-baseline gap-2 mb-5">
              <span className={`text-3xl font-bold ${txType === "EXPENSE" ? "text-expense/40" : "text-income/40"}`}>$</span>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="text-3xl font-bold text-slate-900 w-full outline-none bg-transparent placeholder:text-slate-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            {/* Category grid */}
            <div id="tour-categorias" className="mb-3">
              <p className="text-xs font-semibold text-slate-500 mb-2">
                Categoría
              </p>
              <div className="grid grid-cols-3 gap-2">
                {filteredCategories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => { handleParentClick(cat); setShowNewCat(false); }}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all border-2 ${
                      selectedParent?.id === cat.id
                        ? "border-brand bg-brand-light text-brand"
                        : "border-slate-100 text-slate-700 hover:border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-1.5"
                      style={{ backgroundColor: cat.color }}
                    />
                    {cat.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => { setShowNewCat(!showNewCat); setNewCatParentId(null); setSelectedParent(null); setSelectedChild(null); }}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all border-2 border-dashed ${
                    showNewCat
                      ? "border-brand bg-brand-light text-brand"
                      : "border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-500"
                  }`}
                >
                  + Nueva
                </button>
              </div>

              {/* Inline new category form */}
              {showNewCat && (
                <div className="mt-2 space-y-2">
                  <select
                    value={newCatParentId || ""}
                    onChange={(e) => setNewCatParentId(e.target.value || null)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-brand focus:outline-none bg-white text-slate-700"
                  >
                    <option value="">Categoría principal (nueva)</option>
                    {filteredCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        Subcategoría de {cat.name}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      placeholder={newCatParentId ? "Nombre de subcategoría" : (txType === "EXPENSE" ? "Ej: Transporte" : "Ej: Freelance")}
                      autoFocus
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-brand focus:outline-none"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreateCategory(e); } }}
                    />
                    <button
                      type="button"
                      onClick={handleCreateCategory}
                      disabled={creatingCat || !newCatName.trim()}
                      className="px-3 py-2 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand-hover transition-all disabled:opacity-40"
                    >
                      {creatingCat ? "..." : "Crear"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Subcategories */}
            {selectedParent?.children && selectedParent.children.length > 0 && (
              <div className="mb-4 pl-2 border-l-2 border-brand/20">
                <p className="text-xs text-slate-400 mb-1.5">Subcategoría</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedParent.children.map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() =>
                        setSelectedChild(
                          selectedChild?.id === sub.id ? null : sub
                        )
                      }
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                        selectedChild?.id === sub.id
                          ? "bg-brand text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {sub.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Note */}
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nota (opcional)"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm mb-4 focus:border-brand focus:outline-none"
            />

            {/* Submit */}
            <button
              type="submit"
              disabled={!amount || !selectedCategory || submitting}
              className={`w-full py-3 text-white font-semibold rounded-xl active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                txType === "EXPENSE"
                  ? "bg-brand hover:bg-brand-hover"
                  : "bg-income hover:bg-emerald-700"
              }`}
            >
              {submitting
                ? "Registrando..."
                : txType === "EXPENSE"
                  ? "Registrar Gasto"
                  : "Registrar Ingreso"}
            </button>

            {/* Success toast */}
            {success && (
              <div className="mt-3 bg-green-50 text-income text-sm font-semibold p-3 rounded-xl text-center border border-income/20">
                ✓ {success}
              </div>
            )}
          </form>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Eliminar transacción"
        message="¿Estás seguro? Esta acción no se puede deshacer."
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />

      {/* Recent transactions */}
      <div id="tour-transacciones" className="mt-6 mb-8">
        <h2 className="text-lg font-bold text-slate-900 mb-3">
          Últimas transacciones
        </h2>
        {transactions.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
            <p className="text-slate-400 text-sm">
              Registrá tu primera transacción arriba para verla acá
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {transactions.slice(0, 10).map((tx, i) => (
              <div
                key={tx.id}
                className={`flex items-center gap-3 px-4 py-3 ${
                  i < Math.min(transactions.length, 10) - 1
                    ? "border-b border-slate-50"
                    : ""
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
                <div className="text-right shrink-0 flex items-center gap-2">
                  <div>
                    <p
                      className={`text-sm font-bold ${
                        tx.type === "EXPENSE" ? "text-expense" : "text-income"
                      }`}
                    >
                      {tx.type === "EXPENSE" ? "-" : "+"}
                      {fmt(tx.amount)}
                    </p>
                    <p className="text-[10px] text-slate-400">{tx.date}</p>
                  </div>
                  <button
                    onClick={() => setDeleteId(tx.id)}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-expense hover:bg-red-50 transition-colors"
                    title="Eliminar"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <PageTour
        tourId="hoy"
        steps={[
          {
            target: "#tour-disponible",
            title: "Tu presupuesto diario",
            content: "Acá ves cuánto podés gastar hoy sin pasarte del presupuesto mensual.",
            placement: "bottom",
          },
          {
            target: "#tour-formulario",
            title: "Registro rápido",
            content: "Registrá un gasto o ingreso en segundos. Elegí el tipo, monto y categoría.",
            placement: "bottom",
          },
          {
            target: "#tour-categorias",
            title: "Categorías",
            content: "Elegí la categoría para clasificar tu movimiento. Podés crear nuevas con + Nueva.",
            placement: "bottom",
          },
          {
            target: "#tour-transacciones",
            title: "Últimas transacciones",
            content: "Tus movimientos más recientes del mes aparecen acá.",
            placement: "top",
          },
        ]}
      />
    </div>
  );
}
