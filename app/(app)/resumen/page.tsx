"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/store/auth";
import { apiFetch } from "@/lib/api";
import PageTour from "@/components/PageTour";

type PeriodType = "mensual" | "trimestral" | "semestral" | "anual";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const PERIOD_TABS: { key: PeriodType; label: string }[] = [
  { key: "mensual", label: "Mes" },
  { key: "trimestral", label: "Trimestre" },
  { key: "semestral", label: "Semestre" },
  { key: "anual", label: "Año" },
];

function fmt(n: number): string {
  return `$ ${Math.abs(n).toLocaleString("es-UY")}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// ---- Interfaces ----

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
  lastPaymentDate: string | null;
}

interface CatTotal {
  categoryId: string;
  categoryName: string;
  color: string;
  total: number;
  count: number;
}

interface MonthlySummary {
  month: string;
  totalIncome: number;
  totalExpenses: number;
  transactionCount: number;
  categoryBreakdown: CatTotal[];
}

interface AggregatedData {
  totalIncome: number;
  totalExpenses: number;
  transactionCount: number;
  categoryBreakdown: CatTotal[];
  monthCount: number;
}

// ---- Period helpers ----

function getMonthsInPeriod(type: PeriodType, year: number, index: number): string[] {
  switch (type) {
    case "mensual":
      return [`${year}-${pad(index + 1)}`];
    case "trimestral":
      return [1, 2, 3].map((i) => `${year}-${pad(index * 3 + i)}`);
    case "semestral":
      return [1, 2, 3, 4, 5, 6].map((i) => `${year}-${pad(index * 6 + i)}`);
    case "anual":
      return Array.from({ length: 12 }, (_, i) => `${year}-${pad(i + 1)}`);
  }
}

function getPrevPeriod(type: PeriodType, year: number, index: number) {
  if (index === 0) {
    const max = { mensual: 11, trimestral: 3, semestral: 1, anual: 0 }[type];
    return { year: year - 1, index: max };
  }
  return { year, index: index - 1 };
}

function periodIndexFromMonth(type: PeriodType, monthZero: number): number {
  switch (type) {
    case "mensual": return monthZero;
    case "trimestral": return Math.floor(monthZero / 3);
    case "semestral": return Math.floor(monthZero / 6);
    case "anual": return 0;
  }
}

function getPeriodLabel(type: PeriodType, year: number, index: number): string {
  switch (type) {
    case "mensual": return `${MONTH_NAMES[index]} ${year}`;
    case "trimestral": return `T${index + 1} ${year}`;
    case "semestral": return `S${index + 1} ${year}`;
    case "anual": return `${year}`;
  }
}

function aggregateSummaries(sums: MonthlySummary[]): AggregatedData {
  let totalIncome = 0;
  let totalExpenses = 0;
  let transactionCount = 0;
  const catMap = new Map<string, CatTotal>();

  for (const s of sums) {
    totalIncome += s.totalIncome;
    totalExpenses += s.totalExpenses;
    transactionCount += s.transactionCount;
    for (const cat of s.categoryBreakdown) {
      const key = cat.categoryId || cat.categoryName;
      const existing = catMap.get(key);
      if (existing) {
        existing.total += cat.total;
        existing.count += cat.count;
      } else {
        catMap.set(key, { ...cat });
      }
    }
  }

  return {
    totalIncome,
    totalExpenses,
    transactionCount,
    categoryBreakdown: Array.from(catMap.values()).sort((a, b) => b.total - a.total),
    monthCount: sums.length,
  };
}

// ---- Component ----

export default function ResumenPage() {
  const { user, categories: cachedCats, isCategoriesStale, setCategories: setCachedCats } = useAuth();

  const [dateInfo] = useState(() => {
    const t = new Date();
    return {
      year: t.getFullYear(),
      monthIndex: t.getMonth(),
      monthName: MONTH_NAMES[t.getMonth()],
      cmk: `${t.getFullYear()}-${pad(t.getMonth() + 1)}`,
    };
  });
  const cmk = dateInfo.cmk;

  const [periodType, setPeriodType] = useState<PeriodType>("mensual");
  const [selYear, setSelYear] = useState(dateInfo.year);
  const [selIndex, setSelIndex] = useState(dateInfo.monthIndex);

  const [summaries, setSummaries] = useState<MonthlySummary[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>(cachedCats);
  const [settings, setSettings] = useState<Settings>({ monthlyIncome: 0, monthlySavings: 0 });
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPartial, setShowPartial] = useState(false);

  // Derived period data
  const curMonths = useMemo(() => getMonthsInPeriod(periodType, selYear, selIndex), [periodType, selYear, selIndex]);
  const prev = useMemo(() => getPrevPeriod(periodType, selYear, selIndex), [periodType, selYear, selIndex]);
  const prevMonths = useMemo(() => getMonthsInPeriod(periodType, prev.year, prev.index), [periodType, prev.year, prev.index]);

  const closedCur = useMemo(() => curMonths.filter((m) => m < cmk), [curMonths, cmk]);
  const closedPrev = useMemo(() => prevMonths.filter((m) => m < cmk), [prevMonths, cmk]);

  const isMensualCurrent = periodType === "mensual" && curMonths[0] === cmk;
  const periodHasCurrent = curMonths.includes(cmk);
  const isMultiMonth = periodType !== "mensual";

  const label = useMemo(() => getPeriodLabel(periodType, selYear, selIndex), [periodType, selYear, selIndex]);
  const prevLabel = useMemo(() => getPeriodLabel(periodType, prev.year, prev.index), [periodType, prev.year, prev.index]);

  // Check if can navigate forward
  const canNext = useMemo(() => {
    const maxIdx = { mensual: 11, trimestral: 3, semestral: 1, anual: 0 }[periodType];
    const nextYear = selIndex === maxIdx ? selYear + 1 : selYear;
    const nextIndex = selIndex === maxIdx ? 0 : selIndex + 1;
    const nextMonths = getMonthsInPeriod(periodType, nextYear, nextIndex);
    return nextMonths[0] <= cmk;
  }, [periodType, selYear, selIndex, cmk]);

  // Fetch data
  const monthKeyForTx = periodType === "mensual" ? curMonths[0] : null;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const yearsNeeded = new Set<number>();
      [...curMonths, ...prevMonths].forEach((m) => yearsNeeded.add(Number(m.split("-")[0])));

      const needCats = isCategoriesStale();

      const summaryFetches = Array.from(yearsNeeded).map((y) =>
        apiFetch<MonthlySummary[]>(`/summaries?year=${y}&currentMonth=${cmk}`).catch(() => [] as MonthlySummary[])
      );

      const configFetches = [
        needCats ? apiFetch<Category[]>("/categories") : Promise.resolve(null),
        apiFetch<Settings>("/settings"),
        apiFetch<FixedExpense[]>("/fixed-expenses"),
        apiFetch<Debt[]>("/debts").catch(() => [] as Debt[]),
      ];

      const txFetch = monthKeyForTx
        ? [apiFetch<Transaction[]>(`/transactions?month=${monthKeyForTx}`)]
        : [];

      const [summaryResults, configResults, txResults] = await Promise.all([
        Promise.all(summaryFetches),
        Promise.all(configFetches),
        Promise.all(txFetch),
      ]);

      const allSums = summaryResults.flat() as MonthlySummary[];
      setSummaries(allSums);

      const cats = configResults[0] as Category[] | null;
      if (cats) { setCategories(cats); setCachedCats(cats); }
      setSettings(configResults[1] as Settings);
      setFixedExpenses(configResults[2] as FixedExpense[]);
      setDebts(configResults[3] as Debt[]);
      setTransactions(txResults[0] as Transaction[] ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, [curMonths, prevMonths, monthKeyForTx, isCategoriesStale, setCachedCats, cmk]);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible" && user) loadData();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [user, loadData]);

  // Navigation
  function navPrev() {
    const p = getPrevPeriod(periodType, selYear, selIndex);
    setSelYear(p.year);
    setSelIndex(p.index);
    setShowPartial(false);
  }

  function navNext() {
    if (!canNext) return;
    const max = { mensual: 11, trimestral: 3, semestral: 1, anual: 0 }[periodType];
    if (selIndex < max) {
      setSelIndex((i) => i + 1);
    } else {
      setSelYear((y) => y + 1);
      setSelIndex(0);
    }
    setShowPartial(false);
  }

  function handlePeriodChange(newType: PeriodType) {
    const firstMonth = curMonths[0];
    const mNum = Number(firstMonth.split("-")[1]) - 1;
    const yr = Number(firstMonth.split("-")[0]);
    setPeriodType(newType);
    setSelYear(yr);
    setSelIndex(periodIndexFromMonth(newType, mNum));
    setShowPartial(false);
  }

  // ---- Build category lookup from loaded categories ----
  const catLookup = useMemo(() => {
    const m = new Map<string, { name: string; color: string }>();
    for (const cat of categories) {
      m.set(cat.id, { name: cat.name, color: cat.color });
      if (cat.children) {
        for (const child of cat.children) {
          m.set(child.id, { name: cat.name, color: cat.color });
        }
      }
    }
    return m;
  }, [categories]);

  // ---- Compute current month data from transactions (for mensual view) ----
  const txAggregated = useMemo((): AggregatedData | null => {
    if (!monthKeyForTx || transactions.length === 0) return null;

    let totalIncome = 0;
    let totalExpenses = 0;
    const catMap = new Map<string, CatTotal>();

    for (const tx of transactions) {
      if (tx.type === "INCOME") {
        totalIncome += tx.amount;
      } else if (tx.type === "EXPENSE") {
        totalExpenses += tx.amount;
        const parent = catLookup.get(tx.categoryId);
        const key = parent?.name || tx.categoryName;
        const existing = catMap.get(key) || {
          categoryId: tx.categoryId,
          categoryName: key,
          color: parent?.color || "#94a3b8",
          total: 0,
          count: 0,
        };
        existing.total += tx.amount;
        existing.count += 1;
        catMap.set(key, existing);
      }
    }

    return {
      totalIncome,
      totalExpenses,
      transactionCount: transactions.length,
      categoryBreakdown: Array.from(catMap.values()).sort((a, b) => b.total - a.total),
      monthCount: 1,
    };
  }, [monthKeyForTx, transactions, catLookup]);

  // ---- Aggregate data for current and previous periods ----
  const getSumsForMonths = useCallback(
    (months: string[]) => months.map((m) => summaries.find((s) => s.month === m)).filter(Boolean) as MonthlySummary[],
    [summaries]
  );

  const curData = useMemo((): AggregatedData => {
    if (periodType === "mensual") {
      if (isMensualCurrent && txAggregated) return txAggregated;
      const found = getSumsForMonths(curMonths);
      if (found.length > 0) return aggregateSummaries(found);
      if (txAggregated) return txAggregated;
      return { totalIncome: 0, totalExpenses: 0, transactionCount: 0, categoryBreakdown: [], monthCount: 0 };
    }

    const closedSums = getSumsForMonths(closedCur);
    const agg = aggregateSummaries(closedSums);

    if (showPartial && periodHasCurrent && txAggregated) {
      agg.totalIncome += txAggregated.totalIncome;
      agg.totalExpenses += txAggregated.totalExpenses;
      agg.transactionCount += txAggregated.transactionCount;
      agg.monthCount += 1;
      for (const cat of txAggregated.categoryBreakdown) {
        const key = cat.categoryId || cat.categoryName;
        const existing = agg.categoryBreakdown.find((c) => (c.categoryId || c.categoryName) === key);
        if (existing) {
          existing.total += cat.total;
          existing.count += cat.count;
        } else {
          agg.categoryBreakdown.push({ ...cat });
        }
      }
      agg.categoryBreakdown.sort((a, b) => b.total - a.total);
    }

    return agg;
  }, [periodType, isMensualCurrent, txAggregated, getSumsForMonths, curMonths, closedCur, showPartial, periodHasCurrent]);

  const prevData = useMemo((): AggregatedData => {
    const sums = getSumsForMonths(closedPrev);
    return aggregateSummaries(sums);
  }, [getSumsForMonths, closedPrev]);

  // ---- Config totals ----
  const { monthlyIncome, monthlySavings } = settings;
  const totalFixed = fixedExpenses.reduce((s, f) => s + f.amount, 0);

  const configPerMonth = monthlyIncome - totalFixed - monthlySavings;

  const nCur = periodType === "mensual" ? 1 : (showPartial && periodHasCurrent ? closedCur.length + 1 : closedCur.length);
  const nPrev = closedPrev.length;

  const totIncome = monthlyIncome * nCur + curData.totalIncome;
  const totExpenses = totalFixed * nCur + curData.totalExpenses;
  const balance = totIncome - totExpenses - monthlySavings * nCur;

  const prevTotIncome = monthlyIncome * nPrev + prevData.totalIncome;
  const prevTotExpenses = totalFixed * nPrev + prevData.totalExpenses;
  const prevBalance = prevTotIncome - prevTotExpenses - monthlySavings * nPrev;

  const hasPrevData = prevData.monthCount > 0;
  const deltaIncome = hasPrevData ? totIncome - prevTotIncome : null;
  const deltaExpenses = hasPrevData ? totExpenses - prevTotExpenses : null;
  const deltaBalance = hasPrevData ? balance - prevBalance : null;

  // ---- Category breakdown for display ----
  const breakdown = useMemo(() => {
    const total = curData.totalExpenses;
    return curData.categoryBreakdown.map((cat) => ({
      ...cat,
      percent: total > 0 ? (cat.total / total) * 100 : 0,
    }));
  }, [curData]);

  // ---- Monthly trend for multi-month views ----
  const monthlyTrend = useMemo(() => {
    if (!isMultiMonth) return [];
    const months = showPartial && periodHasCurrent ? curMonths : closedCur;
    return months.map((m) => {
      const s = summaries.find((su) => su.month === m);
      const isCurrent = m === cmk;
      const tx = isCurrent && txAggregated ? txAggregated : null;
      return {
        month: m,
        label: MONTH_NAMES[Number(m.split("-")[1]) - 1].slice(0, 3),
        income: s?.totalIncome ?? tx?.totalIncome ?? 0,
        expenses: s?.totalExpenses ?? tx?.totalExpenses ?? 0,
        isPartial: isCurrent,
      };
    });
  }, [isMultiMonth, showPartial, periodHasCurrent, curMonths, closedCur, summaries, cmk, txAggregated]);

  // ---- Annual projection (median-based, resistant to outliers) ----
  const projection = useMemo(() => {
    const yearSums = getSumsForMonths(
      Array.from({ length: 12 }, (_, i) => `${selYear}-${pad(i + 1)}`).filter((m) => m < cmk)
    );
    if (yearSums.length < 2) return null;

    const median = (arr: number[]) => {
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 !== 0
        ? sorted[mid]
        : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    };

    const incomes = yearSums.map((s) => s.totalIncome);
    const expenses = yearSums.map((s) => s.totalExpenses);

    const medianIncome = median(incomes);
    const medianExpense = median(expenses);

    const mean = expenses.reduce((s, v) => s + v, 0) / expenses.length;
    const variance = expenses.reduce((s, v) => s + (v - mean) ** 2, 0) / expenses.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;

    const monthlyTotIncome = monthlyIncome + medianIncome;
    const monthlyTotExpense = totalFixed + medianExpense;
    const monthlyNet = monthlyTotIncome - monthlyTotExpense - monthlySavings;

    return {
      monthsUsed: yearSums.length,
      annualIncome: monthlyTotIncome * 12,
      annualExpenses: monthlyTotExpense * 12,
      annualSavings: monthlySavings * 12,
      annualNet: monthlyNet * 12,
      avgMonthlyExpense: medianExpense,
      avgMonthlyIncome: medianIncome,
      highVariance: cv > 0.5,
      cv: Math.round(cv * 100),
    };
  }, [getSumsForMonths, selYear, cmk, monthlyIncome, totalFixed, monthlySavings]);

  // ---- Top expenses for mensual view ----
  const topExpenses = useMemo(() => {
    if (periodType !== "mensual") return [];
    return [...transactions]
      .filter((t) => t.type === "EXPENSE")
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [periodType, transactions]);

  // ---- Delta indicator component ----
  function Delta({ value, invert = false }: { value: number | null; invert?: boolean }) {
    if (value === null) return null;
    const isGood = invert ? value < 0 : value > 0;
    const icon = value > 0 ? "↑" : value < 0 ? "↓" : "=";
    const color = value === 0 ? "text-slate-400" : isGood ? "text-income" : "text-expense";
    return (
      <span className={`text-xs font-semibold ${color}`}>
        {icon} {fmt(Math.abs(value))}
      </span>
    );
  }

  // ---- Render ----
  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-24 md:max-w-none md:mx-0 md:px-8 lg:px-12 md:pt-8">
      {/* Title */}
      <h1 className="text-2xl font-bold text-slate-900 mb-4 md:text-3xl">Resumen</h1>

      {/* Period tabs */}
      <div id="tour-periodos" className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-4">
        {PERIOD_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handlePeriodChange(tab.key)}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
              periodType === tab.key
                ? "bg-white text-brand shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Period navigator */}
      <div id="tour-mes-nav" className="flex items-center justify-center gap-4 mb-6">
        <button
          onClick={navPrev}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
        >
          ←
        </button>
        <span className="text-sm font-bold text-slate-800 min-w-[140px] text-center">{label}</span>
        <button
          onClick={navNext}
          disabled={!canNext}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          →
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-expense text-sm p-3 rounded-xl border-l-4 border-expense mb-4">{error}</div>
      )}

      {/* Partial month notice */}
      {!loading && isMultiMonth && periodHasCurrent && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-center justify-between">
          <p className="text-xs text-amber-700">
            {showPartial
              ? "Incluye datos parciales del mes en curso."
              : `${dateInfo.monthName} aún no cerró. Solo se muestran meses cerrados.`}
          </p>
          <button
            onClick={() => setShowPartial(!showPartial)}
            className="text-xs font-semibold text-amber-700 underline ml-2 shrink-0"
          >
            {showPartial ? "Excluir parcial" : "Incluir parcial"}
          </button>
        </div>
      )}

      {isMensualCurrent && !loading && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4">
          <p className="text-xs text-blue-700">Mes en curso — los datos se actualizan en tiempo real.</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-3 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : curData.monthCount === 0 && !isMensualCurrent ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
          <p className="text-slate-400 text-sm">No hay datos cerrados para {label}.</p>
          <p className="text-slate-300 text-xs mt-1">Los datos aparecen cuando se cierra el mes calendario.</p>
        </div>
      ) : (
        <>
          {/* Metric cards */}
          <div className="grid grid-cols-2 gap-3 mb-4 md:grid-cols-3">
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
              <p className="text-[11px] font-semibold text-slate-500 mb-1">Ingresos</p>
              <p className="text-xl font-bold text-income">{fmt(totIncome)}</p>
              {hasPrevData && (
                <div className="mt-1 flex items-center gap-1">
                  <Delta value={deltaIncome} />
                  <span className="text-[10px] text-slate-400">vs {prevLabel}</span>
                </div>
              )}
              {nCur > 1 && monthlyIncome > 0 && (
                <p className="text-[10px] text-slate-400 mt-1">Sueldo {fmt(monthlyIncome * nCur)} + otros {fmt(curData.totalIncome)}</p>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
              <p className="text-[11px] font-semibold text-slate-500 mb-1">Gastos</p>
              <p className="text-xl font-bold text-expense">{fmt(totExpenses)}</p>
              {hasPrevData && (
                <div className="mt-1 flex items-center gap-1">
                  <Delta value={deltaExpenses} invert />
                  <span className="text-[10px] text-slate-400">vs {prevLabel}</span>
                </div>
              )}
              {nCur > 1 && totalFixed > 0 && curData.totalExpenses > 0 && (
                <p className="text-[10px] text-slate-400 mt-1">
                  Fijos {fmt(totalFixed * nCur)} + var. {fmt(curData.totalExpenses)}
                </p>
              )}
            </div>

            <div className="col-span-2 md:col-span-1 bg-white rounded-xl shadow-sm border border-slate-100 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 mb-1">Balance</p>
                  <p className={`text-xl font-bold ${balance >= 0 ? "text-income" : "text-expense"}`}>
                    {balance < 0 ? "-" : "+"}{fmt(Math.abs(balance))}
                  </p>
                  {hasPrevData && (
                    <div className="mt-1 flex items-center gap-1">
                      <Delta value={deltaBalance} />
                      <span className="text-[10px] text-slate-400">vs {prevLabel}</span>
                    </div>
                  )}
                </div>
                {monthlySavings > 0 && (
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400">Ahorro reservado</p>
                    <p className="text-sm font-bold text-brand">{fmt(monthlySavings * nCur)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Monthly trend bars (multi-month only) */}
          {isMultiMonth && monthlyTrend.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-4">
              <p className="text-sm font-bold text-slate-900 mb-4">Tendencia mensual</p>
              <div className="flex items-end gap-2" style={{ height: 120 }}>
                {(() => {
                  const maxVal = Math.max(...monthlyTrend.map((m) => Math.max(m.income, m.expenses)), 1);
                  return monthlyTrend.map((m) => (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-0.5">
                      <div className="w-full flex gap-0.5" style={{ height: 100 }}>
                        <div className="flex-1 flex flex-col justify-end">
                          <div
                            className={`w-full rounded-t bg-income/70 transition-all ${m.isPartial ? "opacity-50" : ""}`}
                            style={{ height: `${(m.income / maxVal) * 100}%`, minHeight: m.income > 0 ? 4 : 0 }}
                            title={`Ingresos: ${fmt(m.income)}`}
                          />
                        </div>
                        <div className="flex-1 flex flex-col justify-end">
                          <div
                            className={`w-full rounded-t bg-expense/70 transition-all ${m.isPartial ? "opacity-50" : ""}`}
                            style={{ height: `${(m.expenses / maxVal) * 100}%`, minHeight: m.expenses > 0 ? 4 : 0 }}
                            title={`Gastos: ${fmt(m.expenses)}`}
                          />
                        </div>
                      </div>
                      <span className={`text-[10px] font-semibold ${m.isPartial ? "text-amber-500" : "text-slate-500"}`}>
                        {m.label}
                      </span>
                    </div>
                  ));
                })()}
              </div>
              <div className="flex items-center gap-4 mt-3 justify-center">
                <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <span className="w-2.5 h-2.5 rounded bg-income/70" /> Ingresos
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <span className="w-2.5 h-2.5 rounded bg-expense/70" /> Gastos
                </span>
              </div>
            </div>
          )}

          {/* Category breakdown */}
          <div id="tour-desglose" className="mb-4">
            {breakdown.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
                <p className="text-slate-400 text-sm">No hay gastos variables registrados en este período.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
                <p className="text-sm font-bold text-slate-900 mb-4">Distribución de gastos</p>
                <div className="h-6 rounded-full overflow-hidden flex mb-5">
                  {breakdown.map((cat) => (
                    <div
                      key={cat.categoryName}
                      title={`${cat.categoryName}: ${fmt(cat.total)} (${cat.percent.toFixed(0)}%)`}
                      className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                      style={{ width: `${cat.percent}%`, backgroundColor: cat.color, minWidth: cat.percent > 0 ? 4 : 0 }}
                    />
                  ))}
                </div>
                <div className="space-y-2">
                  {breakdown.map((cat) => (
                    <div key={cat.categoryName} className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="flex-1 text-sm text-slate-700 truncate">{cat.categoryName}</span>
                      <span className="text-xs text-slate-400 shrink-0">{cat.count} gasto{cat.count !== 1 ? "s" : ""}</span>
                      <span className="text-sm font-bold text-slate-900 shrink-0 min-w-[70px] text-right">{fmt(cat.total)}</span>
                      <span className="text-xs font-semibold text-slate-500 shrink-0 w-10 text-right">{cat.percent.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Annual projection */}
          {periodType !== "mensual" && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-4">
              <p className="text-sm font-bold text-slate-900 mb-3">Proyección anual {selYear}</p>
              {projection ? (
                <>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400">Ingresos proyectados</p>
                      <p className="text-lg font-bold text-income">{fmt(projection.annualIncome)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400">Gastos proyectados</p>
                      <p className="text-lg font-bold text-expense">{fmt(projection.annualExpenses)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400">Ahorro proyectado</p>
                      <p className="text-lg font-bold text-brand">{fmt(projection.annualSavings)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400">Balance neto anual</p>
                      <p className={`text-lg font-bold ${projection.annualNet >= 0 ? "text-income" : "text-expense"}`}>
                        {projection.annualNet < 0 ? "-" : "+"}{fmt(Math.abs(projection.annualNet))}
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Basado en la mediana de {projection.monthsUsed} mes{projection.monthsUsed !== 1 ? "es" : ""} cerrado{projection.monthsUsed !== 1 ? "s" : ""}.
                    Gasto variable típico {fmt(projection.avgMonthlyExpense)}/mes, ingreso variable típico {fmt(projection.avgMonthlyIncome)}/mes.
                  </p>
                  {projection.highVariance && (
                    <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2">
                      <p className="text-[11px] text-amber-700 font-semibold">
                        Tus gastos varían mucho entre meses (dispersión {projection.cv}%). La proyección podría ser menos precisa.
                      </p>
                    </div>
                  )}
                  {projection.annualNet < 0 && (
                    <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-2">
                      <p className="text-[11px] text-red-700 font-semibold">
                        Al ritmo actual, el año cerraría con un déficit de {fmt(Math.abs(projection.annualNet))}.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs text-amber-700">
                    Se necesitan al menos 2 meses cerrados en {selYear} para generar una proyección confiable.
                    {closedCur.length === 1 ? " Solo hay 1 mes cerrado hasta ahora." : closedCur.length === 0 ? " Aún no hay meses cerrados." : ""}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Active debts */}
          {debts.filter((d) => d.status === "active").length > 0 && (
            <div className="mb-4">
              <h2 className="text-sm font-bold text-slate-900 mb-3">Deudas activas</h2>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                {debts.filter((d) => d.status === "active").map((debt, i, arr) => {
                  const progress = Math.round((debt.paidInstallments / debt.totalInstallments) * 100);
                  const remaining = debt.totalInstallments - debt.paidInstallments;
                  return (
                    <div key={debt.id} className={`px-4 py-3 ${i < arr.length - 1 ? "border-b border-slate-50" : ""}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-sm font-semibold text-slate-900">{debt.name}</p>
                        <p className="text-sm font-bold text-expense">{fmt(debt.installmentAmount)}/mes</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-[10px] font-semibold text-slate-500">
                          {debt.paidInstallments}/{debt.totalInstallments} · {remaining} restante{remaining !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-slate-400 mt-2 text-right">
                Total cuotas mensuales: <span className="font-bold text-expense">{fmt(debts.filter((d) => d.status === "active").reduce((s, d) => s + d.installmentAmount, 0))}</span>
              </p>
            </div>
          )}

          {/* Top expenses (mensual only) */}
          {periodType === "mensual" && topExpenses.length > 0 && (
            <div id="tour-top-gastos" className="mb-8">
              <h2 className="text-sm font-bold text-slate-900 mb-3">Gastos más grandes</h2>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                {topExpenses.map((tx, i, arr) => (
                  <div
                    key={tx.id}
                    className={`flex items-center gap-3 px-4 py-3 ${i < arr.length - 1 ? "border-b border-slate-50" : ""}`}
                  >
                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{tx.categoryName}</p>
                      {tx.note && <p className="text-xs text-slate-400 truncate">{tx.note}</p>}
                    </div>
                    <p className="text-sm font-bold text-expense shrink-0">-{fmt(tx.amount)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Config reference for multi-month */}
          {isMultiMonth && (monthlyIncome > 0 || totalFixed > 0 || monthlySavings > 0) && (
            <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 mb-8">
              <p className="text-[11px] font-bold text-slate-500 mb-2">Referencia mensual configurada</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-600">
                {monthlyIncome > 0 && <p>Sueldo: <span className="font-semibold">{fmt(monthlyIncome)}</span></p>}
                {totalFixed > 0 && <p>Gastos fijos: <span className="font-semibold">{fmt(totalFixed)}</span></p>}
                {monthlySavings > 0 && <p>Ahorro: <span className="font-semibold">{fmt(monthlySavings)}</span></p>}
                <p className="col-span-2 mt-1 pt-1 border-t border-slate-200">
                  Disponible libre: <span className="font-bold text-brand">{fmt(configPerMonth)}</span>/mes
                </p>
              </div>
            </div>
          )}
        </>
      )}

      <PageTour
        tourId="resumen-v3"
        steps={[
          {
            target: "#tour-periodos",
            title: "Períodos de análisis",
            content: "Elegí si querés ver tus finanzas por mes, trimestre, semestre o año completo.",
            placement: "auto",
          },
          {
            target: "#tour-mes-nav",
            title: "Navegación",
            content: "Usá las flechas para moverte entre períodos. Cada tarjeta muestra la comparación con el período anterior.",
            placement: "auto",
          },
          {
            target: "#tour-desglose",
            title: "Distribución de gastos",
            content: "Acá ves en qué categorías se fue tu dinero, con porcentajes y montos. En vistas trimestrales o anuales, también aparece la proyección anual.",
            placement: "auto",
          },
        ]}
      />
    </div>
  );
}
