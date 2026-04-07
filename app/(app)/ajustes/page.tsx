"use client";

import { useState, useEffect, useCallback } from "react";
import { signOut } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { useAuth } from "@/store/auth";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import ConfirmDialog from "@/components/ConfirmDialog";

interface FixedExpense {
  id: string;
  name: string;
  amount: number;
}

interface Category {
  id: string;
  name: string;
  type: string;
  color: string;
  parentId: string | null;
  children?: Category[];
}

function fmt(n: number): string {
  return `$ ${n.toLocaleString("es-UY")}`;
}

const COLORS = [
  "#4F46E5", "#059669", "#E11D48", "#F59E0B", "#2fcdf4",
  "#74a7ff", "#667eea", "#76bb40", "#bc02d4", "#ffa200",
  "#6b6e7b", "#ff0000", "#e74c3c", "#ffeb14", "#66ead4",
];

export default function AjustesPage() {
  const { user, clearCategories } = useAuth();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [monthlySavings, setMonthlySavings] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [newFixedName, setNewFixedName] = useState("");
  const [newFixedAmount, setNewFixedAmount] = useState("");
  const [addingFixed, setAddingFixed] = useState(false);
  const [editingFixed, setEditingFixed] = useState<string | null>(null);
  const [editFixedName, setEditFixedName] = useState("");
  const [editFixedAmount, setEditFixedAmount] = useState("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [newCatName, setNewCatName] = useState("");
  const [newCatType, setNewCatType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [newCatColor, setNewCatColor] = useState(COLORS[0]);
  const [addingCat, setAddingCat] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [addingSubTo, setAddingSubTo] = useState<string | null>(null);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [editCatColor, setEditCatColor] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<{ type: "fixed" | "category"; id: string; name: string } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [settings, fixed, cats] = await Promise.all([
        apiFetch<{ monthlyIncome: number; monthlySavings: number }>("/settings"),
        apiFetch<FixedExpense[]>("/fixed-expenses"),
        apiFetch<Category[]>("/categories"),
      ]);
      setMonthlyIncome(settings.monthlyIncome ? String(settings.monthlyIncome) : "");
      setMonthlySavings(settings.monthlySavings ? String(settings.monthlySavings) : "");
      setFixedExpenses(fixed);
      setCategories(cats);
      setSettingsLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

  function showSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 2500);
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    setError("");
    try {
      await apiFetch("/settings", {
        method: "PUT",
        body: {
          monthlyIncome: Number(monthlyIncome) || 0,
          monthlySavings: Number(monthlySavings) || 0,
        },
      });
      showSuccess("Configuración guardada");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleAddFixed(e: React.FormEvent) {
    e.preventDefault();
    if (!newFixedName.trim() || !newFixedAmount) return;
    setAddingFixed(true);
    setError("");
    try {
      const item = await apiFetch<FixedExpense>("/fixed-expenses", {
        method: "POST",
        body: { name: newFixedName.trim(), amount: Number(newFixedAmount) },
      });
      setFixedExpenses((prev) => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)));
      setNewFixedName("");
      setNewFixedAmount("");
      showSuccess("Gasto fijo agregado");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al agregar");
    } finally {
      setAddingFixed(false);
    }
  }

  function startEditFixed(fe: FixedExpense) {
    setEditingFixed(fe.id);
    setEditFixedName(fe.name);
    setEditFixedAmount(String(fe.amount));
  }

  async function handleSaveFixed(id: string) {
    if (!editFixedName.trim() || !editFixedAmount) return;
    try {
      await apiFetch(`/fixed-expenses/${id}`, {
        method: "PUT",
        body: { name: editFixedName.trim(), amount: Number(editFixedAmount) },
      });
      setFixedExpenses((prev) =>
        prev.map((f) => f.id === id ? { ...f, name: editFixedName.trim(), amount: Math.round(Math.abs(Number(editFixedAmount))) } : f)
      );
      setEditingFixed(null);
      showSuccess("Gasto fijo actualizado");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar");
    }
  }

  async function handleDeleteFixed(id: string) {
    try {
      await apiFetch(`/fixed-expenses/${id}`, { method: "DELETE" });
      setFixedExpenses((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setConfirmDelete(null);
    }
  }

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setAddingCat(true);
    setError("");
    try {
      await apiFetch("/categories", {
        method: "POST",
        body: { name: newCatName.trim(), type: newCatType, color: newCatColor },
      });
      const cats = await apiFetch<Category[]>("/categories");
      setCategories(cats);
      clearCategories();
      setNewCatName("");
      showSuccess("Categoría creada");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear");
    } finally {
      setAddingCat(false);
    }
  }

  async function handleAddSubcategory(parentId: string) {
    if (!newSubName.trim()) return;
    setError("");
    try {
      const parent = categories.find((c) => c.id === parentId);
      await apiFetch("/categories", {
        method: "POST",
        body: {
          name: newSubName.trim(),
          type: parent?.type || "EXPENSE",
          color: parent?.color || "#94a3b8",
          parentId,
        },
      });
      const cats = await apiFetch<Category[]>("/categories");
      setCategories(cats);
      clearCategories();
      setNewSubName("");
      setAddingSubTo(null);
      showSuccess("Subcategoría creada");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear");
    }
  }

  function startEditCategory(cat: Category) {
    setEditingCat(cat.id);
    setEditCatName(cat.name);
    setEditCatColor(cat.color);
  }

  async function handleSaveCategory(id: string) {
    if (!editCatName.trim()) return;
    try {
      await apiFetch(`/categories/${id}`, {
        method: "PUT",
        body: { name: editCatName.trim(), color: editCatColor },
      });
      const cats = await apiFetch<Category[]>("/categories");
      setCategories(cats);
      clearCategories();
      setEditingCat(null);
      showSuccess("Categoría actualizada");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar");
    }
  }

  async function handleDeleteCategory(id: string) {
    try {
      await apiFetch(`/categories/${id}`, { method: "DELETE" });
      const cats = await apiFetch<Category[]>("/categories");
      setCategories(cats);
      clearCategories();
      showSuccess("Categoría eliminada");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setConfirmDelete(null);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await signOut(getFirebaseAuth());
      router.replace("/login");
    } catch {
      setLoggingOut(false);
    }
  }

  const totalFixed = fixedExpenses.reduce((s, f) => s + f.amount, 0);
  const income = Number(monthlyIncome) || 0;
  const savings = Number(monthlySavings) || 0;
  const expenseCats = categories.filter((c) => c.type === "EXPENSE");
  const incomeCats = categories.filter((c) => c.type === "INCOME");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 md:max-w-none md:mx-0 md:px-8 lg:px-12 md:pt-8 pb-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-6 md:text-3xl">Ajustes</h1>

      {error && (
        <div className="bg-red-50 text-expense text-sm p-3 rounded-xl border-l-4 border-expense mb-4">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 text-income text-sm font-semibold p-3 rounded-xl border-l-4 border-income mb-4">
          ✓ {success}
        </div>
      )}

      {/* User info */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center">
          <span className="text-brand font-bold text-lg">
            {user?.email?.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{user?.email}</p>
          <p className="text-xs text-slate-500">Moneda: UYU</p>
        </div>
      </div>

      <div className="md:grid md:grid-cols-2 md:gap-8">
        {/* Left column: Income/Savings + Summary */}
        <div className="space-y-6">
          <form onSubmit={handleSaveSettings} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">💰 Ingreso y Ahorro</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Ingreso mensual (sueldo)</label>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-slate-400">$</span>
                  <input type="number" inputMode="numeric" min="0" step="1" value={monthlyIncome}
                    onChange={(e) => setMonthlyIncome(e.target.value)} placeholder="0"
                    className="text-lg font-bold text-slate-900 w-full outline-none bg-transparent placeholder:text-slate-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">🏦 Ahorro mensual</label>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-slate-400">$</span>
                  <input type="number" inputMode="numeric" min="0" step="1" value={monthlySavings}
                    onChange={(e) => setMonthlySavings(e.target.value)} placeholder="0"
                    className="text-lg font-bold text-slate-900 w-full outline-none bg-transparent placeholder:text-slate-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                </div>
                <p className="text-xs text-slate-400 mt-1">Monto que reservás cada mes. Se resta del disponible.</p>
              </div>
            </div>
            <button type="submit" disabled={savingSettings}
              className="w-full mt-5 py-3 bg-brand text-white font-semibold rounded-xl hover:bg-brand-hover active:scale-[0.98] transition-all disabled:opacity-50">
              {savingSettings ? "Guardando..." : "Guardar"}
            </button>
          </form>

          {settingsLoaded && income > 0 && (
            <div className="bg-brand-light rounded-2xl p-5 border border-brand/20">
              <p className="text-sm font-semibold text-brand mb-2">📋 Resumen mensual</p>
              <div className="space-y-1 text-sm text-brand/80">
                <div className="flex justify-between"><span>Ingreso</span><span className="font-semibold">{fmt(income)}</span></div>
                <div className="flex justify-between"><span>Gastos fijos</span><span className="font-semibold">- {fmt(totalFixed)}</span></div>
                <div className="flex justify-between"><span>Ahorro</span><span className="font-semibold">- {fmt(savings)}</span></div>
                <div className="border-t border-brand/20 pt-1 flex justify-between font-bold">
                  <span>Libre para gastar</span><span>{fmt(Math.max(0, income - totalFixed - savings))}</span>
                </div>
              </div>
            </div>
          )}

          {/* Fixed expenses */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-1">🔄 Gastos fijos</h2>
            <p className="text-xs text-slate-500 mb-4">Pagos que se repiten cada mes</p>
            {fixedExpenses.length > 0 && (
              <div className="mb-4 space-y-1">
                {fixedExpenses.map((fe) => (
                  editingFixed === fe.id ? (
                    <div key={fe.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50">
                      <input type="text" value={editFixedName} onChange={(e) => setEditFixedName(e.target.value)} autoFocus
                        className="flex-1 min-w-0 px-2 py-1 rounded-md border border-slate-200 text-sm focus:border-brand focus:outline-none"
                        onKeyDown={(e) => { if (e.key === "Enter") handleSaveFixed(fe.id); if (e.key === "Escape") setEditingFixed(null); }} />
                      <div className="flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200">
                        <span className="text-xs text-slate-400">$</span>
                        <input type="number" inputMode="numeric" min="1" value={editFixedAmount}
                          onChange={(e) => setEditFixedAmount(e.target.value)}
                          className="w-16 text-sm font-bold outline-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                      </div>
                      <button onClick={() => handleSaveFixed(fe.id)} className="px-2 py-1 bg-brand text-white text-xs font-semibold rounded-md">✓</button>
                      <button onClick={() => setEditingFixed(null)} className="px-2 py-1 text-xs text-slate-400">✕</button>
                    </div>
                  ) : (
                  <div key={fe.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => startEditFixed(fe)}>
                    <span className="flex-1 text-sm font-medium text-slate-700 truncate">{fe.name}</span>
                    <span className="text-sm font-bold text-slate-900 shrink-0">{fmt(fe.amount)}</span>
                    <button onClick={(e) => { e.stopPropagation(); setConfirmDelete({ type: "fixed", id: fe.id, name: fe.name }); }}
                      className="p-1 rounded text-slate-300 hover:text-expense hover:bg-red-50 transition-colors" title="Eliminar">✕</button>
                  </div>
                  )
                ))}
                <div className="flex justify-between px-3 pt-2 border-t border-slate-200 text-sm font-bold text-slate-900">
                  <span>Total</span><span>{fmt(totalFixed)}</span>
                </div>
              </div>
            )}
            <form onSubmit={handleAddFixed} className="flex gap-2">
              <input type="text" value={newFixedName} onChange={(e) => setNewFixedName(e.target.value)}
                placeholder="Nombre (ej. Alquiler)"
                className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-brand focus:outline-none" />
              <div className="flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200">
                <span className="text-sm text-slate-400">$</span>
                <input type="number" inputMode="numeric" min="1" step="1" value={newFixedAmount}
                  onChange={(e) => setNewFixedAmount(e.target.value)} placeholder="0"
                  className="w-20 text-sm font-bold outline-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
              </div>
              <button type="submit" disabled={addingFixed || !newFixedName.trim() || !newFixedAmount}
                className="px-4 py-2 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand-hover active:scale-[0.98] transition-all disabled:opacity-40">+</button>
            </form>
          </div>
        </div>

        {/* Right column: Categories */}
        <div className="mt-6 md:mt-0 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">📁 Categorías</h2>

            {/* Expense categories */}
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Gastos</p>
            <div className="space-y-1 mb-4">
              {expenseCats.map((cat) => (
                <div key={cat.id}>
                  {editingCat === cat.id ? (
                    <div className="px-3 py-2 rounded-lg bg-slate-50 space-y-2">
                      <div className="flex items-center gap-2">
                        <input type="text" value={editCatName} onChange={(e) => setEditCatName(e.target.value)} autoFocus
                          className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 text-sm focus:border-brand focus:outline-none"
                          onKeyDown={(e) => { if (e.key === "Enter") handleSaveCategory(cat.id); if (e.key === "Escape") setEditingCat(null); }} />
                        <button onClick={() => handleSaveCategory(cat.id)} className="px-2 py-1.5 bg-brand text-white text-xs font-semibold rounded-lg">✓</button>
                        <button onClick={() => setEditingCat(null)} className="px-2 py-1.5 text-xs text-slate-400">✕</button>
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        {COLORS.map((c) => (
                          <button key={c} type="button" onClick={() => setEditCatColor(c)}
                            className={`w-5 h-5 rounded-full transition-all ${editCatColor === c ? "ring-2 ring-offset-1 ring-brand scale-110" : "hover:scale-110"}`}
                            style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    </div>
                  ) : (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors">
                    <span className="w-3 h-3 rounded-full shrink-0 cursor-pointer" style={{ backgroundColor: cat.color }}
                      onClick={() => startEditCategory(cat)} title="Editar" />
                    <button
                      onClick={() => setExpandedCat(expandedCat === cat.id ? null : cat.id)}
                      className="flex-1 text-sm font-medium text-slate-700 text-left truncate"
                    >
                      {cat.name}
                      {cat.children && cat.children.length > 0 && (
                        <span className="text-slate-400 ml-1">({cat.children.length})</span>
                      )}
                    </button>
                    <button onClick={() => startEditCategory(cat)}
                      className="p-1 rounded text-slate-300 hover:text-brand transition-colors" title="Editar">✎</button>
                    <button onClick={() => setConfirmDelete({ type: "category", id: cat.id, name: cat.name })}
                      className="p-1 rounded text-slate-300 hover:text-expense hover:bg-red-50 transition-colors" title="Eliminar">✕</button>
                  </div>
                  )}

                  {expandedCat === cat.id && (
                    <div className="ml-6 pl-3 border-l-2 border-slate-100 space-y-1 py-1">
                      {cat.children?.map((sub) => (
                        <div key={sub.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md">
                          <span className="flex-1 text-xs text-slate-600">{sub.name}</span>
                          <button onClick={() => setConfirmDelete({ type: "category", id: sub.id, name: sub.name })}
                            className="p-0.5 rounded text-slate-300 hover:text-expense text-xs transition-colors">✕</button>
                        </div>
                      ))}
                      {addingSubTo === cat.id ? (
                        <div className="flex gap-1.5 mt-1">
                          <input type="text" value={newSubName} onChange={(e) => setNewSubName(e.target.value)}
                            placeholder="Nombre" autoFocus
                            className="flex-1 px-2 py-1 rounded-md border border-slate-200 text-xs focus:border-brand focus:outline-none"
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddSubcategory(cat.id); } }} />
                          <button onClick={() => handleAddSubcategory(cat.id)}
                            className="px-2 py-1 bg-brand text-white text-xs font-semibold rounded-md">+</button>
                          <button onClick={() => { setAddingSubTo(null); setNewSubName(""); }}
                            className="px-2 py-1 text-xs text-slate-400">✕</button>
                        </div>
                      ) : (
                        <button onClick={() => { setAddingSubTo(cat.id); setNewSubName(""); }}
                          className="text-xs text-brand font-medium hover:underline px-2 py-1">
                          + Agregar subcategoría
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Income categories */}
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 mt-5">Ingresos</p>
            <div className="space-y-1 mb-5">
              {incomeCats.length === 0 ? (
                <p className="text-xs text-slate-400 px-3 py-2">No hay categorías de ingreso</p>
              ) : (
                incomeCats.map((cat) => (
                  <div key={cat.id}>
                    {editingCat === cat.id ? (
                      <div className="px-3 py-2 rounded-lg bg-slate-50 space-y-2">
                        <div className="flex items-center gap-2">
                          <input type="text" value={editCatName} onChange={(e) => setEditCatName(e.target.value)} autoFocus
                            className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 text-sm focus:border-brand focus:outline-none"
                            onKeyDown={(e) => { if (e.key === "Enter") handleSaveCategory(cat.id); if (e.key === "Escape") setEditingCat(null); }} />
                          <button onClick={() => handleSaveCategory(cat.id)} className="px-2 py-1.5 bg-brand text-white text-xs font-semibold rounded-lg">✓</button>
                          <button onClick={() => setEditingCat(null)} className="px-2 py-1.5 text-xs text-slate-400">✕</button>
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                          {COLORS.map((c) => (
                            <button key={c} type="button" onClick={() => setEditCatColor(c)}
                              className={`w-5 h-5 rounded-full transition-all ${editCatColor === c ? "ring-2 ring-offset-1 ring-brand scale-110" : "hover:scale-110"}`}
                              style={{ backgroundColor: c }} />
                          ))}
                        </div>
                      </div>
                    ) : (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors">
                      <span className="w-3 h-3 rounded-full shrink-0 cursor-pointer" style={{ backgroundColor: cat.color }}
                        onClick={() => startEditCategory(cat)} title="Editar" />
                      <button
                        onClick={() => setExpandedCat(expandedCat === cat.id ? null : cat.id)}
                        className="flex-1 text-sm font-medium text-slate-700 text-left truncate"
                      >
                        {cat.name}
                        {cat.children && cat.children.length > 0 && (
                          <span className="text-slate-400 ml-1">({cat.children.length})</span>
                        )}
                      </button>
                      <button onClick={() => startEditCategory(cat)}
                        className="p-1 rounded text-slate-300 hover:text-brand transition-colors" title="Editar">✎</button>
                      <button onClick={() => setConfirmDelete({ type: "category", id: cat.id, name: cat.name })}
                        className="p-1 rounded text-slate-300 hover:text-expense hover:bg-red-50 transition-colors" title="Eliminar">✕</button>
                    </div>
                    )}

                    {expandedCat === cat.id && (
                      <div className="ml-6 pl-3 border-l-2 border-slate-100 space-y-1 py-1">
                        {cat.children?.map((sub) => (
                          <div key={sub.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md">
                            <span className="flex-1 text-xs text-slate-600">{sub.name}</span>
                            <button onClick={() => setConfirmDelete({ type: "category", id: sub.id, name: sub.name })}
                              className="p-0.5 rounded text-slate-300 hover:text-expense text-xs transition-colors">✕</button>
                          </div>
                        ))}
                        {addingSubTo === cat.id ? (
                          <div className="flex gap-1.5 mt-1">
                            <input type="text" value={newSubName} onChange={(e) => setNewSubName(e.target.value)}
                              placeholder="Nombre" autoFocus
                              className="flex-1 px-2 py-1 rounded-md border border-slate-200 text-xs focus:border-brand focus:outline-none"
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddSubcategory(cat.id); } }} />
                            <button onClick={() => handleAddSubcategory(cat.id)}
                              className="px-2 py-1 bg-brand text-white text-xs font-semibold rounded-md">+</button>
                            <button onClick={() => { setAddingSubTo(null); setNewSubName(""); }}
                              className="px-2 py-1 text-xs text-slate-400">✕</button>
                          </div>
                        ) : (
                          <button onClick={() => { setAddingSubTo(cat.id); setNewSubName(""); }}
                            className="text-xs text-brand font-medium hover:underline px-2 py-1">
                            + Agregar subcategoría
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Add category form */}
            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold text-slate-500 mb-2">Nueva categoría</p>
              <form onSubmit={handleAddCategory} className="space-y-3">
                <div className="flex gap-2">
                  <input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="Nombre"
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-brand focus:outline-none" />
                  <select value={newCatType} onChange={(e) => setNewCatType(e.target.value as "EXPENSE" | "INCOME")}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-brand focus:outline-none bg-white">
                    <option value="EXPENSE">Gasto</option>
                    <option value="INCOME">Ingreso</option>
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">Color:</span>
                  <div className="flex gap-1.5 flex-wrap">
                    {COLORS.map((c) => (
                      <button key={c} type="button" onClick={() => setNewCatColor(c)}
                        className={`w-6 h-6 rounded-full transition-all ${newCatColor === c ? "ring-2 ring-offset-1 ring-brand scale-110" : "hover:scale-110"}`}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
                <button type="submit" disabled={addingCat || !newCatName.trim()}
                  className="w-full py-2.5 bg-brand text-white text-sm font-semibold rounded-xl hover:bg-brand-hover active:scale-[0.98] transition-all disabled:opacity-40">
                  {addingCat ? "Creando..." : "Crear Categoría"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        title={confirmDelete?.type === "fixed" ? "Eliminar gasto fijo" : "Eliminar categoría"}
        message={`¿Eliminar "${confirmDelete?.name}"? Esta acción no se puede deshacer.`}
        onConfirm={() => {
          if (!confirmDelete) return;
          if (confirmDelete.type === "fixed") handleDeleteFixed(confirmDelete.id);
          else handleDeleteCategory(confirmDelete.id);
        }}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* Logout */}
      <div className="mt-8">
        <button onClick={handleLogout} disabled={loggingOut}
          className="w-full py-3.5 bg-white text-expense font-semibold rounded-2xl border-2 border-expense/30 hover:bg-red-50 active:scale-[0.98] transition-all disabled:opacity-50 md:max-w-xs">
          {loggingOut ? "Cerrando sesión..." : "Cerrar Sesión"}
        </button>
      </div>
    </div>
  );
}
