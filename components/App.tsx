'use client';

import { useEffect, useState, useCallback } from 'react';
import { IconSettings } from '@tabler/icons-react';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_CATEGORIES } from '@/lib/categories';
import type { NewTransaction, Transaction } from '@/lib/types';
import EntryZone from './EntryZone';
import Ledger, { emptyFilter, type LedgerFilter } from './Ledger';
import Dashboard from './Dashboard';
import SettingsDrawer from './SettingsDrawer';

export default function App() {
  const supabase = createClient();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [monthlyPot, setMonthlyPot] = useState<number | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [reflections, setReflections] = useState<any[]>([]);
  const [flaggedSubs, setFlaggedSubs] = useState<any[]>([]);

  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [filter, setFilter] = useState<LedgerFilter>(emptyFilter());
  const [search, setSearch] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [txnsRes, catsRes, settingsRes, reflRes, subsRes] = await Promise.all([
      supabase.from('transactions').select('*').order('date', { ascending: false }),
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('settings').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('reflections').select('*').order('created_at', { ascending: false }),
      supabase.from('flagged_subscriptions').select('*').eq('cancelled', false).order('flagged_at', { ascending: false }),
    ]);

    if (txnsRes.data) setTransactions(txnsRes.data as Transaction[]);

    if (catsRes.data && catsRes.data.length > 0) {
      setCategories(catsRes.data.map((c) => c.name));
    } else {
      // First login: seed default categories
      const rows = DEFAULT_CATEGORIES.map((name, i) => ({ user_id: user.id, name, sort_order: i }));
      await supabase.from('categories').insert(rows);
      setCategories(DEFAULT_CATEGORIES);
    }

    if (settingsRes.data) {
      setMonthlyPot(settingsRes.data.monthly_pot);
      setApiKey(settingsRes.data.claude_api_key || '');
    }
    if (reflRes.data) setReflections(reflRes.data);
    if (subsRes.data) setFlaggedSubs(subsRes.data);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  async function addTransaction(t: NewTransaction) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('transactions').insert({ ...t, user_id: user.id }).select().single();
    if (data) setTransactions((prev) => [data as Transaction, ...prev]);
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
    await supabase.from('categories').insert({ user_id: user.id, name, sort_order: categories.length });
    setCategories((prev) => [...prev, name]);
  }

  async function deleteCategory(name: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('categories').delete().eq('user_id', user.id).eq('name', name);
    setCategories((prev) => prev.filter((c) => c !== name));
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

  if (loading) {
    return <div className="min-h-screen bg-[#1D2C3E] flex items-center justify-center text-[#BDB4C3] text-sm">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-[#1D2C3E] p-4">
      <div className="flex justify-between items-center mb-3">
        <h1 className="text-sm font-medium text-[#FAF7F2]">Expensior!</h1>
        <div className="flex items-center gap-3">
          <button onClick={signOut} className="text-[11px] text-[#BDB4C3] hover:text-[#FAF7F2]">Sign out</button>
          <button onClick={() => setSettingsOpen(true)} aria-label="Settings"><IconSettings size={18} className="text-[#BDB4C3] hover:text-[#FAF7F2]" /></button>
        </div>
      </div>

      <div className="flex gap-3" style={{ height: 'calc(100vh - 64px)' }}>
        <div className="flex flex-col gap-3" style={{ width: '70%' }}>
          <div className="bg-[#355070] border border-[#6D597A] rounded-xl p-4" style={{ height: '38%' }}>
            <EntryZone
              categories={categories}
              editingTxn={editingTxn}
              onCancelEdit={() => setEditingTxn(null)}
              onAdd={addTransaction}
              onUpdate={updateTransaction}
              onDelete={deleteTransaction}
            />
          </div>
          <div style={{ height: '62%' }}>
            <Dashboard
              allTransactions={transactions}
              monthlyPot={monthlyPot}
              reflections={reflections}
              onAddReflection={addReflection}
              flaggedSubs={flaggedSubs}
              onSelectCategory={(c) => setFilter({ ...emptyFilter(), categories: new Set([c]) })}
            />
          </div>
        </div>
        <div className="bg-[#355070] border border-[#6D597A] rounded-xl p-4" style={{ width: '30%' }}>
          <Ledger
            monthLabel={month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            onPrevMonth={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            onNextMonth={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            onToday={() => { const d = new Date(); d.setDate(1); setMonth(d); }}
            transactions={monthTransactions}
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

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        categories={categories}
        onAddCategory={addCategory}
        onDeleteCategory={deleteCategory}
        monthlyPot={monthlyPot}
        onSaveMonthlyPot={saveMonthlyPot}
        apiKey={apiKey}
        onSaveApiKey={saveApiKey}
        onExportCSV={exportCSV}
        onClearAllData={clearAllData}
      />
    </div>
  );
}
