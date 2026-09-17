'use client';

import { useMemo, useState } from 'react';
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

export default function Ledger({
  monthLabel,
  onPrevMonth,
  onNextMonth,
  onToday,
  transactions,
  categories,
  filter,
  setFilter,
  search,
  setSearch,
  selectedId,
  onSelect,
  onDelete,
}: {
  monthLabel: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  transactions: Transaction[];
  categories: string[];
  filter: LedgerFilter;
  setFilter: (f: LedgerFilter) => void;
  search: string;
  setSearch: (s: string) => void;
  selectedId: string | null;
  onSelect: (t: Transaction) => void;
  onDelete: (id: string) => void;
}) {
  const monthTotal = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const anyChipActive = filter.categories.size > 0 || filter.indulgence || filter.essential || filter.regret;

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

  function toggleCategory(c: string) {
    const next = new Set(filter.categories);
    next.has(c) ? next.delete(c) : next.add(c);
    setFilter({ ...filter, categories: next });
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <button onClick={onPrevMonth} className="text-[var(--muted)] hover:text-[var(--text)] text-sm px-1.5 transition-colors">‹</button>
        <button onClick={onToday} className="text-sm font-semibold text-[var(--text)] tracking-tight">{monthLabel}</button>
        <button onClick={onNextMonth} className="text-[var(--muted)] hover:text-[var(--text)] text-sm px-1.5 transition-colors">›</button>
      </div>
      <p className="text-lg font-bold text-[var(--positive)] tracking-tight mb-3">{fmt(monthTotal)}<span className="text-[11px] font-normal text-[var(--muted)] ml-1.5">spent</span></p>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search ledger"
        className="w-full bg-[var(--bg)]/50 border border-[var(--border)]/70 rounded-lg px-2.5 py-1.5 text-xs text-[var(--text)] placeholder:text-[var(--muted)] mb-2 focus:outline-none focus:border-[var(--accent)]/60 transition-colors"
      />

      <div className="flex flex-wrap gap-1.5 mb-1">
        <span
          onClick={() => setFilter({ ...filter, indulgence: !filter.indulgence })}
          className={`text-[10px] px-2 py-1 rounded-full border cursor-pointer ${filter.indulgence ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]' : 'border-[var(--border)]/70 bg-[var(--bg)]/50 text-[var(--muted)] hover:bg-[var(--bg)]/80 hover:border-[var(--accent)]/60 transition-colors'}`}
        >indulgence</span>
        <span
          onClick={() => setFilter({ ...filter, essential: !filter.essential })}
          className={`text-[10px] px-2 py-1 rounded-full border cursor-pointer ${filter.essential ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]' : 'border-[var(--border)]/70 bg-[var(--bg)]/50 text-[var(--muted)] hover:bg-[var(--bg)]/80 hover:border-[var(--accent)]/60 transition-colors'}`}
        >essential</span>
        <span
          onClick={() => setFilter({ ...filter, regret: !filter.regret })}
          className={`text-[10px] px-2 py-1 rounded-full border cursor-pointer ${filter.regret ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]' : 'border-[var(--border)]/70 bg-[var(--bg)]/50 text-[var(--muted)] hover:bg-[var(--bg)]/80 hover:border-[var(--accent)]/60 transition-colors'}`}
        >regret</span>
        {anyChipActive && (
          <span onClick={() => setFilter(emptyFilter())} className="text-[10px] px-2 py-1 text-[var(--muted)] underline cursor-pointer">
            clear
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {categories.map((c) => (
          <span
            key={c}
            onClick={() => toggleCategory(c)}
            className={`text-[10px] px-2 py-1 rounded-full border cursor-pointer ${filter.categories.has(c) ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]' : 'border-[var(--border)]/70 bg-[var(--bg)]/50 text-[var(--muted)] hover:bg-[var(--bg)]/80 hover:border-[var(--accent)]/60 transition-colors'}`}
          >{c}</span>
        ))}
      </div>

      <div className="flex-1 overflow-auto -mx-1 px-1">
        {grouped.length === 0 && (
          <div className="text-center mt-10">
            <p className="text-xs text-[var(--muted)]">No transactions match</p>
          </div>
        )}
        {grouped.map(([date, txns]) => {
          const dayTotal = txns.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
          return (
            <div key={date}>
              <div className="sticky top-0 bg-[var(--surface)] flex justify-between text-[10px] text-[var(--muted)] uppercase tracking-wide font-semibold py-1.5">
                <span>{new Date(date + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                <span>{fmt(dayTotal)}</span>
              </div>
              {txns.map((t) => (
                <div
                  key={t.id}
                  onClick={() => onSelect(t)}
                  className={`group flex items-center gap-2 py-2 px-1.5 -mx-1.5 rounded-lg border-b border-[var(--border)]/30 cursor-pointer hover:bg-[var(--bg)]/40 transition-colors ${selectedId === t.id ? 'bg-[var(--accent)]/10 border-[var(--accent)]/30' : ''}`}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CAT_COLORS[t.category] || 'var(--muted)' }} />
                  <span className="text-xs text-[var(--text)] truncate flex-1">{t.description}</span>
                  <span
                    className="text-xs font-medium shrink-0"
                    style={{ color: t.type !== 'expense' ? 'var(--positive)' : t.indulgence ? 'var(--accent)' : 'var(--text)' }}
                  >
                    {t.type !== 'expense' ? '+' : '-'}{fmt(t.amount)}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(t.id); }}
                    className="opacity-0 group-hover:opacity-100 text-[var(--muted)] hover:text-[var(--danger)] text-xs shrink-0 transition-opacity"
                    aria-label="Delete"
                  >✕</button>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
