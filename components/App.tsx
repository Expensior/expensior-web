'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { IconSettings, IconPencil, IconMenu2, IconChevronLeft } from '@tabler/icons-react';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_CATEGORIES } from '@/lib/categories';
import { DEFAULT_THEME } from '@/lib/themes';
import { computeFridayDigest, computeSundayDigest, mostRecentPastWeekday } from '@/lib/digest';
import type { Intention } from '@/lib/selfKnowledge';
import type { NewTransaction, Transaction, RecurringTemplate, Goal, GoalContribution, Digest, Category } from '@/lib/types';
import EditTransactionModal from './EntryZone';
import EntryFab from './EntryFab';
import Ledger, { emptyFilter, type LedgerFilter } from './Ledger';
import Dashboard from './Dashboard';
import SettingsDrawer from './SettingsDrawer';
import MfaChallenge from './MfaChallenge';

async function generateMissingDigests(userId: string, existing: Digest[], transactions: Transaction[], enabled: { friday: boolean; sunday: boolean }) {
  const supabase = createClient();
  const now = new Date();
  const fridayCutoff = mostRecentPastWeekday(now, 5, 18);
  const sundayCutoff = mostRecentPastWeekday(now, 0, 18);

  // Compare actual instants, not raw strings -- Postgres's returned
  // timestamptz format doesn't necessarily match JS's .toISOString() byte
  // for byte (different millisecond precision, +00:00 vs Z), so a string
  // comparison can read as "different" for the exact same moment. Verified
  // this concretely: every realistic Postgres round-trip format failed a
  // string match while still being the same instant numerically. That
  // false mismatch was silently causing duplicate insert attempts, which
  // then hit the table's own unique(user_id, kind, period_end) constraint
  // and failed -- silently, since the insert error below was never checked.
  const hasFriday = existing.some((d) => d.kind === 'friday' && new Date(d.period_end).getTime() === fridayCutoff.getTime());
  const hasSunday = existing.some((d) => d.kind === 'sunday' && new Date(d.period_end).getTime() === sundayCutoff.getTime());

  const toInsert: any[] = [];
  if (!hasFriday && enabled.friday) {
    const content = computeFridayDigest(transactions, fridayCutoff);
    toInsert.push({ user_id: userId, kind: 'friday', period_end: fridayCutoff.toISOString(), spent: content.spent, indulgence_pct: content.indulgence_pct, top_categories: content.top_categories, insight: content.insight });
  }
  if (!hasSunday && enabled.sunday) {
    const content = computeSundayDigest(transactions, sundayCutoff);
    toInsert.push({ user_id: userId, kind: 'sunday', period_end: sundayCutoff.toISOString(), spent: content.spent, indulgence_pct: content.indulgence_pct, top_categories: content.top_categories, insight: content.insight });
  }

  if (toInsert.length === 0) return [];
  const { data, error } = await supabase.from('digests').insert(toInsert).select();
  if (error) {
    // Previously silent -- a failed insert (e.g. hitting the unique
    // constraint on a false-mismatch retry, or any other DB-side issue)
    // produced no error, no log, nothing. Now at least visible for
    // diagnosis, even though a background digest generation failure isn't
    // worth interrupting the user with a full error screen for.
    console.error('Digest insert failed:', error);
    return [];
  }
  return (data || []) as Digest[];
}

export default function App() {
  const supabase = createClient();

  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const knownMerchants = useMemo(() => {
    const counts = new Map<string, number>();
    transactions.forEach((t) => {
      const name = t.description.trim();
      if (!name) return;
      // Merchant names can appear with different casing/whitespace across
      // sources (manual entry, Gmail, SMS) -- count by a normalized key but
      // recover the actual casing from a real transaction for display,
      // rather than showing the lowercased key itself.
      counts.set(name.toLowerCase(), (counts.get(name.toLowerCase()) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1]) // most-used first
      .map(([key]) => transactions.find((t) => t.description.trim().toLowerCase() === key)?.description.trim() || key);
  }, [transactions]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [categoryRecords, setCategoryRecords] = useState<Category[]>([]);
  const [monthlyPot, setMonthlyPot] = useState<number | null>(null);
  const [theme, setTheme] = useState<string>(DEFAULT_THEME);
  const [textSize, setTextSize] = useState<'compact' | 'default' | 'large'>('default');
  const [handwrittenFont, setHandwrittenFont] = useState<'none' | 'caveat' | 'architects-daughter' | 'patrick-hand'>('none');
  const [apiKey, setApiKey] = useState('');
  const [reflections, setReflections] = useState<any[]>([]);
  const [flaggedSubs, setFlaggedSubs] = useState<any[]>([]);
  const [insightCards, setInsightCards] = useState<{ title: string; body: string }[] | null>(null);
  const [insightsGeneratedAt, setInsightsGeneratedAt] = useState<string | null>(null);
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const [insightsError, setInsightsError] = useState('');
  const [recurringTemplates, setRecurringTemplates] = useState<RecurringTemplate[]>([]);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailNotice, setGmailNotice] = useState('');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalContributions, setGoalContributions] = useState<GoalContribution[]>([]);
  const [digests, setDigests] = useState<Digest[]>([]);
  const [intentions, setIntentions] = useState<Intention[]>([]);
  const [lastVisitedAt, setLastVisitedAt] = useState<string | null>(null);
  const [fridayDigestEnabled, setFridayDigestEnabled] = useState(true);
  const [sundayWrapEnabled, setSundayWrapEnabled] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [filter, setFilter] = useState<LedgerFilter>(emptyFilter());
  const [search, setSearch] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mfaNeedsVerification, setMfaNeedsVerification] = useState(false);
  const autoRetriedAuthError = useRef(false);

  const load = useCallback(async () => {
    let willSilentlyRetry = false;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Enforce MFA here: enrolling a factor alone doesn't block anything by
      // itself. currentLevel !== nextLevel means the user has a verified
      // factor but this session hasn't passed the challenge yet.
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal && aal.currentLevel !== aal.nextLevel) {
        setMfaNeedsVerification(true);
        setLoading(false);
        return;
      }

      setDisplayName((user.email || '').split('@')[0]);

      const [txnsRes, catsRes, settingsRes, reflRes, subsRes, recRes, goalsRes, contribRes, digestRes, intentRes] = await Promise.all([
        supabase.from('transactions').select('*').order('date', { ascending: false }),
        supabase.from('categories').select('*').order('sort_order'),
        supabase.from('settings').select('monthly_pot, theme, claude_api_key, last_visited_at, display_name, friday_digest_enabled, sunday_wrap_enabled, text_size, handwritten_font').eq('user_id', user.id).maybeSingle(),
        supabase.from('reflections').select('*').order('created_at', { ascending: false }),
        supabase.from('flagged_subscriptions').select('*').eq('cancelled', false).order('flagged_at', { ascending: false }),
        supabase.from('recurring_templates').select('*').order('sort_order'),
        supabase.from('goals').select('*').order('created_at'),
        supabase.from('goal_contributions').select('*').order('date'),
        supabase.from('digests').select('*').order('period_end', { ascending: false }),
        supabase.from('intentions').select('month_key, amount').order('month_key'),
      ]);

      const firstError = txnsRes.error || catsRes.error || settingsRes.error || reflRes.error || subsRes.error || recRes.error || goalsRes.error || contribRes.error || digestRes.error || intentRes.error;
      if (firstError) throw firstError;

      // Queried separately (not in the batch above, not throwing on error):
      // this is a newer table, and a user who hasn't run the migration yet
      // shouldn't have their ENTIRE app fail to load over an optional feature.
      try {
        const { data: insightsRow } = await supabase.from('insights').select('cards, generated_at').eq('user_id', user.id).maybeSingle();
        if (insightsRow) {
          setInsightCards(insightsRow.cards);
          setInsightsGeneratedAt(insightsRow.generated_at);
        }
      } catch {
        // Table doesn't exist yet or some other non-critical issue — insights just won't show until migrated.
      }

      if (txnsRes.data) setTransactions(txnsRes.data as Transaction[]);

      if (catsRes.data && catsRes.data.length > 0) {
        const sorted = [...catsRes.data].sort((a, b) => a.sort_order - b.sort_order) as Category[];
        setCategoryRecords(sorted);
        setCategories(sorted.map((c) => c.name));
      } else {
        const rows = DEFAULT_CATEGORIES.map((name, i) => ({ user_id: user.id, name, sort_order: i }));
        const { data: seeded, error: seedError } = await supabase.from('categories').insert(rows).select();
        if (seedError) throw seedError;
        if (seeded) setCategoryRecords(seeded as Category[]);
        setCategories(DEFAULT_CATEGORIES);
      }

      if (settingsRes.data) {
        setMonthlyPot(settingsRes.data.monthly_pot);
        setTheme(settingsRes.data.theme || DEFAULT_THEME);
        setApiKey(settingsRes.data.claude_api_key || '');
        setLastVisitedAt(settingsRes.data.last_visited_at || null);
        if (settingsRes.data.display_name) setDisplayName(settingsRes.data.display_name);
        setFridayDigestEnabled(settingsRes.data.friday_digest_enabled ?? true);
        setTextSize(settingsRes.data.text_size || 'default');
        setHandwrittenFont(settingsRes.data.handwritten_font || 'none');
        setSundayWrapEnabled(settingsRes.data.sunday_wrap_enabled ?? true);
      }
      if (reflRes.data) setReflections(reflRes.data);
      if (subsRes.data) setFlaggedSubs(subsRes.data);
      if (recRes.data) setRecurringTemplates(recRes.data as RecurringTemplate[]);
      if (goalsRes.data) setGoals(goalsRes.data as Goal[]);
      if (contribRes.data) setGoalContributions(contribRes.data as GoalContribution[]);
      if (intentRes.data) setIntentions(intentRes.data as Intention[]);

      // Record this visit for next time's "since you were last here" summary —
      // done after reading the old value above, not before.
      await supabase.from('settings').upsert({ user_id: user.id, last_visited_at: new Date().toISOString() });

      // Generate any missing Friday/Sunday digests, bounded to their correct
      // past cutoff (not "now"), then merge with whatever's already stored.
      const existingDigests = (digestRes.data || []) as Digest[];
      const newDigests = await generateMissingDigests(user.id, existingDigests, (txnsRes.data || []) as Transaction[], {
        friday: settingsRes.data?.friday_digest_enabled ?? true,
        sunday: settingsRes.data?.sunday_wrap_enabled ?? true,
      });
      setDigests([...newDigests, ...existingDigests]);

      try {
        const gmailRes = await fetch('/api/gmail-status');
        const gmailData = await gmailRes.json();
        setGmailConnected(!!gmailData.connected);
      } catch {
        // Non-fatal — Gmail tile just shows as locked if this fails.
      }
    } catch (err: any) {
      console.error('Failed to load Expensior data:', err);
      const message = err?.message || 'Something went wrong loading your data.';
      const looksLikeAuthError = /jwt|token|session|expired/i.test(message);
      // A plain page refresh has been observed to silently fix this exact
      // error -- almost certainly a tab-woke-from-background race where the
      // first API call fires before the client's own token refresh
      // completes. Replicating that recovery automatically, once, means
      // most people never see this screen at all rather than needing to
      // notice the error and manually reload. Capped at one attempt via
      // the ref so a genuinely broken session doesn't loop forever.
      if (looksLikeAuthError && !autoRetriedAuthError.current) {
        autoRetriedAuthError.current = true;
        willSilentlyRetry = true;
        await supabase.auth.refreshSession();
        load();
        return;
      }
      setLoadError(message);
    } finally {
      if (!willSilentlyRetry) setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gmail = params.get('gmail');
    if (gmail) {
      if (gmail === 'connected') setGmailNotice('Gmail connected — open the Gmail tile to scan your inbox.');
      else if (gmail === 'no_refresh_token') setGmailNotice('Google didn\'t grant offline access — try connecting again.');
      else setGmailNotice('Something went wrong connecting Gmail. Try again.');
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => setGmailNotice(''), 6000);
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-text-size', textSize);
  }, [textSize]);

  useEffect(() => {
    document.documentElement.setAttribute('data-handwritten', handwrittenFont);
  }, [handwrittenFont]);

  async function saveTextSize(size: 'compact' | 'default' | 'large') {
    setTextSize(size);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('settings').upsert({ user_id: user.id, text_size: size });
  }

  async function saveHandwrittenFont(font: 'none' | 'caveat' | 'architects-daughter' | 'patrick-hand') {
    setHandwrittenFont(font);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('settings').upsert({ user_id: user.id, handwritten_font: font });
  }

  async function saveTheme(id: string) {
    setTheme(id);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('settings').upsert({ user_id: user.id, theme: id });
  }

  async function saveDisplayName(name: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    await supabase.from('settings').upsert({ user_id: user.id, display_name: trimmed });
    setDisplayName(trimmed);
  }

  async function saveFridayDigestEnabled(enabled: boolean) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('settings').upsert({ user_id: user.id, friday_digest_enabled: enabled });
    setFridayDigestEnabled(enabled);
  }

  async function saveSundayWrapEnabled(enabled: boolean) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('settings').upsert({ user_id: user.id, sunday_wrap_enabled: enabled });
    setSundayWrapEnabled(enabled);
  }

  async function generateInsights() {
    setGeneratingInsights(true);
    setInsightsError('');
    try {
      const res = await fetch('/api/generate-insights', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setInsightsError(data.error || 'Could not generate insights.');
      } else {
        setInsightCards(data.cards);
        setInsightsGeneratedAt(new Date().toISOString());
      }
    } catch {
      setInsightsError('Something went wrong reaching the insights service.');
    }
    setGeneratingInsights(false);
  }

  async function sendFeedback(message: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !message.trim()) return;
    await supabase.from('feedback').insert({ user_id: user.id, message: message.trim() });
  }

  async function addFlaggedSubscription(merchant: string, amount: number): Promise<'added' | 'duplicate'> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !merchant.trim()) return 'added';
    // Dedup guard: this had none before, which is exactly how the same
    // merchant could get flagged twice (manual form + Gmail scan, or just
    // clicking Flag more than once) with no way to tell until it was
    // already duplicated in the list.
    const key = merchant.trim().toLowerCase();
    if (flaggedSubs.some((s) => s.merchant.trim().toLowerCase() === key)) {
      return 'duplicate';
    }
    const { data } = await supabase.from('flagged_subscriptions').insert({ user_id: user.id, merchant: merchant.trim(), amount: amount || null }).select().single();
    if (data) setFlaggedSubs((prev) => [data, ...prev]);
    return 'added';
  }

  async function removeFlaggedSubscription(id: string) {
    // Soft delete via the 'cancelled' column -- it already existed in the
    // schema and the load query already filters it out
    // (.eq('cancelled', false)), but nothing ever actually set it; there
    // was no remove action anywhere in the UI until now.
    await supabase.from('flagged_subscriptions').update({ cancelled: true }).eq('id', id);
    setFlaggedSubs((prev) => prev.filter((s) => s.id !== id));
  }

  async function addTransaction(t: NewTransaction) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('transactions').insert({ ...t, user_id: user.id }).select().single();
    if (data) setTransactions((prev) => [data as Transaction, ...prev]);
  }

  async function bulkAddTransactions(items: NewTransaction[]) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || items.length === 0) return;
    const rows = items.map((t) => ({ ...t, user_id: user.id }));
    const { data } = await supabase.from('transactions').insert(rows).select();
    if (data) setTransactions((prev) => [...(data as Transaction[]), ...prev]);
  }

  async function logRecurring(template: RecurringTemplate) {
    await addTransaction({
      amount: template.amount,
      description: template.name,
      category: template.category,
      type: 'expense',
      indulgence: template.indulgence,
      essential: template.essential,
      regret: false,
      tag: null,
      notes: null,
      date: new Date().toISOString().split('T')[0],
      repeats: 'none',
    });
  }

  async function addRecurringTemplate(t: Omit<RecurringTemplate, 'id' | 'sort_order'>) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('recurring_templates').insert({ ...t, user_id: user.id, sort_order: recurringTemplates.length }).select().single();
    if (data) setRecurringTemplates((prev) => [...prev, data as RecurringTemplate]);
  }

  async function deleteRecurringTemplate(id: string) {
    await supabase.from('recurring_templates').delete().eq('id', id);
    setRecurringTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  async function editRecurringTemplate(id: string, updates: { name: string; amount: number; cadence: 'monthly' | 'weekly' }) {
    await supabase.from('recurring_templates').update(updates).eq('id', id);
    setRecurringTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  }

  async function addGoal(g: { name: string; target_amount: number; target_date: string | null }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('goals').insert({ ...g, user_id: user.id }).select().single();
    if (data) setGoals((prev) => [...prev, data as Goal]);
  }

  async function logContribution(goalId: string, amount: number) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase.from('goal_contributions').insert({ user_id: user.id, goal_id: goalId, amount, date: today }).select().single();
    if (!data) return;
    const newContribution = data as GoalContribution;
    setGoalContributions((prev) => [...prev, newContribution]);

    // Auto-mark achieved the moment total contributions reach the target.
    const goal = goals.find((g) => g.id === goalId);
    if (goal && !goal.achieved_at) {
      const totalSaved = goalContributions.filter((c) => c.goal_id === goalId).reduce((s, c) => s + c.amount, 0) + amount;
      if (totalSaved >= goal.target_amount) {
        const achievedAt = new Date().toISOString();
        await supabase.from('goals').update({ achieved_at: achievedAt }).eq('id', goalId);
        setGoals((prev) => prev.map((g) => (g.id === goalId ? { ...g, achieved_at: achievedAt } : g)));
      }
    }
  }

  async function setIntention(amount: number) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
    await supabase.from('intentions').upsert({ user_id: user.id, month_key: monthKey, amount }, { onConflict: 'user_id,month_key' });
    setIntentions((prev) => {
      const withoutThisMonth = prev.filter((i) => i.month_key !== monthKey);
      return [...withoutThisMonth, { month_key: monthKey, amount }];
    });
  }

  async function updateTransaction(id: string, t: Partial<NewTransaction>) {
    const { data } = await supabase.from('transactions').update(t).eq('id', id).select().single();
    if (data) setTransactions((prev) => prev.map((x) => (x.id === id ? (data as Transaction) : x)));
  }

  async function deleteTransaction(id: string) {
    await supabase.from('transactions').delete().eq('id', id);
    setTransactions((prev) => prev.filter((x) => x.id !== id));
    if (editingTxn?.id === id) setEditingTxn(null);
  }

  async function addCategory(name: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || categories.includes(name)) return;
    const { data } = await supabase.from('categories').insert({ user_id: user.id, name, sort_order: categoryRecords.length }).select().single();
    if (data) {
      setCategoryRecords((prev) => [...prev, data as Category]);
      setCategories((prev) => [...prev, name]);
    }
  }

  async function deleteCategory(name: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('categories').delete().eq('user_id', user.id).eq('name', name);
    setCategoryRecords((prev) => prev.filter((c) => c.name !== name));
    setCategories((prev) => prev.filter((c) => c !== name));
  }

  async function renameCategory(id: string, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await supabase.from('categories').update({ name: trimmed }).eq('id', id);
    setCategoryRecords((prev) => prev.map((c) => (c.id === id ? { ...c, name: trimmed } : c)));
    setCategories((prev) => prev.map((c) => (categoryRecords.find((r) => r.id === id)?.name === c ? trimmed : c)));
  }

  async function reorderCategory(id: string, direction: 'up' | 'down') {
    const sorted = [...categoryRecords].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((c) => c.id === id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (idx === -1 || swapIdx < 0 || swapIdx >= sorted.length) return;

    const a = sorted[idx];
    const b = sorted[swapIdx];
    const [aOrder, bOrder] = [b.sort_order, a.sort_order];

    await Promise.all([
      supabase.from('categories').update({ sort_order: aOrder }).eq('id', a.id),
      supabase.from('categories').update({ sort_order: bOrder }).eq('id', b.id),
    ]);

    const updated = categoryRecords.map((c) => {
      if (c.id === a.id) return { ...c, sort_order: aOrder };
      if (c.id === b.id) return { ...c, sort_order: bOrder };
      return c;
    }).sort((x, y) => x.sort_order - y.sort_order);

    setCategoryRecords(updated);
    setCategories(updated.map((c) => c.name));
  }

  async function saveMonthlyPot(n: number) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('settings').upsert({ user_id: user.id, monthly_pot: n });
    setMonthlyPot(n);
  }

  async function saveApiKey(k: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('settings').upsert({ user_id: user.id, claude_api_key: k });
    setApiKey(k);
  }

  async function addReflection(r: { good: string; regret: string; wish: string }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('reflections').insert({ user_id: user.id, ...r }).select().single();
    if (data) setReflections((prev) => [data, ...prev]);
  }

  function exportCSV() {
    const headers = ['Date', 'Description', 'Amount', 'Type', 'Category', 'Indulgence', 'Tag', 'Notes'];
    const rows = transactions.map((t) => [t.date, `"${t.description}"`, t.amount, t.type, `"${t.category}"`, t.indulgence ? 'Yes' : 'No', t.tag || '', `"${t.notes || ''}"`]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'expensior-export.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  async function clearAllData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('transactions').delete().eq('user_id', user.id);
    setTransactions([]);
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  const monthTransactions = transactions.filter((t) => {
    const d = new Date(t.date + 'T12:00:00');
    return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear();
  });

  if (mfaNeedsVerification) {
    return <MfaChallenge onVerified={() => { setMfaNeedsVerification(false); setLoading(true); load(); }} />;
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-[var(--muted)] text-sc-16">Loading…</div>;
  }

  if (loadError) {
    const isAuthError = /jwt|token|session|expired/i.test(loadError);
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <p className="text-[var(--text)] text-sc-16 mb-2">Couldn&apos;t load your data</p>
          <p className="text-[var(--muted)] text-sc-14 mb-4">{loadError}</p>
          {isAuthError ? (
            <>
              <p className="text-[var(--muted)] text-sc-14 mb-4">Expensior already tried refreshing your session automatically and it didn&apos;t resolve on its own this time. One more manual retry sometimes still works.</p>
              <button
                onClick={async () => {
                  autoRetriedAuthError.current = false;
                  await supabase.auth.refreshSession();
                  setLoadError(null);
                  setLoading(true);
                  load();
                }}
                className="bg-[var(--accent)] text-[var(--bg)] rounded-lg px-4 py-2 text-sc-14 font-medium mb-2"
              >
                Retry
              </button>
              <p className="text-[var(--muted)] text-sc-13">
                <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login'; }} className="underline">
                  Still stuck? Sign out and sign in again
                </button>
              </p>
            </>
          ) : (
            <>
              <p className="text-[var(--muted)] text-sc-14 mb-4">This usually means the database tables haven&apos;t been created yet, or a newer migration hasn&apos;t been run — check <code>supabase/schema.sql</code>.</p>
              <button onClick={() => { setLoadError(null); setLoading(true); load(); }} className="bg-[var(--accent)] text-[var(--bg)] rounded-lg px-4 py-2 text-sc-14 font-medium">Try again</button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col p-3 md:p-5">
      <div className="flex justify-between items-center mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
          {editingName ? (
            <div className="flex items-center gap-2">
              <span className="text-sc-20 font-semibold text-[var(--text)] tracking-tight">Hello,</span>
              <input
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { saveDisplayName(nameInput); setEditingName(false); } if (e.key === 'Escape') setEditingName(false); }}
                className="text-sc-20 font-semibold text-[var(--text)] tracking-tight bg-[var(--surface)] border border-[var(--accent)] rounded-lg px-2 py-0.5 w-40"
              />
              <button onClick={() => { saveDisplayName(nameInput); setEditingName(false); }} className="text-sc-14 text-[var(--accent)] font-medium">Save</button>
              <button onClick={() => setEditingName(false)} className="text-sc-14 text-[var(--muted)]">Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => { setNameInput(displayName); setEditingName(true); }}
              className="flex items-center gap-1.5 group"
              title="Click to edit your name"
            >
              <h1 className="text-sc-20 font-semibold text-[var(--text)] tracking-tight">
                {displayName ? `Hello, ${displayName}` : 'Expensior!'}
              </h1>
              <IconPencil size={16} className="text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setLedgerOpen(true)} aria-label="Open ledger" className="text-[var(--muted)] hover:text-[var(--text)] transition-colors md:hidden"><IconMenu2 size={22} /></button>
          <button onClick={() => setSettingsOpen(true)} aria-label="Settings" className="text-[var(--muted)] hover:text-[var(--text)] transition-colors"><IconSettings size={18} /></button>
        </div>
      </div>

      {gmailNotice && (
        <div className="bg-[var(--surface)] border border-[var(--border)]/50 text-[var(--text)] text-sc-14 rounded-lg px-3 py-2 mb-4 shrink-0">
          {gmailNotice}
        </div>
      )}

      <div className="flex gap-4 flex-1 min-h-0 relative">
        <div className="min-h-0 w-full md:w-[70%]">
          <Dashboard
            allTransactions={transactions}
            monthlyPot={monthlyPot}
            reflections={reflections}
            onAddReflection={addReflection}
            flaggedSubs={flaggedSubs}
            onSelectCategory={(c) => { setFilter({ ...emptyFilter(), categories: new Set([c]) }); setLedgerOpen(true); }}
            goals={goals}
            goalContributions={goalContributions}
            onAddGoal={addGoal}
            onLogContribution={logContribution}
            digests={digests}
            intentions={intentions}
            onSetIntention={setIntention}
            lastVisitedAt={lastVisitedAt}
            gmailConnected={gmailConnected}
            onAddFlaggedSubscription={addFlaggedSubscription}
            onRemoveFlaggedSubscription={removeFlaggedSubscription}
            hasApiKey={!!apiKey}
            insightCards={insightCards}
            insightsGeneratedAt={insightsGeneratedAt}
            generatingInsights={generatingInsights}
            insightsError={insightsError}
            onGenerateInsights={generateInsights}
          />
        </div>

        {ledgerOpen && <div onClick={() => setLedgerOpen(false)} className="fixed inset-0 bg-black/50 z-20 md:hidden" />}

        <div
          className={`bg-[var(--surface)] border border-[var(--border)]/60 md:rounded-2xl p-4 shadow-lg shadow-black/20 min-h-0 flex flex-col fixed md:static inset-y-0 right-0 w-[90%] max-w-sm md:w-[30%] md:max-w-none z-30 md:z-auto transition-transform duration-300 overscroll-contain ${ledgerOpen ? 'translate-x-0' : 'translate-x-full'} md:translate-x-0`}
        >
          <button onClick={() => setLedgerOpen(false)} aria-label="Close ledger" className="md:hidden mb-2 shrink-0 flex items-center gap-1 text-[var(--muted)] hover:text-[var(--text)] transition-colors">
            <IconChevronLeft size={18} /><span className="text-sc-14">Back</span>
          </button>
          <div className="flex-1 min-h-0">
            <Ledger
              month={month}
              monthLabel={month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              onPrevMonth={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              onNextMonth={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              onJumpMonths={(delta) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1))}
              onToday={() => { const d = new Date(); d.setDate(1); setMonth(d); }}
            transactions={monthTransactions}
            allTransactions={transactions}
            monthlyPot={monthlyPot}
            categories={categories}
            filter={filter}
            setFilter={setFilter}
            search={search}
            setSearch={setSearch}
            selectedId={editingTxn?.id || null}
            onSelect={setEditingTxn}
            onDelete={deleteTransaction}
          />
          </div>
        </div>
      </div>

      <EntryFab
        categories={categories}
        recurringTemplates={recurringTemplates}
        hasApiKey={!!apiKey}
        gmailConnected={gmailConnected}
        ledgerOpen={ledgerOpen}
        knownMerchants={knownMerchants}
        onAdd={addTransaction}
        onBulkAdd={bulkAddTransactions}
        onLogRecurring={logRecurring}
      />

      {editingTxn && (
        <EditTransactionModal
          categories={categories}
          editingTxn={editingTxn}
          knownMerchants={knownMerchants}
          onCancelEdit={() => setEditingTxn(null)}
          onUpdate={updateTransaction}
          onDelete={deleteTransaction}
        />
      )}

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        categories={categories}
        categoryRecords={categoryRecords}
        onAddCategory={addCategory}
        onDeleteCategory={deleteCategory}
        onRenameCategory={renameCategory}
        onReorderCategory={reorderCategory}
        monthlyPot={monthlyPot}
        onSaveMonthlyPot={saveMonthlyPot}
        theme={theme}
        onSaveTheme={saveTheme}
        textSize={textSize}
        onSaveTextSize={saveTextSize}
        handwrittenFont={handwrittenFont}
        onSaveHandwrittenFont={saveHandwrittenFont}
        apiKey={apiKey}
        onSaveApiKey={saveApiKey}
        onExportCSV={exportCSV}
        onClearAllData={clearAllData}
        recurringTemplates={recurringTemplates}
        onAddRecurringTemplate={addRecurringTemplate}
        onDeleteRecurringTemplate={deleteRecurringTemplate}
        onEditRecurringTemplate={editRecurringTemplate}
        fridayDigestEnabled={fridayDigestEnabled}
        onSaveFridayDigestEnabled={saveFridayDigestEnabled}
        sundayWrapEnabled={sundayWrapEnabled}
        onSaveSundayWrapEnabled={saveSundayWrapEnabled}
        onSendFeedback={sendFeedback}
        gmailConnected={gmailConnected}
        onAddFlaggedSubscription={addFlaggedSubscription}
        onSignOut={signOut}
      />
    </div>
  );
}
