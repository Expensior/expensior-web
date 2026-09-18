import type { Transaction } from './types';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function dayOfWeek(dateStr: string): number {
  return new Date(dateStr + 'T12:00:00').getDay();
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7); // YYYY-MM
}

export interface InsightsSummary {
  dayCategoryTotals: { day: string; category: string; total: number; count: number }[];
  dayRegretCounts: { day: string; count: number }[];
  categoryIndulgenceRate: { category: string; indulgentCount: number; totalCount: number }[];
  monthOverMonthDeltas: { category: string; thisMonth: number; lastMonth: number; deltaPct: number | null }[];
  frequentMerchants: { merchant: string; count: number; totalSpent: number }[];
}

// Pre-aggregates everything Claude needs so we never send raw transaction
// dumps -- keeps the prompt small, keeps cost predictable, and means Claude
// reasons over numbers we've already verified rather than re-deriving
// arithmetic itself.
export function buildInsightsSummary(allTransactions: Transaction[]): InsightsSummary {
  const expenses = allTransactions.filter((t) => t.type === 'expense');

  const dayCatMap = new Map<string, { total: number; count: number }>();
  expenses.forEach((t) => {
    const day = DAY_NAMES[dayOfWeek(t.date)];
    const key = `${day}|${t.category}`;
    const existing = dayCatMap.get(key) || { total: 0, count: 0 };
    dayCatMap.set(key, { total: existing.total + t.amount, count: existing.count + 1 });
  });
  const dayCategoryTotals = Array.from(dayCatMap.entries()).map(([key, v]) => {
    const [day, category] = key.split('|');
    return { day, category, total: v.total, count: v.count };
  });

  const regretMap = new Map<string, number>();
  expenses.filter((t) => t.regret).forEach((t) => {
    const day = DAY_NAMES[dayOfWeek(t.date)];
    regretMap.set(day, (regretMap.get(day) || 0) + 1);
  });
  const dayRegretCounts = DAY_NAMES.map((day) => ({ day, count: regretMap.get(day) || 0 }));

  const catTotalMap = new Map<string, { indulgentCount: number; totalCount: number }>();
  expenses.forEach((t) => {
    const existing = catTotalMap.get(t.category) || { indulgentCount: 0, totalCount: 0 };
    catTotalMap.set(t.category, {
      indulgentCount: existing.indulgentCount + (t.indulgence ? 1 : 0),
      totalCount: existing.totalCount + 1,
    });
  });
  const categoryIndulgenceRate = Array.from(catTotalMap.entries()).map(([category, v]) => ({ category, ...v }));

  const months = Array.from(new Set(expenses.map((t) => monthKey(t.date)))).sort();
  const thisMonthKey = months[months.length - 1];
  const lastMonthKey = months[months.length - 2];
  const monthOverMonthDeltas: InsightsSummary['monthOverMonthDeltas'] = [];
  if (thisMonthKey && lastMonthKey) {
    const catThisMonth = new Map<string, number>();
    const catLastMonth = new Map<string, number>();
    expenses.forEach((t) => {
      const mk = monthKey(t.date);
      if (mk === thisMonthKey) catThisMonth.set(t.category, (catThisMonth.get(t.category) || 0) + t.amount);
      if (mk === lastMonthKey) catLastMonth.set(t.category, (catLastMonth.get(t.category) || 0) + t.amount);
    });
    const allCats = new Set([...catThisMonth.keys(), ...catLastMonth.keys()]);
    allCats.forEach((category) => {
      const thisMonth = catThisMonth.get(category) || 0;
      const lastMonth = catLastMonth.get(category) || 0;
      const deltaPct = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : null;
      monthOverMonthDeltas.push({ category, thisMonth, lastMonth, deltaPct });
    });
  }

  const merchantMap = new Map<string, { count: number; totalSpent: number }>();
  expenses.forEach((t) => {
    const key = t.description.trim().toLowerCase();
    const existing = merchantMap.get(key) || { count: 0, totalSpent: 0 };
    merchantMap.set(key, { count: existing.count + 1, totalSpent: existing.totalSpent + t.amount });
  });
  const frequentMerchants = Array.from(merchantMap.entries())
    .map(([merchant, v]) => ({ merchant, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return { dayCategoryTotals, dayRegretCounts, categoryIndulgenceRate, monthOverMonthDeltas, frequentMerchants };
}
