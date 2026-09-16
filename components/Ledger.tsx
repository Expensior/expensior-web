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
        <button onClick={onPrevMonth} className="text-[#BDB4C3] hover:text-[#FAF7F2] text-xs px-1">‹</button>
        <button onClick={onToday} className="text-[11px] text-[#BDB4C3]">{monthLabel}</button>
        <button onClick={onNextMonth} className="text-[#BDB4C3] hover:text-[#FAF7F2] text-xs px-1">›</button>
      </div>
      <p className="text-[11px] text-[#BDB4C3] mb-2">{fmt(monthTotal)} spent</p>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search ledger"
        className="w-full bg-[#355070] border border-[#6D597A] rounded-lg px-2.5 py-1.5 text-xs text-[#FAF7F2] placeholder:text-[#BDB4C3] mb-2"
      />

      <div className="flex flex-wrap gap-1.5 mb-1">
        <span
          onClick={() => setFilter({ ...filter, indulgence: !filter.indulgence })}
          className={`text-[10px] px-2 py-1 rounded-full border cursor-pointer ${filter.indulgence ? 'border-[#B56576] bg-[#B56576]/15 text-[#B56576]' : 'border-[#6D597A] text-[#BDB4C3]'}`}
        >indulgence</span>
        <span
          onClick={() => setFilter({ ...filter, essential: !filter.essential })}
          className={`text-[10px] px-2 py-1 rounded-full border cursor-pointer ${filter.essential ? 'border-[#B56576] bg-[#B56576]/15 text-[#B56576]' : 'border-[#6D597A] text-[#BDB4C3]'}`}
        >essential</span>
        <span
          onClick={() => setFilter({ ...filter, regret: !filter.regret })}
          className={`text-[10px] px-2 py-1 rounded-full border cursor-pointer ${filter.regret ? 'border-[#B56576] bg-[#B56576]/15 text-[#B56576]' : 'border-[#6D597A] text-[#BDB4C3]'}`}
        >regret</span>
        {anyChipActive && (
          <span onClick={() => setFilter(emptyFilter())} className="text-[10px] px-2 py-1 text-[#BDB4C3] underline cursor-pointer">
            clear
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {categories.map((c) => (
          <span
            key={c}
            onClick={() => toggleCategory(c)}
            className={`text-[10px] px-2 py-1 rounded-full border cursor-pointer ${filter.categories.has(c) ? 'border-[#B56576] bg-[#B56576]/15 text-[#B56576]' : 'border-[#6D597A] text-[#BDB4C3]'}`}
          >{c}</span>
        ))}
      </div>

      <div className="flex-1 overflow-auto -mx-1 px-1">
        {grouped.length === 0 && <p className="text-xs text-[#BDB4C3] text-center mt-6">No transactions match</p>}
        {grouped.map(([date, txns]) => {
          const dayTotal = txns.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
          return (
            <div key={date}>
              <div className="sticky top-0 bg-[#355070] flex justify-between text-[10px] text-[#BDB4C3] py-1">
                <span>{new Date(date + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                <span>{fmt(dayTotal)}</span>
              </div>
              {txns.map((t) => (
                <div
                  key={t.id}
                  onClick={() => onSelect(t)}
                  className={`group flex items-center gap-2 py-1.5 border-b border-[#6D597A]/30 cursor-pointer ${selectedId === t.id ? 'bg-[#B56576]/5' : ''}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: CAT_COLORS[t.category] || '#BDB4C3' }} />
                  <span className="text-xs text-[#FAF7F2] truncate flex-1">{t.description}</span>
                  <span
                    className="text-xs shrink-0"
                    style={{ color: t.type !== 'expense' ? '#EAAC8B' : t.indulgence ? '#B56576' : '#FAF7F2' }}
                  >
                    {t.type !== 'expense' ? '+' : '-'}{fmt(t.amount)}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(t.id); }}
                    className="opacity-0 group-hover:opacity-100 text-[#BDB4C3] hover:text-[#E56B6F] text-xs shrink-0"
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
