'use client';

import { useMemo, useState } from 'react';
import { IconChevronDown, IconReceipt2, IconCategory, IconFlame } from '@tabler/icons-react';
import { fmt } from '@/lib/parse';
import { CAT_COLORS } from '@/lib/categories';
import type { Transaction } from '@/lib/types';

export interface LedgerFilter {
  categories: Set<string>;
  indulgence: boolean;
  essential: boolean;
  regret: boolean;
}

export function emptyFilter(): LedgerFilter {
  return { categories: new Set(), indulgence: false, essential: false, regret: false };
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayStr(): string {
  return ymd(new Date());
}

function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return ymd(d);
}

// Two-tone gradient whose color pair shifts as pct climbs through zones —
// light/accent while healthy, sliding toward amber and finally red as the
// pot fills up. The arc only shows colors up to the current pct; the rest
// of the ring stays a flat track color.
function donutGradient(pct: number): string {
  const clamped = Math.min(100, Math.max(0, pct));
  const deg = clamped * 3.6;
  let start: string;
  let end: string;
  if (clamped < 50) {
    start = 'var(--positive)';
    end = 'var(--accent)';
  } else if (clamped < 80) {
    start = 'var(--accent)';
    end = 'color-mix(in srgb, var(--accent), var(--danger) 50%)';
  } else {
    start = 'color-mix(in srgb, var(--accent), var(--danger) 50%)';
    end = 'var(--danger)';
  }
  return `conic-gradient(from -90deg, ${start} 0deg, ${end} ${deg}deg, color-mix(in srgb, var(--surface), transparent 30%) ${deg}deg 360deg)`;
}

export default function Ledger({
  month,
  monthLabel,
  onPrevMonth,
  onNextMonth,
  onJumpMonths,
  onToday,
  transactions,
  allTransactions,
  monthlyPot,
  categories,
  filter,
  setFilter,
  search,
  setSearch,
  selectedId,
  onSelect,
  onDelete,
}: {
  month: Date;
  monthLabel: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onJumpMonths: (delta: number) => void;
  onToday: () => void;
  transactions: Transaction[];
  allTransactions: Transaction[];
  monthlyPot: number | null;
  categories: string[];
  filter: LedgerFilter;
  setFilter: (f: LedgerFilter) => void;
  search: string;
  setSearch: (s: string) => void;
  selectedId: string | null;
  onSelect: (t: Transaction) => void;
  onDelete: (id: string) => void;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const monthTotal = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const activeFilterCount = filter.categories.size + (filter.indulgence ? 1 : 0) + (filter.essential ? 1 : 0) + (filter.regret ? 1 : 0);
  const anyChipActive = activeFilterCount > 0;

  const filtered = useMemo(() => {
    let list = transactions;
    if (anyChipActive) {
      list = list.filter((t) =>
        filter.categories.has(t.category) ||
        (filter.indulgence && t.indulgence) ||
        (filter.essential && t.essential) ||
        (filter.regret && t.regret)
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((t) => t.description.toLowerCase().includes(q) || (t.notes || '').toLowerCase().includes(q));
    }
    return list;
  }, [transactions, filter, anyChipActive, search]);

  const grouped = useMemo(() => {
    const byDay = new Map<string, Transaction[]>();
    [...filtered].sort((a, b) => (a.date < b.date ? 1 : -1)).forEach((t) => {
      if (!byDay.has(t.date)) byDay.set(t.date, []);
      byDay.get(t.date)!.push(t);
    });
    return Array.from(byDay.entries());
  }, [filtered]);

  const weekTotals = useMemo(() => {
    const totals = new Map<string, number>();
    filtered.filter((t) => t.type === 'expense').forEach((t) => {
      const wk = mondayOf(t.date);
      totals.set(wk, (totals.get(wk) || 0) + t.amount);
    });
    return totals;
  }, [filtered]);

  // Highlights — all computed from the unfiltered month, not the filtered view,
  // since these describe the month itself, not whatever subset is on screen.
  const highlights = useMemo(() => {
    const expenses = transactions.filter((t) => t.type === 'expense');
    if (expenses.length === 0) return null;

    const biggest = [...expenses].sort((a, b) => b.amount - a.amount)[0];

    const catCounts = new Map<string, number>();
    expenses.forEach((t) => catCounts.set(t.category, (catCounts.get(t.category) || 0) + 1));
    const topCat = [...catCounts.entries()].sort((a, b) => b[1] - a[1])[0];

    const dayCounts = new Map<string, number>();
    expenses.forEach((t) => dayCounts.set(t.date, (dayCounts.get(t.date) || 0) + 1));
    const topDay = [...dayCounts.entries()].sort((a, b) => b[1] - a[1])[0];

    return {
      biggest: { amount: biggest.amount, description: biggest.description, date: biggest.date },
      topCategory: { name: topCat[0], count: topCat[1] },
      busiestDay: { date: topDay[0], count: topDay[1] },
    };
  }, [transactions]);

  // Sparkline — last 7 real calendar days vs the 7 before that. Uses
  // allTransactions since this window can span a month boundary even though
  // the ledger itself is scoped to one month.
  const sparkline = useMemo(() => {
    const now = new Date();
    const daily: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = ymd(d);
      const total = allTransactions.filter((t) => t.type === 'expense' && t.date === key).reduce((s, t) => s + t.amount, 0);
      daily.push(total);
    }
    const priorWeekStart = new Date(now);
    priorWeekStart.setDate(priorWeekStart.getDate() - 13);
    const priorWeekEnd = new Date(now);
    priorWeekEnd.setDate(priorWeekEnd.getDate() - 7);
    const thisWeekSum = daily.reduce((s, v) => s + v, 0);
    const priorWeekSum = allTransactions
      .filter((t) => t.type === 'expense' && new Date(t.date + 'T12:00:00') >= priorWeekStart && new Date(t.date + 'T12:00:00') <= priorWeekEnd)
      .reduce((s, t) => s + t.amount, 0);
    const deltaPct = priorWeekSum > 0 ? ((thisWeekSum - priorWeekSum) / priorWeekSum) * 100 : null;
    return { daily, deltaPct };
  }, [allTransactions]);

  const nearbyMonths = useMemo(() => {
    return [-2, -1, 0].map((offset) => {
      const d = new Date(month.getFullYear(), month.getMonth() + offset, 1);
      return { offset, label: d.toLocaleDateString('en-IN', { month: 'short' }) };
    });
  }, [month]);

  function toggleCategory(c: string) {
    const next = new Set(filter.categories);
    next.has(c) ? next.delete(c) : next.add(c);
    setFilter({ ...filter, categories: next });
    setTimeout(() => setFiltersOpen(false), 350);
  }

  function toggleFlag(key: 'indulgence' | 'essential' | 'regret') {
    setFilter({ ...filter, [key]: !filter[key] });
    setTimeout(() => setFiltersOpen(false), 350);
  }

  const chip = (active: boolean) =>
    `text-sc-14 px-2.5 py-1.5 rounded-full border cursor-pointer ${active ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]' : 'border-[var(--border)]/70 bg-[var(--bg)]/50 text-[var(--muted)] hover:bg-[var(--bg)]/80 hover:border-[var(--accent)]/60 transition-colors'}`;

  const potPct = monthlyPot ? (monthTotal / monthlyPot) * 100 : null;
  const sparkMax = Math.max(...sparkline.daily, 1);
  const sparkPoints = sparkline.daily.map((v, i) => `${(i / 6) * 100},${30 - (v / sparkMax) * 26}`).join(' ');

  let lastWeekKey: string | null = null;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-center gap-1 mb-3">
        <button onClick={onPrevMonth} className="text-[var(--muted)] hover:text-[var(--text)] text-sc-18 px-1 transition-colors shrink-0">‹</button>
        {nearbyMonths.map((m) => (
          <button
            key={m.offset}
            onClick={() => m.offset !== 0 ? onJumpMonths(m.offset) : onToday()}
            className="px-2.5 py-1 rounded-full transition-colors"
            style={m.offset === 0
              ? { background: 'var(--accent)', color: 'var(--bg)', fontWeight: 600, fontSize: 15 }
              : { color: 'var(--muted)', fontSize: 12 }}
          >
            {m.offset === 0 ? monthLabel : m.label}
          </button>
        ))}
        <button onClick={onNextMonth} className="text-[var(--muted)] hover:text-[var(--text)] text-sc-18 px-1 transition-colors shrink-0">›</button>
      </div>

      {potPct !== null ? (
        <div className="flex items-center gap-4 bg-[var(--bg)]/40 rounded-2xl p-4 mb-3">
          <div className="rounded-full shrink-0" style={{ width: 72, height: 72, background: donutGradient(potPct) }}>
            <div className="rounded-full flex items-center justify-center" style={{ width: 52, height: 52, margin: 10, background: 'var(--surface)' }}>
              <span className="text-sc-16 font-bold text-[var(--text)]">{Math.round(potPct)}%</span>
            </div>
          </div>
          <div>
            <p className="text-sc-18 font-bold text-[var(--text)]">{fmt(monthTotal)}</p>
            <p className="text-sc-13 text-[var(--muted)]">of {fmt(monthlyPot!)} pot</p>
          </div>
        </div>
      ) : (
        <p className="text-sc-22 font-bold text-[var(--positive)] tracking-tight mb-3">{fmt(monthTotal)}<span className="text-sc-16 font-normal text-[var(--muted)] ml-1.5">spent</span></p>
      )}

      {highlights && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="relative rounded-xl p-2.5 overflow-hidden" style={{ background: 'var(--accent)' }}>
            <IconReceipt2 size={22} className="absolute top-1.5 right-1.5" style={{ color: 'rgba(255,255,255,.28)' }} />
            <p className="text-sc-9 relative pr-4" style={{ color: 'rgba(255,255,255,.8)' }}>Biggest expense</p>
            <p className="text-sc-15 font-bold relative text-white truncate pr-1">{fmt(highlights.biggest.amount)}</p>
            <p className="text-sc-8 relative truncate" style={{ color: 'rgba(255,255,255,.75)' }}>{highlights.biggest.description}</p>
          </div>
          <div className="relative rounded-xl p-2.5 overflow-hidden" style={{ background: CAT_COLORS[highlights.topCategory.name] || 'var(--positive)' }}>
            <IconCategory size={22} className="absolute top-1.5 right-1.5" style={{ color: 'rgba(255,255,255,.3)' }} />
            <p className="text-sc-9 relative pr-4" style={{ color: 'rgba(255,255,255,.85)' }}>Most frequent</p>
            <p className="text-sc-15 font-bold relative text-white truncate pr-1">{highlights.topCategory.name}</p>
            <p className="text-sc-8 relative" style={{ color: 'rgba(255,255,255,.8)' }}>{highlights.topCategory.count} transactions</p>
          </div>
          <div className="relative rounded-xl p-2.5 overflow-hidden" style={{ background: 'var(--border)' }}>
            <IconFlame size={22} className="absolute top-1.5 right-1.5" style={{ color: 'rgba(255,255,255,.3)' }} />
            <p className="text-sc-9 relative pr-4" style={{ color: 'rgba(255,255,255,.8)' }}>Busiest day</p>
            <p className="text-sc-15 font-bold relative text-white truncate pr-1">{new Date(highlights.busiestDay.date + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
            <p className="text-sc-8 relative" style={{ color: 'rgba(255,255,255,.75)' }}>{highlights.busiestDay.count} transactions</p>
          </div>
        </div>
      )}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search ledger"
        className="w-full bg-[var(--bg)]/50 border border-[var(--border)]/70 rounded-lg px-3 py-2 text-sc-16 text-[var(--text)] placeholder:text-[var(--muted)] mb-2 focus:outline-none focus:border-[var(--accent)]/60 transition-colors"
      />

      <div className="flex justify-between items-center bg-[var(--bg)]/40 rounded-lg px-3 py-2 mb-2">
        <span className="text-sc-12 text-[var(--muted)]">Last 7 days</span>
        <svg viewBox="0 0 100 30" style={{ width: 70, height: 20 }}>
          <polyline points={sparkPoints} fill="none" stroke="var(--accent)" strokeWidth="2" />
        </svg>
        {sparkline.deltaPct !== null ? (
          <span className="text-sc-12 font-semibold" style={{ color: sparkline.deltaPct >= 0 ? 'var(--danger)' : 'var(--positive)' }}>
            {sparkline.deltaPct >= 0 ? '▲' : '▼'} {Math.abs(Math.round(sparkline.deltaPct))}%
          </span>
        ) : (
          <span className="text-sc-12 text-[var(--muted)]">—</span>
        )}
      </div>

      <button
        onClick={() => setFiltersOpen((v) => !v)}
        className="w-full flex items-center justify-between bg-[var(--bg)]/40 rounded-lg px-3 py-2 mb-2"
      >
        <span className="flex items-center gap-2 text-sc-14 font-medium text-[var(--text)]">
          Filters
          {anyChipActive && (
            <span
              onClick={(e) => { e.stopPropagation(); setFilter(emptyFilter()); }}
              title="Clear all filters"
              className="bg-[var(--accent)] text-[var(--bg)] text-sc-11 font-semibold px-2 py-0.5 rounded-full"
            >
              {activeFilterCount}
            </span>
          )}
        </span>
        <IconChevronDown size={16} className="text-[var(--muted)] transition-transform" style={{ transform: filtersOpen ? 'rotate(180deg)' : 'none' }} />
      </button>

      {filtersOpen && (
        <>
          <div className="flex flex-wrap gap-1.5 mb-1">
            <span onClick={() => toggleFlag('indulgence')} className={chip(filter.indulgence)}>indulgence</span>
            <span onClick={() => toggleFlag('essential')} className={chip(filter.essential)}>essential</span>
            <span onClick={() => toggleFlag('regret')} className={chip(filter.regret)}>regret</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {categories.map((c) => (
              <span key={c} onClick={() => toggleCategory(c)} className={chip(filter.categories.has(c))}>{c}</span>
            ))}
          </div>
        </>
      )}

      <div className="flex-1 overflow-auto -mx-1 px-1.5">
        {grouped.length === 0 && (
          <div className="text-center mt-10">
            <p className="text-sc-16 font-medium text-[var(--text)] mb-1">Nothing here yet</p>
            <p className="text-sc-14 text-[var(--muted)]">{anyChipActive || search ? 'No transactions match your filters.' : 'Log your first expense this month to see it here.'}</p>
          </div>
        )}
        {grouped.map(([date, txns]) => {
          const dayTotal = txns.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
          const dayMax = Math.max(...txns.map((t) => t.amount), 1);
          const wk = mondayOf(date);
          const showWeekDivider = lastWeekKey !== null && wk !== lastWeekKey;
          lastWeekKey = wk;
          const isToday = date === todayStr();

          return (
            <div key={date}>
              {showWeekDivider && (
                <div className="flex items-center gap-2.5 my-2">
                  <div className="flex-1 h-px bg-[var(--border)]/30" />
                  <span className="text-sc-11 text-[var(--muted)] whitespace-nowrap">Week of {new Date(wk + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {fmt(weekTotals.get(wk) || 0)}</span>
                  <div className="flex-1 h-px bg-[var(--border)]/30" />
                </div>
              )}
              <div
                className="sticky top-0 flex justify-between text-sc-14 uppercase tracking-wide font-semibold py-2 mb-1.5 z-10"
                style={isToday
                  ? { color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent), var(--surface) 85%)', paddingLeft: 8, paddingRight: 8, marginLeft: -8, marginRight: -8, borderRadius: 6 }
                  : { color: 'var(--muted)', background: 'var(--surface)' }}
              >
                <span>{isToday ? 'Today' : new Date(date + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                <span>{fmt(dayTotal)}</span>
              </div>
              {txns.map((t) => {
                const fillPct = (t.amount / dayMax) * 100;
                return (
                  <div
                    key={t.id}
                    onClick={() => onSelect(t)}
                    className={`group relative flex items-center gap-2 py-2.5 px-2 -mx-1.5 my-1 rounded-lg cursor-pointer overflow-hidden ${selectedId === t.id ? 'ring-1' : ''}`}
                    style={selectedId === t.id ? { ['--tw-ring-color' as any]: 'var(--accent)' } : undefined}
                  >
                    <div
                      className="absolute left-0 top-0 bottom-0 transition-all"
                      style={{ width: `${fillPct}%`, background: `color-mix(in srgb, ${CAT_COLORS[t.category] || 'var(--muted)'}, transparent 82%)` }}
                    />
                    <span className="w-2 h-2 rounded-full shrink-0 relative" style={{ background: CAT_COLORS[t.category] || 'var(--muted)' }} />
                    <span className="text-sc-16 text-[var(--text)] truncate flex-1 relative">{t.description}</span>
                    {t.regret && (
                      <span className="text-sc-10 font-semibold px-1.5 py-0.5 rounded shrink-0 relative" style={{ background: 'color-mix(in srgb, var(--danger), transparent 88%)', color: 'var(--danger)' }}>
                        Regret
                      </span>
                    )}
                    <span
                      className="text-sc-16 font-medium shrink-0 relative"
                      style={{ color: t.type !== 'expense' ? 'var(--positive)' : t.indulgence ? 'var(--accent)' : 'var(--text)' }}
                    >
                      {t.type !== 'expense' ? '+' : '-'}{fmt(t.amount)}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(t.id); }}
                      className="opacity-0 group-hover:opacity-100 text-[var(--muted)] hover:text-[var(--danger)] text-sc-16 shrink-0 transition-opacity relative"
                      aria-label="Delete"
                    >✕</button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
