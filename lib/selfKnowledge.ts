import type { Transaction } from './types';

export interface Intention {
  month_key: string; // "YYYY-M" e.g. "2026-9"
  amount: number;
}

export interface MonthScore {
  monthKey: string;
  label: string;
  predicted: number;
  actual: number;
  score: number;
  signedErrorPct: number; // positive = underestimated (actual > predicted)
}

function monthKeyToDate(monthKey: string): { year: number; month: number } {
  const [y, m] = monthKey.split('-').map(Number);
  return { year: y, month: m - 1 };
}

function actualSpendForMonth(transactions: Transaction[], year: number, month: number): number {
  return transactions
    .filter((t) => {
      const d = new Date(t.date + 'T12:00:00');
      return d.getFullYear() === year && d.getMonth() === month && t.type === 'expense';
    })
    .reduce((s, t) => s + t.amount, 0);
}

export function computeSelfKnowledgeHistory(intentions: Intention[], transactions: Transaction[], today = new Date()): MonthScore[] {
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  const results: MonthScore[] = [];

  for (const intention of intentions) {
    const { year, month } = monthKeyToDate(intention.month_key);
    // Only score months that have fully closed — the current month isn't over yet.
    const isClosed = year < currentYear || (year === currentYear && month < currentMonth);
    if (!isClosed) continue;

    const actual = actualSpendForMonth(transactions, year, month);
    if (intention.amount <= 0) continue;

    const signedErrorPct = (actual - intention.amount) / intention.amount;
    const score = Math.max(0, Math.round(100 - Math.abs(signedErrorPct) * 100));
    const label = new Date(year, month, 1).toLocaleDateString('en-IN', { month: 'short' });

    results.push({ monthKey: intention.month_key, label, predicted: intention.amount, actual, score, signedErrorPct });
  }

  results.sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  return results;
}

export function computeBias(history: MonthScore[]): { avgSignedErrorPct: number; direction: 'under' | 'over' | 'neutral' } | null {
  if (history.length === 0) return null;
  const avg = history.reduce((s, h) => s + h.signedErrorPct, 0) / history.length;
  const direction = avg > 0.03 ? 'under' : avg < -0.03 ? 'over' : 'neutral';
  return { avgSignedErrorPct: avg, direction };
}

export function scoreLabel(score: number): string {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Fair';
  return 'Way off';
}
