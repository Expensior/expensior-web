'use client';

import { useMemo, useState } from 'react';
import {
  IconGauge, IconLayoutDashboard, IconChartLine, IconBell, IconNotebook,
} from '@tabler/icons-react';
import { fmt } from '@/lib/parse';
import { CAT_COLORS } from '@/lib/categories';
import type { Transaction } from '@/lib/types';

interface Reflection {
  id: string;
  week_label: string | null;
  good: string | null;
  regret: string | null;
  wish: string | null;
  created_at: string;
}

interface FlaggedSub {
  id: string;
  merchant: string;
  amount: number | null;
  flagged_at: string;
}

const SECTIONS = [
  { key: 'patterns', label: 'Patterns', icon: IconGauge },
  { key: 'overview', label: 'Overview', icon: IconLayoutDashboard },
  { key: 'trends', label: 'Trends', icon: IconChartLine },
  { key: 'subs', label: 'Subscriptions', icon: IconBell },
  { key: 'reflect', label: 'Reflect', icon: IconNotebook },
] as const;

function weekRange(offset: number) {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return { start: mon, end: sun };
}

export default function Dashboard({
  allTransactions,
  monthlyPot,
  reflections,
  onAddReflection,
  flaggedSubs,
  onSelectCategory,
}: {
  allTransactions: Transaction[];
  monthlyPot: number | null;
  reflections: Reflection[];
  onAddReflection: (r: { good: string; regret: string; wish: string }) => void;
  flaggedSubs: FlaggedSub[];
  onSelectCategory: (category: string) => void;
}) {
  const [active, setActive] = useState<typeof SECTIONS[number]['key']>('patterns');

  const weekExpenses = useMemo(() => {
    const { start, end } = weekRange(0);
    return allTransactions.filter((t) => {
      const d = new Date(t.date + 'T12:00:00');
      return d >= start && d <= end && t.type === 'expense';
    });
  }, [allTransactions]);

  return (
    <div className="h-full flex bg-[#355070] border border-[#6D597A] rounded-xl overflow-hidden">
      <div className="flex flex-col py-2 shrink-0" style={{ width: 44 }}>
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const isActive = active === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setActive(s.key)}
              title={s.label}
              className={`group flex items-center gap-2 px-3 py-2.5 whitespace-nowrap overflow-hidden hover:bg-[#1D2C3E] transition-colors ${isActive ? 'text-[#B56576]' : 'text-[#BDB4C3]'}`}
            >
              <Icon size={17} className="shrink-0" />
              <span className="text-[11px] opacity-0 group-hover:opacity-100 max-w-0 group-hover:max-w-[120px] transition-all overflow-hidden">
                {s.label}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex-1 p-4 overflow-auto min-w-0">
        {active === 'patterns' && <Patterns transactions={weekExpenses} monthlyPot={monthlyPot} allTransactions={allTransactions} />}
        {active === 'overview' && <Overview transactions={weekExpenses} onSelectCategory={onSelectCategory} />}
        {active === 'trends' && <Trends allTransactions={allTransactions} />}
        {active === 'subs' && <Subscriptions subs={flaggedSubs} />}
        {active === 'reflect' && <Reflect reflections={reflections} onAdd={onAddReflection} />}
      </div>
    </div>
  );
}

function Patterns({ transactions, monthlyPot, allTransactions }: { transactions: Transaction[]; monthlyPot: number | null; allTransactions: Transaction[] }) {
  const byTag = useMemo(() => {
    const map = new Map<string, number>();
    transactions.forEach((t) => { if (t.tag) map.set(t.tag, (map.get(t.tag) || 0) + t.amount); });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [transactions]);

  const indulgent = transactions.filter((t) => t.indulgence);
  const regretRate = indulgent.length ? Math.round((indulgent.filter((t) => t.regret).length / indulgent.length) * 100) : 0;

  const now = new Date();
  const monthTxns = allTransactions.filter((t) => {
    const d = new Date(t.date + 'T12:00:00');
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && t.type === 'expense';
  });
  const monthSpent = monthTxns.reduce((s, t) => s + t.amount, 0);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const projected = dayOfMonth > 0 ? Math.round((monthSpent / dayOfMonth) * daysInMonth) : 0;
  const potPct = monthlyPot ? Math.min(100, Math.round((monthSpent / monthlyPot) * 100)) : null;

  return (
    <div>
      <p className="text-[11px] text-[#BDB4C3] mb-2">Spend by emotional tag, this week</p>
      {byTag.length === 0 && <p className="text-xs text-[#BDB4C3] mb-4">No tagged transactions this week yet.</p>}
      <div className="flex flex-col gap-2 mb-4">
        {byTag.map(([tag, amt]) => {
          const max = byTag[0][1];
          return (
            <div key={tag}>
              <div className="flex justify-between text-[11px] mb-1"><span className="text-[#FAF7F2]">{tag}</span><span className="text-[#BDB4C3]">{fmt(amt)}</span></div>
              <div className="h-2 bg-[#1D2C3E] rounded-full overflow-hidden"><div className="h-full bg-[#B56576]" style={{ width: `${(amt / max) * 100}%` }} /></div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-[#BDB4C3] mb-4">Regret rate on indulgent spend: <span className="text-[#FAF7F2]">{regretRate}%</span></p>

      <p className="text-[11px] text-[#BDB4C3] mb-1.5">Monthly pot burn-down</p>
      {monthlyPot ? (
        <>
          <div className="h-3.5 bg-[#1D2C3E] rounded-full overflow-hidden mb-1.5">
            <div className="h-full" style={{ width: `${potPct}%`, background: (potPct || 0) > 100 ? '#E56B6F' : '#EAAC8B' }} />
          </div>
          <p className="text-[11px] text-[#BDB4C3] mb-2">{fmt(Math.max(0, monthlyPot - monthSpent))} left · {daysInMonth - dayOfMonth} days remaining</p>
          <div className="bg-[#1D2C3E] border border-[#6D597A] rounded-lg p-2.5 text-xs">
            Projected month-end: <span style={{ color: projected > monthlyPot ? '#E56B6F' : '#EAAC8B' }}>{fmt(projected)}</span>
            {projected > monthlyPot && <span> — over budget by {fmt(projected - monthlyPot)}</span>}
          </div>
        </>
      ) : (
        <p className="text-xs text-[#BDB4C3]">Set a monthly pot in settings to see burn-down and projections.</p>
      )}
    </div>
  );
}

function Overview({ transactions, onSelectCategory }: { transactions: Transaction[]; onSelectCategory: (c: string) => void }) {
  const spent = transactions.reduce((s, t) => s + t.amount, 0);
  const indulgent = transactions.filter((t) => t.indulgence).reduce((s, t) => s + t.amount, 0);
  const byCat = useMemo(() => {
    const map = new Map<string, number>();
    transactions.forEach((t) => map.set(t.category, (map.get(t.category) || 0) + t.amount));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [transactions]);

  return (
    <div>
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        <div className="bg-[#1D2C3E] rounded-lg p-2.5"><p className="text-[10px] text-[#BDB4C3] mb-1">Spent this week</p><p className="text-lg font-medium text-[#EAAC8B]">{fmt(spent)}</p></div>
        <div className="bg-[#1D2C3E] rounded-lg p-2.5"><p className="text-[10px] text-[#BDB4C3] mb-1">Indulgence</p><p className="text-lg font-medium text-[#B56576]">{spent ? Math.round((indulgent / spent) * 100) : 0}%</p></div>
        <div className="bg-[#1D2C3E] rounded-lg p-2.5"><p className="text-[10px] text-[#BDB4C3] mb-1">Transactions</p><p className="text-lg font-medium text-[#FAF7F2]">{transactions.length}</p></div>
      </div>
      <p className="text-[11px] text-[#BDB4C3] mb-1.5">Category split — click to filter the ledger</p>
      <div className="flex h-3.5 rounded-full overflow-hidden mb-2">
        {byCat.map(([cat, amt]) => (
          <button key={cat} onClick={() => onSelectCategory(cat)} style={{ width: `${(amt / (spent || 1)) * 100}%`, background: CAT_COLORS[cat] || '#BDB4C3' }} title={`${cat}: ${fmt(amt)}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {byCat.map(([cat]) => (
          <span key={cat} className="text-[10px] text-[#BDB4C3] flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: CAT_COLORS[cat] || '#BDB4C3' }} />{cat}
          </span>
        ))}
      </div>
    </div>
  );
}

function Trends({ allTransactions }: { allTransactions: Transaction[] }) {
  const weeks = useMemo(() => {
    const out: { label: string; total: number }[] = [];
    for (let i = -7; i <= 0; i++) {
      const { start, end } = weekRange(i);
      const total = allTransactions.filter((t) => {
        const d = new Date(t.date + 'T12:00:00');
        return d >= start && d <= end && t.type === 'expense';
      }).reduce((s, t) => s + t.amount, 0);
      out.push({ label: start.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }), total });
    }
    return out;
  }, [allTransactions]);

  const topMerchants = useMemo(() => {
    const map = new Map<string, number>();
    allTransactions.filter((t) => t.type === 'expense').forEach((t) => map.set(t.description, (map.get(t.description) || 0) + t.amount));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [allTransactions]);

  const max = Math.max(...weeks.map((w) => w.total), 1);

  return (
    <div>
      <p className="text-[11px] text-[#BDB4C3] mb-2">Weekly spend, last 8 weeks</p>
      <div className="flex items-end gap-2 h-28 mb-1">
        {weeks.map((w, i) => (
          <div key={i} className="flex-1 bg-[#EAAC8B] rounded-t" style={{ height: `${(w.total / max) * 100}%`, minHeight: 2 }} title={fmt(w.total)} />
        ))}
      </div>
      <div className="flex gap-2 mb-4">
        {weeks.map((w, i) => <span key={i} className="flex-1 text-center text-[9px] text-[#BDB4C3]">{w.label}</span>)}
      </div>
      <p className="text-[11px] text-[#BDB4C3] mb-1.5">Top merchants, all time</p>
      <div className="flex flex-col gap-1.5">
        {topMerchants.map(([name, amt]) => (
          <div key={name} className="flex justify-between text-xs"><span className="text-[#FAF7F2]">{name}</span><span className="text-[#BDB4C3]">{fmt(amt)}</span></div>
        ))}
        {topMerchants.length === 0 && <p className="text-xs text-[#BDB4C3]">Not enough data yet.</p>}
      </div>
    </div>
  );
}

function Subscriptions({ subs }: { subs: FlaggedSub[] }) {
  const total = subs.reduce((s, x) => s + (x.amount || 0), 0);
  return (
    <div>
      {subs.length === 0 && (
        <p className="text-xs text-[#BDB4C3]">No flagged subscriptions yet. Automatic detection ships with recurring transactions in v1.05 — for now, flag one manually from settings.</p>
      )}
      <div className="flex flex-col gap-2">
        {subs.map((s) => (
          <div key={s.id} className="flex justify-between items-center bg-[#1D2C3E] rounded-lg px-3 py-2">
            <div>
              <p className="text-xs text-[#FAF7F2]">{s.merchant}</p>
              <p className="text-[10px] text-[#BDB4C3]">Flagged {new Date(s.flagged_at).toLocaleDateString('en-IN')}</p>
            </div>
            <span className="text-[10px] text-[#B56576]">{s.amount ? fmt(s.amount) : ''}</span>
          </div>
        ))}
      </div>
      {subs.length > 0 && <p className="text-[11px] text-[#BDB4C3] mt-3">Total recurring: {fmt(total)}/mo</p>}
    </div>
  );
}

function Reflect({ reflections, onAdd }: { reflections: Reflection[]; onAdd: (r: { good: string; regret: string; wish: string }) => void }) {
  const [good, setGood] = useState('');
  const [regret, setRegret] = useState('');
  const [wish, setWish] = useState('');

  function submit() {
    if (!good && !regret && !wish) return;
    onAdd({ good, regret, wish });
    setGood(''); setRegret(''); setWish('');
  }

  return (
    <div>
      <p className="text-[11px] text-[#BDB4C3] mb-2">This week</p>
      <textarea value={good} onChange={(e) => setGood(e.target.value)} placeholder="Felt genuinely good…" className="w-full bg-[#1D2C3E] border border-[#6D597A] rounded-lg px-2.5 py-1.5 text-xs text-[#FAF7F2] mb-2" rows={2} />
      <textarea value={regret} onChange={(e) => setRegret(e.target.value)} placeholder="Wish I hadn't…" className="w-full bg-[#1D2C3E] border border-[#6D597A] rounded-lg px-2.5 py-1.5 text-xs text-[#FAF7F2] mb-2" rows={2} />
      <textarea value={wish} onChange={(e) => setWish(e.target.value)} placeholder="Would have liked to spend on…" className="w-full bg-[#1D2C3E] border border-[#6D597A] rounded-lg px-2.5 py-1.5 text-xs text-[#FAF7F2] mb-3" rows={2} />
      <button onClick={submit} className="bg-[#B56576] text-[#1D2C3E] rounded-lg px-4 py-1.5 text-xs font-medium mb-4">Save this week&apos;s reflection</button>

      {reflections.length > 0 && <p className="text-[10px] text-[#BDB4C3] uppercase tracking-wide mb-2">Past reflections</p>}
      <div className="flex flex-col gap-2">
        {reflections.map((r) => (
          <div key={r.id} className="bg-[#1D2C3E] border border-[#6D597A] rounded-lg p-2.5">
            <p className="text-[10px] text-[#BDB4C3] mb-1.5">{new Date(r.created_at).toLocaleDateString('en-IN')}</p>
            {r.good && <p className="text-xs text-[#FAF7F2] mb-1"><span className="text-[#EAAC8B]">Good: </span>{r.good}</p>}
            {r.regret && <p className="text-xs text-[#FAF7F2] mb-1"><span className="text-[#E56B6F]">Regret: </span>{r.regret}</p>}
            {r.wish && <p className="text-xs text-[#FAF7F2]"><span className="text-[#EAAC8B]">Wish: </span>{r.wish}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
