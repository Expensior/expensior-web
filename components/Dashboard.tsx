'use client';

import { useMemo, useState } from 'react';
import {
  IconGauge, IconChartLine, IconTargetArrow, IconNotebook, IconSunrise,
  IconFlag, IconPlus, IconClock, IconFlame, IconTrophy,
} from '@tabler/icons-react';
import { fmt } from '@/lib/parse';
import { CAT_COLORS } from '@/lib/categories';
import { computeGoalPace, computeLoggingStreak } from '@/lib/goals';
import { computeSelfKnowledgeHistory, computeBias, scoreLabel, type Intention } from '@/lib/selfKnowledge';
import type { Transaction, Goal, GoalContribution, Digest } from '@/lib/types';
import SegmentedTabs from './SegmentedTabs';
import GoalMountain from './GoalMountain';

const RAIL = [
  { key: 'overview', icon: IconGauge, label: 'Overview' },
  { key: 'patterns', icon: IconChartLine, label: 'Patterns and trends', tabs: [['patterns', 'Patterns'], ['trends', 'Trends']] as [string, string][] },
  { key: 'selfknow', icon: IconTargetArrow, label: 'Self-knowledge and subscriptions', tabs: [['selfknow', 'Self-knowledge'], ['subs', 'Subscriptions']] as [string, string][] },
  { key: 'reflect', icon: IconNotebook, label: 'Reflect and digest', tabs: [['reflect', 'Reflect'], ['digest', 'Digest']] as [string, string][] },
  { key: 'goals', icon: IconFlag, label: 'Goals' },
];

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

function inWeek(t: Transaction, range: { start: Date; end: Date }) {
  const d = new Date(t.date + 'T12:00:00');
  return d >= range.start && d <= range.end && t.type === 'expense';
}

export default function Dashboard({
  allTransactions, monthlyPot, reflections, onAddReflection, flaggedSubs, onSelectCategory,
  goals, goalContributions, onAddGoal, onLogContribution,
  digests, intentions, onSetIntention, lastVisitedAt,
}: {
  allTransactions: Transaction[];
  monthlyPot: number | null;
  reflections: any[];
  onAddReflection: (r: { good: string; regret: string; wish: string }) => void;
  flaggedSubs: any[];
  onSelectCategory: (category: string) => void;
  goals: Goal[];
  goalContributions: GoalContribution[];
  onAddGoal: (g: { name: string; target_amount: number; target_date: string | null }) => void;
  onLogContribution: (goalId: string, amount: number) => void;
  digests: Digest[];
  intentions: Intention[];
  onSetIntention: (amount: number) => void;
  lastVisitedAt: string | null;
}) {
  const [activeMain, setActiveMain] = useState('overview');
  const [activeSub, setActiveSub] = useState<Record<string, string>>({});

  const section = RAIL.find((s) => s.key === activeMain)!;
  const currentSub = section.tabs ? (activeSub[section.key] || section.tabs[0][0]) : section.key;

  const streak = useMemo(() => computeLoggingStreak(allTransactions.map((t) => t.date)), [allTransactions]);

  return (
    <div className="h-full flex bg-[var(--surface)] border border-[var(--border)]/60 rounded-2xl overflow-hidden shadow-lg shadow-black/20">
      <div className="flex flex-col py-3 shrink-0 bg-[var(--bg)]/30 border-r border-[var(--border)]/40" style={{ width: 56 }}>
        {RAIL.map((s) => {
          const Icon = s.icon;
          const isActive = activeMain === s.key;
          return (
            <button
              key={s.key}
              title={s.label}
              onClick={() => setActiveMain(s.key)}
              className="relative flex items-center justify-center py-2.5 hover:bg-[var(--bg)]/40 transition-colors"
            >
              {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-[var(--accent)] rounded-full" />}
              <Icon size={22} className={isActive ? 'text-[var(--accent)]' : 'text-[var(--muted)]'} />
            </button>
          );
        })}
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {section.tabs && (
          <div className="px-5 pt-4">
            <SegmentedTabs tabs={section.tabs} active={currentSub} onChange={(k) => setActiveSub((prev) => ({ ...prev, [section.key]: k }))} />
          </div>
        )}
        <div className="flex-1 p-6 overflow-auto min-w-0">
          {currentSub === 'overview' && <Overview allTransactions={allTransactions} onSelectCategory={onSelectCategory} streak={streak} lastVisitedAt={lastVisitedAt} />}
          {currentSub === 'patterns' && <Patterns allTransactions={allTransactions} monthlyPot={monthlyPot} />}
          {currentSub === 'trends' && <Trends allTransactions={allTransactions} />}
          {currentSub === 'selfknow' && <SelfKnowledge allTransactions={allTransactions} intentions={intentions} onSetIntention={onSetIntention} />}
          {currentSub === 'subs' && <Subscriptions subs={flaggedSubs} />}
          {currentSub === 'reflect' && <Reflect reflections={reflections} onAdd={onAddReflection} />}
          {currentSub === 'digest' && <DigestFeed digests={digests} />}
          {currentSub === 'goals' && <Goals goals={goals} contributions={goalContributions} onAddGoal={onAddGoal} onLogContribution={onLogContribution} />}
        </div>
      </div>
    </div>
  );
}

function DeltaStat({ label, value, icon: Icon, deltaPct, color }: { label: string; value: string; icon: any; deltaPct: number | null; color: string }) {
  return (
    <div className="bg-[var(--bg)]/40 rounded-xl p-3.5">
      <Icon size={20} style={{ color }} />
      <p className="text-xl font-bold mt-1.5 mb-0.5" style={{ color: 'var(--text)' }}>{value}</p>
      {deltaPct === null ? (
        <p className="text-[12px] text-[var(--muted)]">no history yet</p>
      ) : (
        <p className="text-[12px]" style={{ color: deltaPct >= 0 ? 'var(--danger)' : 'var(--positive)' }}>
          {deltaPct >= 0 ? '▲' : '▼'} {Math.abs(Math.round(deltaPct))}% vs last week
        </p>
      )}
      <p className="text-[12px] text-[var(--muted)] mt-0.5">{label}</p>
    </div>
  );
}

function Overview({ allTransactions, onSelectCategory, streak, lastVisitedAt }: { allTransactions: Transaction[]; onSelectCategory: (c: string) => void; streak: number; lastVisitedAt: string | null }) {
  const now = new Date();
  const thisWeek = allTransactions.filter((t) => inWeek(t, weekRange(0)));
  const lastWeek = allTransactions.filter((t) => inWeek(t, weekRange(-1)));

  const spent = thisWeek.reduce((s, t) => s + t.amount, 0);
  const lastSpent = lastWeek.reduce((s, t) => s + t.amount, 0);
  const spentDelta = lastWeek.length > 0 ? ((spent - lastSpent) / (lastSpent || 1)) * 100 : null;

  const indulgent = thisWeek.filter((t) => t.indulgence).reduce((s, t) => s + t.amount, 0);
  const indulgencePct = spent ? (indulgent / spent) * 100 : 0;
  const lastIndulgent = lastWeek.filter((t) => t.indulgence).reduce((s, t) => s + t.amount, 0);
  const lastIndulgencePct = lastSpent ? (lastIndulgent / lastSpent) * 100 : 0;
  const indulgenceDelta = lastWeek.length > 0 ? indulgencePct - lastIndulgencePct : null;

  const sinceVisit = useMemo(() => {
    if (!lastVisitedAt) return null;
    const since = new Date(lastVisitedAt);
    const recent = allTransactions.filter((t) => new Date(t.created_at) > since);
    const days = Math.max(0, Math.round((now.getTime() - since.getTime()) / 86400000));
    if (recent.length === 0) return null;
    const total = recent.reduce((s, t) => s + t.amount, 0);
    return { days, count: recent.length, total };
  }, [allTransactions, lastVisitedAt]);

  const byCat = useMemo(() => {
    const map = new Map<string, number>();
    thisWeek.forEach((t) => map.set(t.category, (map.get(t.category) || 0) + t.amount));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [thisWeek]);

  const monthTxns = allTransactions.filter((t) => {
    const d = new Date(t.date + 'T12:00:00');
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && t.type === 'expense';
  });
  const monthSpent = monthTxns.reduce((s, t) => s + t.amount, 0);

  const weeklyTrend = useMemo(() => {
    const weeks: number[] = [];
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const cursor = new Date(firstOfMonth);
    while (cursor <= lastOfMonth) {
      const weekStart = new Date(cursor);
      const weekEnd = new Date(cursor);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const total = monthTxns
        .filter((t) => { const d = new Date(t.date + 'T12:00:00'); return d >= weekStart && d <= weekEnd; })
        .reduce((s, t) => s + t.amount, 0);
      weeks.push(total);
      cursor.setDate(cursor.getDate() + 7);
    }
    return weeks;
  }, [monthTxns, now]);

  return (
    <div className="h-full flex flex-col gap-5">
      {sinceVisit && (
        <div className="bg-[var(--bg)]/40 rounded-xl px-5 py-3.5 flex items-center gap-3 shrink-0">
          <IconClock size={22} className="text-[var(--accent)] shrink-0" />
          <p className="text-base text-[var(--text)]">
            Since you were last here ({sinceVisit.days === 0 ? 'today' : `${sinceVisit.days}d ago`}): {sinceVisit.count} new transaction{sinceVisit.count === 1 ? '' : 's'}, {fmt(sinceVisit.total)} spent.
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-5 shrink-0">
        <DeltaStat label="Spent this week" value={fmt(spent)} icon={IconGauge} deltaPct={spentDelta} color="var(--accent)" />
        <DeltaStat label="Indulgence" value={`${Math.round(indulgencePct)}%`} icon={IconFlame} deltaPct={indulgenceDelta} color="var(--positive)" />
        <div className="bg-[var(--bg)]/40 rounded-2xl p-6 text-center">
          <IconFlame size={28} className="text-[var(--accent)] mx-auto" />
          <p className="text-4xl font-bold mt-3 mb-1 text-[var(--text)]">{streak}</p>
          <p className="text-base text-[var(--muted)]">day logging streak</p>
        </div>
      </div>

      <div className="bg-[var(--bg)]/40 rounded-2xl p-6 flex-1 flex flex-col justify-center min-h-0">
        <p className="text-sm text-[var(--muted)] uppercase tracking-wide mb-4">Category split — click to filter the ledger</p>
        <div className="flex h-6 rounded-full overflow-hidden mb-4">
          {byCat.length === 0 && <div className="w-full bg-[var(--surface)]" />}
          {byCat.map(([cat, amt]) => (
            <button key={cat} onClick={() => onSelectCategory(cat)} style={{ width: `${(amt / (spent || 1)) * 100}%`, background: CAT_COLORS[cat] || 'var(--muted)' }} title={`${cat}: ${fmt(amt)}`} />
          ))}
        </div>
        {byCat.length > 0 ? (
          <p className="text-base text-[var(--text)] mb-4">
            <strong>{byCat[0][0]}</strong> is {Math.round((byCat[0][1] / (spent || 1)) * 100)}% of your spend this week{byCat.length === 1 ? ' — add a few more days to see a fuller picture.' : '.'}
          </p>
        ) : (
          <p className="text-base text-[var(--muted)] mb-4">Nothing logged this week yet — once you do, this fills in with a breakdown by category.</p>
        )}
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {byCat.map(([cat]) => (
            <span key={cat} className="text-sm text-[var(--muted)] flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: CAT_COLORS[cat] || 'var(--muted)' }} />{cat}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 px-1 shrink-0">
        <p className="text-xs text-[var(--muted)] whitespace-nowrap">{now.toLocaleDateString('en-IN', { month: 'long' })} so far: {fmt(monthSpent)}</p>
        <div className="flex items-end gap-1 h-4 flex-1 max-w-[140px]">
          {weeklyTrend.map((w, i) => (
            <div key={i} className="flex-1 rounded-sm" style={{ height: `${Math.max(15, (w / (Math.max(...weeklyTrend, 1))) * 100)}%`, background: 'color-mix(in srgb, var(--muted), transparent 40%)' }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Patterns({ allTransactions, monthlyPot }: { allTransactions: Transaction[]; monthlyPot: number | null }) {
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

  const topDriver = useMemo(() => {
    const byCat = new Map<string, number>();
    monthTxns.forEach((t) => byCat.set(t.category, (byCat.get(t.category) || 0) + t.amount));
    const sorted = Array.from(byCat.entries()).sort((a, b) => b[1] - a[1]);
    return sorted[0];
  }, [monthTxns]);

  const weekTxns = allTransactions.filter((t) => inWeek(t, weekRange(0)));
  const byTag = useMemo(() => {
    const map = new Map<string, number>();
    weekTxns.forEach((t) => { if (t.tag) map.set(t.tag, (map.get(t.tag) || 0) + t.amount); });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [weekTxns]);

  const weekdaySpend = weekTxns.filter((t) => { const d = new Date(t.date + 'T12:00:00').getDay(); return d >= 1 && d <= 5; }).reduce((s, t) => s + t.amount, 0);
  const weekendSpend = weekTxns.filter((t) => { const d = new Date(t.date + 'T12:00:00').getDay(); return d === 0 || d === 6; }).reduce((s, t) => s + t.amount, 0);
  const maxWk = Math.max(weekdaySpend, weekendSpend, 1);

  return (
    <div>
      {monthlyPot ? (
        <div className="bg-[var(--bg)]/40 rounded-xl p-5 mb-3">
          <div className="flex items-center gap-2.5 mb-2.5">
            <IconGauge size={20} className="text-[var(--accent)]" />
            <span className="text-base font-semibold text-[var(--text)]">Monthly pot burn-down</span>
          </div>
          <div className="h-3 bg-[var(--surface)] rounded-full overflow-hidden mb-2.5">
            <div className="h-full" style={{ width: `${potPct}%`, background: (potPct || 0) > 100 ? 'var(--danger)' : 'var(--accent)' }} />
          </div>
          {projected > (monthlyPot || 0) && topDriver && (
            <div className="rounded-lg p-3" style={{ background: 'color-mix(in srgb, var(--danger), transparent 88%)' }}>
              <p className="text-sm" style={{ color: 'var(--text)' }}>
                At this pace you&apos;ll finish {fmt(projected - monthlyPot)} over — <strong>{topDriver[0]}</strong> alone is {fmt(topDriver[1])}, {Math.round((topDriver[1] / monthSpent) * 100)}% of this month&apos;s spend.
              </p>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-[var(--muted)] mb-3">Set a monthly pot in settings to see burn-down and projections.</p>
      )}

      <div className="grid grid-cols-2 gap-3.5">
        <div className="bg-[var(--bg)]/40 rounded-xl p-4">
          <p className="text-sm font-semibold text-[var(--text)] mb-2">Spend by emotion, this week</p>
          {byTag.length === 0 && <p className="text-[14px] text-[var(--muted)]">No tagged transactions yet.</p>}
          <div className="flex flex-col gap-2.5">
            {byTag.map(([tag, amt]) => (
              <div key={tag}>
                <div className="flex justify-between text-[14px] mb-1"><span className="text-[var(--text)]">{tag}</span><span className="text-[var(--muted)]">{fmt(amt)}</span></div>
                <div className="h-1.5 bg-[var(--surface)] rounded-full overflow-hidden"><div className="h-full bg-[var(--accent)]" style={{ width: `${(amt / byTag[0][1]) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-[var(--bg)]/40 rounded-xl p-4">
          <p className="text-sm font-semibold text-[var(--text)] mb-2">Weekday vs weekend</p>
          <div className="flex gap-2.5 items-end h-12">
            <div className="flex-1 rounded-t" style={{ height: `${(weekdaySpend / maxWk) * 100}%`, background: 'var(--positive)' }} />
            <div className="flex-1 rounded-t" style={{ height: `${(weekendSpend / maxWk) * 100}%`, background: 'var(--accent)' }} />
          </div>
          <div className="flex justify-between text-[12px] text-[var(--muted)] mt-1"><span>Weekday</span><span>Weekend</span></div>
        </div>
      </div>
    </div>
  );
}

function Trends({ allTransactions }: { allTransactions: Transaction[] }) {
  const heatmap = useMemo(() => {
    const totals = [0, 0, 0, 0, 0, 0, 0]; // Sun..Sat
    const now = new Date();
    const eightWeeksAgo = new Date(now); eightWeeksAgo.setDate(now.getDate() - 56);
    allTransactions.filter((t) => t.type === 'expense' && new Date(t.date + 'T12:00:00') >= eightWeeksAgo).forEach((t) => {
      totals[new Date(t.date + 'T12:00:00').getDay()] += t.amount;
    });
    const max = Math.max(...totals, 1);
    const order = [6, 0, 1, 2, 3, 4, 5]; // Sat..Fri
    const labels = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    return order.map((d, i) => ({ label: labels[i], intensity: totals[d] / max }));
  }, [allTransactions]);

  const drift = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
    const fourWeeksAgo = new Date(now); fourWeeksAgo.setDate(now.getDate() - 28);

    const thisWeek = new Map<string, number>();
    const trailing4wk = new Map<string, number>();
    allTransactions.filter((t) => t.type === 'expense').forEach((t) => {
      const d = new Date(t.date + 'T12:00:00');
      if (d >= weekAgo) thisWeek.set(t.category, (thisWeek.get(t.category) || 0) + t.amount);
      if (d >= fourWeeksAgo && d < weekAgo) trailing4wk.set(t.category, (trailing4wk.get(t.category) || 0) + t.amount);
    });

    const cats = new Set([...thisWeek.keys(), ...trailing4wk.keys()]);
    const rows = Array.from(cats).map((cat) => {
      const current = thisWeek.get(cat) || 0;
      const avg = (trailing4wk.get(cat) || 0) / 3;
      const pct = avg > 0 ? ((current - avg) / avg) * 100 : 0;
      return { cat, current, pct };
    }).filter((r) => r.current > 0);
    return rows.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)).slice(0, 2);
  }, [allTransactions]);

  return (
    <div>
      <div className="bg-[var(--bg)]/40 rounded-xl p-5 mb-3">
        <p className="text-sm font-semibold text-[var(--text)] mb-3">Day-of-week heatmap, last 8 weeks</p>
        <div className="flex gap-2">
          {heatmap.map((d) => (
            <div key={d.label} className="flex-1 text-center">
              <div className="h-9 rounded-lg" style={{ background: `color-mix(in srgb, var(--accent), transparent ${100 - d.intensity * 100}%)` }} />
              <p className="text-[11px] text-[var(--muted)] mt-1">{d.label}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3.5">
        {drift.map((r) => (
          <div key={r.cat} className="bg-[var(--bg)]/40 rounded-xl p-3.5">
            <p className="text-[12px] text-[var(--muted)] mb-1">{r.cat}, 4-wk avg</p>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-[var(--text)]">{fmt(r.current)}</span>
              <span className="text-[12px]" style={{ color: r.pct >= 0 ? 'var(--danger)' : 'var(--positive)' }}>{r.pct >= 0 ? '▲' : '▼'} {Math.abs(Math.round(r.pct))}%</span>
            </div>
          </div>
        ))}
        {drift.length === 0 && <p className="text-sm text-[var(--muted)]">Not enough history yet to show drift.</p>}
      </div>
    </div>
  );
}

function SelfKnowledge({ allTransactions, intentions, onSetIntention }: { allTransactions: Transaction[]; intentions: Intention[]; onSetIntention: (n: number) => void }) {
  const [input, setInput] = useState('');
  const history = useMemo(() => computeSelfKnowledgeHistory(intentions, allTransactions), [intentions, allTransactions]);
  const bias = useMemo(() => computeBias(history), [history]);
  const latest = history[history.length - 1];

  const streak = useMemo(() => {
    let count = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].score >= 70) count++; else break;
    }
    return count;
  }, [history]);

  if (!latest) {
    return (
      <div>
        <p className="text-sm text-[var(--muted)] mb-3">Set a spend intention for this month to start building your self-knowledge score. It&apos;ll show up here once the month closes.</p>
        <div className="bg-[var(--bg)]/40 rounded-xl p-4 max-w-xs">
          <label className="text-[14px] text-[var(--muted)] block mb-1.5">This month&apos;s spend intention</label>
          <div className="flex gap-2.5">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="₹35,000" className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-sm text-[var(--text)]" />
            <button onClick={() => { const n = parseFloat(input); if (n > 0) { onSetIntention(n); setInput(''); } }} className="bg-[var(--accent)] text-[var(--bg)] text-[14px] font-medium px-3 rounded-lg">Set</button>
          </div>
        </div>
      </div>
    );
  }

  const maxScore = Math.max(...history.map((h) => h.score), 1);

  return (
    <div>
      <div className="flex flex-col items-center mb-4">
        <div className="w-28 h-28 rounded-full flex items-center justify-center mb-2" style={{ background: `conic-gradient(var(--accent) 0deg, var(--accent) ${latest.score * 3.6}deg, color-mix(in srgb, var(--bg), transparent 50%) ${latest.score * 3.6}deg)` }}>
          <div className="w-20 h-20 rounded-full flex flex-col items-center justify-center bg-[var(--surface)]">
            <span className="text-3xl font-bold text-[var(--text)]">{latest.score}</span>
            <span className="text-[12px] text-[var(--muted)]">{scoreLabel(latest.score)}</span>
          </div>
        </div>
        {streak >= 2 && (
          <div className="flex items-center gap-2 bg-[var(--accent)]/10 rounded-full px-3 py-1">
            <IconFlame size={16} className="text-[var(--accent)]" />
            <span className="text-[14px] font-semibold text-[var(--text)]">{streak} months above 70 in a row</span>
          </div>
        )}
      </div>

      {history.length > 1 && (
        <div className="bg-[var(--bg)]/40 rounded-xl p-4 mb-3">
          <p className="text-sm font-semibold text-[var(--text)] mb-2">Score history</p>
          <div className="flex items-end gap-2.5 h-11">
            {history.map((h) => (
              <div key={h.monthKey} className="flex-1 rounded-t" style={{ height: `${(h.score / maxScore) * 100}%`, background: h.monthKey === latest.monthKey ? 'var(--accent)' : 'var(--positive)' }} />
            ))}
          </div>
          <div className="flex gap-2.5 mt-1">
            {history.map((h) => <span key={h.monthKey} className="flex-1 text-center text-[11px] text-[var(--muted)]">{h.label}</span>)}
          </div>
        </div>
      )}

      {bias && bias.direction !== 'neutral' && (
        <div className="bg-[var(--bg)]/40 rounded-xl p-4 mb-3">
          <p className="text-sm font-semibold text-[var(--text)] mb-1">Your pattern</p>
          <p className="text-sm text-[var(--text)]">You tend to {bias.direction === 'under' ? 'underestimate' : 'overestimate'} by about {Math.round(Math.abs(bias.avgSignedErrorPct) * 100)}% on average.</p>
        </div>
      )}

      <div className="max-w-xs">
        <label className="text-[14px] text-[var(--muted)] block mb-1.5">This month&apos;s spend intention</label>
        <div className="flex gap-2.5">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="₹35,000" className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-sm text-[var(--text)]" />
          <button onClick={() => { const n = parseFloat(input); if (n > 0) { onSetIntention(n); setInput(''); } }} className="bg-[var(--accent)] text-[var(--bg)] text-[14px] font-medium px-3 rounded-lg">Set</button>
        </div>
      </div>
    </div>
  );
}

function Subscriptions({ subs }: { subs: any[] }) {
  const total = subs.reduce((s, x) => s + (x.amount || 0), 0);
  return (
    <div>
      {subs.length === 0 && <p className="text-sm text-[var(--muted)]">No flagged subscriptions yet. Automatic detection needs Gmail connected — for now, flag one manually from settings.</p>}
      <div className="flex flex-col gap-2.5">
        {subs.map((s) => (
          <div key={s.id} className="flex justify-between items-center bg-[var(--bg)]/40 rounded-lg px-3 py-2">
            <div><p className="text-sm text-[var(--text)]">{s.merchant}</p><p className="text-[12px] text-[var(--muted)]">Flagged {new Date(s.flagged_at).toLocaleDateString('en-IN')}</p></div>
            <span className="text-[12px] text-[var(--accent)]">{s.amount ? fmt(s.amount) : ''}</span>
          </div>
        ))}
      </div>
      {subs.length > 0 && <p className="text-[14px] text-[var(--muted)] mt-3">Total recurring: {fmt(total)}/mo</p>}
    </div>
  );
}

function Reflect({ reflections, onAdd }: { reflections: any[]; onAdd: (r: { good: string; regret: string; wish: string }) => void }) {
  const [good, setGood] = useState(''); const [regret, setRegret] = useState(''); const [wish, setWish] = useState('');
  function submit() { if (!good && !regret && !wish) return; onAdd({ good, regret, wish }); setGood(''); setRegret(''); setWish(''); }
  return (
    <div>
      <p className="text-[14px] text-[var(--muted)] mb-2">This week</p>
      <textarea value={good} onChange={(e) => setGood(e.target.value)} placeholder="Felt genuinely good…" className="w-full bg-[var(--bg)]/40 border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-sm text-[var(--text)] mb-2" rows={2} />
      <textarea value={regret} onChange={(e) => setRegret(e.target.value)} placeholder="Wish I hadn't…" className="w-full bg-[var(--bg)]/40 border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-sm text-[var(--text)] mb-2" rows={2} />
      <textarea value={wish} onChange={(e) => setWish(e.target.value)} placeholder="Would have liked to spend on…" className="w-full bg-[var(--bg)]/40 border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-sm text-[var(--text)] mb-3" rows={2} />
      <button onClick={submit} className="bg-[var(--accent)] text-[var(--bg)] rounded-lg px-4 py-1.5 text-sm font-medium mb-4">Save this week&apos;s reflection</button>
      <div className="flex flex-col gap-2.5">
        {reflections.map((r) => (
          <div key={r.id} className="bg-[var(--bg)]/40 border border-[var(--border)]/40 rounded-lg p-3">
            <p className="text-[12px] text-[var(--muted)] mb-1.5">{new Date(r.created_at).toLocaleDateString('en-IN')}</p>
            {r.good && <p className="text-sm text-[var(--text)] mb-1"><span className="text-[var(--positive)]">Good: </span>{r.good}</p>}
            {r.regret && <p className="text-sm text-[var(--text)] mb-1"><span className="text-[var(--danger)]">Regret: </span>{r.regret}</p>}
            {r.wish && <p className="text-sm text-[var(--text)]"><span className="text-[var(--accent)]">Wish: </span>{r.wish}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function DigestFeed({ digests }: { digests: Digest[] }) {
  const sorted = [...digests].sort((a, b) => b.period_end.localeCompare(a.period_end));
  if (sorted.length === 0) return <p className="text-sm text-[var(--muted)]">Your first digest appears after the next Friday or Sunday 6pm passes.</p>;
  return (
    <div className="flex flex-col gap-3">
      {sorted.map((d) => (
        <div key={d.id} className="bg-[var(--bg)]/40 rounded-xl p-4" style={{ borderLeft: `3px solid ${d.kind === 'friday' ? 'var(--positive)' : 'var(--accent)'}` }}>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-[var(--text)] flex items-center gap-2">
              {d.kind === 'friday' ? <IconSunrise size={18} style={{ color: 'var(--positive)' }} /> : <IconNotebook size={18} className="text-[var(--accent)]" />}
              {d.kind === 'friday' ? 'Friday digest' : 'Sunday wrap'}
            </span>
            <span className="text-[12px] text-[var(--muted)]">{new Date(d.period_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
          </div>
          <p className="text-sm text-[var(--text)] mb-2">{d.insight}</p>
          {d.top_categories.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {d.top_categories.map((c) => (
                <div key={c.category} className="flex justify-between text-[14px] text-[var(--muted)]"><span>{c.category}</span><span>{fmt(c.amount)}</span></div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Goals({ goals, contributions, onAddGoal, onLogContribution }: {
  goals: Goal[]; contributions: GoalContribution[];
  onAddGoal: (g: { name: string; target_amount: number; target_date: string | null }) => void;
  onLogContribution: (goalId: string, amount: number) => void;
}) {
  const [tab, setTab] = useState<'active' | 'achieved'>('active');
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState(''); const [amount, setAmount] = useState(''); const [date, setDate] = useState('');
  const [contribInputs, setContribInputs] = useState<Record<string, string>>({});

  const active = goals.filter((g) => !g.achieved_at);
  const achieved = goals.filter((g) => g.achieved_at);
  const list = tab === 'active' ? active : achieved;

  const contribsByGoal = (goalId: string) => contributions.filter((c) => c.goal_id === goalId);

  return (
    <div>
      <div className="bg-[var(--bg)]/40 rounded-xl p-4 mb-3">
        <GoalMountain progressPct={active.length ? Math.min(100, active.reduce((s, g) => {
          const saved = contribsByGoal(g.id).reduce((a, c) => a + c.amount, 0);
          return s + Math.min(100, (saved / g.target_amount) * 100);
        }, 0) / active.length) : 0} />
        <p className="text-[14px] text-[var(--muted)] mt-1">{active.length} goal{active.length === 1 ? '' : 's'} in progress · {achieved.length} achieved</p>
      </div>

      <SegmentedTabs tabs={[['active', 'Active'], ['achieved', 'Achieved']]} active={tab} onChange={(k) => setTab(k as 'active' | 'achieved')} />

      <div className="flex flex-col gap-3 mt-3">
        {list.length === 0 && <p className="text-sm text-[var(--muted)]">{tab === 'active' ? 'No active goals — add one below.' : 'Nothing achieved yet.'}</p>}

        {tab === 'active' && list.map((g) => {
          const goalContribs = contribsByGoal(g.id);
          const pace = computeGoalPace(g, goalContribs);
          return (
            <div key={g.id} className="bg-[var(--bg)]/40 rounded-xl p-4">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-base font-semibold text-[var(--text)] flex items-center gap-2"><IconFlag size={18} className="text-[var(--accent)]" />{g.name}</span>
                <span className="text-[12px] text-[var(--muted)]">{g.target_date ? `by ${new Date(g.target_date + 'T12:00:00').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}` : 'no fixed date'}</span>
              </div>
              <GoalMountain progressPct={pace.progressPct} />
              <div className="flex justify-between text-[14px] text-[var(--muted)] mt-1 mb-2">
                <span>{fmt(pace.savedSoFar)} of {fmt(g.target_amount)}</span>
                <span>{pace.progressPct}% to the summit</span>
              </div>
              {pace.message && (
                <div className="rounded-lg p-2.5 mb-2" style={{ background: pace.status === 'behind' ? 'color-mix(in srgb, var(--danger), transparent 88%)' : 'color-mix(in srgb, var(--accent), transparent 90%)' }}>
                  <p className="text-[14px]" style={{ color: 'var(--text)' }}>{pace.message}</p>
                </div>
              )}
              <div className="flex gap-2.5 items-center bg-[var(--accent)]/8 rounded-lg px-2.5 py-1.5">
                <IconPlus size={16} className="text-[var(--accent)] shrink-0" />
                <input
                  value={contribInputs[g.id] || ''}
                  onChange={(e) => setContribInputs((prev) => ({ ...prev, [g.id]: e.target.value }))}
                  placeholder={pace.requiredWeeklyPace ? `Add ₹${Math.round(pace.requiredWeeklyPace).toLocaleString('en-IN')} this week` : 'Add an amount'}
                  className="flex-1 bg-transparent border-none text-[14px] text-[var(--text)] outline-none"
                />
                <button
                  onClick={() => { const n = parseFloat(contribInputs[g.id] || ''); if (n > 0) { onLogContribution(g.id, n); setContribInputs((prev) => ({ ...prev, [g.id]: '' })); } }}
                  className="bg-[var(--accent)] text-[var(--bg)] text-[12px] font-medium px-2.5 py-1 rounded-md shrink-0"
                >
                  Log it
                </button>
              </div>
            </div>
          );
        })}

        {tab === 'achieved' && list.map((g) => (
          <div key={g.id} className="rounded-xl p-4 flex items-center gap-3.5" style={{ background: 'color-mix(in srgb, var(--positive), transparent 75%)' }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--positive)' }}>
              <IconTrophy size={21} style={{ color: 'var(--bg)' }} />
            </div>
            <div>
              <p className="text-base font-semibold text-[var(--text)]">{g.name}</p>
              <p className="text-[14px] text-[var(--muted)]">{fmt(g.target_amount)} · achieved {new Date(g.achieved_at!).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            </div>
          </div>
        ))}
      </div>

      {tab === 'active' && (
        showAdd ? (
          <div className="bg-[var(--bg)]/40 rounded-xl p-4 mt-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="What are you saving for?" className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-sm text-[var(--text)] mb-2" />
            <div className="flex gap-2.5 mb-2">
              <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Target amount" type="number" className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-sm text-[var(--text)]" />
              <input value={date} onChange={(e) => setDate(e.target.value)} type="date" className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-sm text-[var(--text)]" />
            </div>
            <div className="flex gap-2.5">
              <button
                onClick={() => {
                  const n = parseFloat(amount);
                  if (!name.trim() || !n) return;
                  onAddGoal({ name: name.trim(), target_amount: n, target_date: date || null });
                  setName(''); setAmount(''); setDate(''); setShowAdd(false);
                }}
                className="flex-1 bg-[var(--accent)] text-[var(--bg)] rounded-lg py-1.5 text-sm font-medium"
              >
                Add goal
              </button>
              <button onClick={() => setShowAdd(false)} className="border border-[var(--border)]/70 text-[var(--muted)] rounded-lg px-3 text-sm">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowAdd(true)} className="w-full flex items-center justify-center gap-2 border border-dashed border-[var(--accent)]/40 rounded-xl py-2.5 text-sm font-medium text-[var(--accent)] mt-3">
            <IconPlus size={17} />Add a goal
          </button>
        )
      )}
    </div>
  );
}
