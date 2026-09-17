import type { Transaction } from './types';
import { fmt } from './parse';

export function mostRecentPastWeekday(now: Date, targetDay: number, hour: number): Date {
  // targetDay: 0=Sun, 5=Fri. Finds the most recent occurrence of that weekday at `hour`:00 local time that is <= now.
  const d = new Date(now);
  d.setHours(hour, 0, 0, 0);
  const currentDay = d.getDay();
  let daysBack = currentDay - targetDay;
  if (daysBack < 0) daysBack += 7;
  if (daysBack === 0 && d.getTime() > now.getTime()) daysBack = 7; // today, but that hour hasn't happened yet
  d.setDate(d.getDate() - daysBack);
  return d;
}

interface DigestContent {
  spent: number;
  indulgence_pct: number;
  top_categories: { category: string; amount: number }[];
  insight: string;
}

export function computeFridayDigest(transactions: Transaction[], periodEnd: Date): DigestContent {
  const weekStart = new Date(periodEnd);
  const day = weekStart.getDay();
  const backToMonday = day === 0 ? 6 : day - 1;
  weekStart.setDate(weekStart.getDate() - backToMonday);
  weekStart.setHours(0, 0, 0, 0);

  const inRange = transactions.filter((t) => {
    const d = new Date(t.date + 'T12:00:00');
    return d >= weekStart && d <= periodEnd && t.type === 'expense';
  });

  const spent = inRange.reduce((s, t) => s + t.amount, 0);
  const indulgent = inRange.filter((t) => t.indulgence).reduce((s, t) => s + t.amount, 0);
  const indulgence_pct = spent ? Math.round((indulgent / spent) * 100) : 0;

  const byCat = new Map<string, number>();
  inRange.forEach((t) => byCat.set(t.category, (byCat.get(t.category) || 0) + t.amount));
  const top_categories = Array.from(byCat.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, amount]) => ({ category, amount }));

  let insight: string;
  if (indulgence_pct < 25) {
    insight = `${fmt(spent)} spent this week, ${indulgence_pct}% indulgence — quieter than usual. There's room to enjoy the weekend without falling behind.`;
  } else if (indulgence_pct > 45) {
    insight = `${fmt(spent)} spent this week, ${indulgence_pct}% indulgence — a heavier week. Worth being mindful heading into the weekend.`;
  } else {
    insight = `${fmt(spent)} spent this week, ${indulgence_pct}% indulgence — right around your usual range.`;
  }

  return { spent, indulgence_pct, top_categories, insight };
}

export function computeSundayDigest(transactions: Transaction[], periodEnd: Date): DigestContent {
  const satStart = new Date(periodEnd);
  satStart.setDate(satStart.getDate() - 1);
  satStart.setHours(0, 0, 0, 0);

  const inRange = transactions.filter((t) => {
    const d = new Date(t.date + 'T12:00:00');
    return d >= satStart && d <= periodEnd && t.type === 'expense';
  });

  const spent = inRange.reduce((s, t) => s + t.amount, 0);
  const indulgent = inRange.filter((t) => t.indulgence).reduce((s, t) => s + t.amount, 0);
  const indulgence_pct = spent ? Math.round((indulgent / spent) * 100) : 0;

  const byCat = new Map<string, number>();
  inRange.forEach((t) => byCat.set(t.category, (byCat.get(t.category) || 0) + t.amount));
  const top_categories = Array.from(byCat.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, amount]) => ({ category, amount }));

  const insight = `${fmt(spent)} spent this weekend, ${fmt(indulgent)} of it indulgence.`;

  return { spent, indulgence_pct, top_categories, insight };
}
