'use client';

import { useState } from 'react';
import { IconX, IconCheck, IconChevronDown } from '@tabler/icons-react';
import { THEMES } from '@/lib/themes';
import type { RecurringTemplate } from '@/lib/types';

export default function SettingsDrawer({
  open,
  onClose,
  categories,
  onAddCategory,
  onDeleteCategory,
  monthlyPot,
  onSaveMonthlyPot,
  theme,
  onSaveTheme,
  apiKey,
  onSaveApiKey,
  onExportCSV,
  onClearAllData,
  recurringTemplates,
  onAddRecurringTemplate,
  onDeleteRecurringTemplate,
}: {
  open: boolean;
  onClose: () => void;
  categories: string[];
  onAddCategory: (name: string) => void;
  onDeleteCategory: (name: string) => void;
  monthlyPot: number | null;
  onSaveMonthlyPot: (n: number) => void;
  theme: string;
  onSaveTheme: (id: string) => void;
  apiKey: string;
  onSaveApiKey: (k: string) => void;
  onExportCSV: () => void;
  onClearAllData: () => void;
  recurringTemplates: RecurringTemplate[];
  onAddRecurringTemplate: (t: Omit<RecurringTemplate, 'id' | 'sort_order'>) => void;
  onDeleteRecurringTemplate: (id: string) => void;
}) {
  const [newCat, setNewCat] = useState('');
  const [pot, setPot] = useState(monthlyPot?.toString() || '');
  const [key, setKey] = useState(apiKey);
  const [editingKey, setEditingKey] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [recName, setRecName] = useState('');
  const [recAmount, setRecAmount] = useState('');
  const [recCadence, setRecCadence] = useState<'monthly' | 'weekly'>('monthly');

  const currentTheme = THEMES.find((t) => t.id === theme);

  return (
    <>
      {open && <div onClick={onClose} className="fixed inset-0 bg-black/45 z-40" />}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-sm bg-[var(--bg)] border-l border-[var(--border)] z-50 transition-transform overflow-y-auto ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h2 className="text-sm font-medium text-[var(--text)]">Settings</h2>
          <button onClick={onClose} aria-label="Close settings"><IconX size={18} className="text-[var(--muted)]" /></button>
        </div>

        <div className="p-4">
          <Section title="Appearance">
            <button
              onClick={() => setAppearanceOpen((v) => !v)}
              className="w-full flex items-center gap-3 border rounded-lg px-3 py-2.5 text-left transition-colors"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="flex gap-1 shrink-0">
                {(currentTheme || THEMES[0]).swatches.map((c, i) => (
                  <span key={i} className="w-4 h-4 rounded-full border border-[var(--border)]" style={{ background: c }} />
                ))}
              </div>
              <span className="text-xs text-[var(--text)] flex-1">{(currentTheme || THEMES[0]).name}</span>
              <IconChevronDown size={16} className="text-[var(--muted)] transition-transform" style={{ transform: appearanceOpen ? 'rotate(180deg)' : 'none' }} />
            </button>
            {appearanceOpen && (
              <div className="flex flex-col gap-2 mt-2">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { onSaveTheme(t.id); setAppearanceOpen(false); }}
                    className="flex items-center gap-3 border rounded-lg px-3 py-2.5 text-left transition-colors"
                    style={{
                      borderColor: theme === t.id ? 'var(--accent)' : 'var(--border)',
                      background: theme === t.id ? 'color-mix(in srgb, var(--accent), transparent 85%)' : 'transparent',
                    }}
                  >
                    <div className="flex gap-1 shrink-0">
                      {t.swatches.map((c, i) => (
                        <span key={i} className="w-4 h-4 rounded-full border border-[var(--border)]" style={{ background: c }} />
                      ))}
                    </div>
                    <span className="text-xs text-[var(--text)] flex-1">{t.name}</span>
                    {theme === t.id && <IconCheck size={16} className="text-[var(--accent)] shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </Section>

          <Section title="Categories & budget">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {categories.map((c) => (
                <span key={c} className="text-[11px] px-2 py-1 rounded-full border border-[var(--border)]/70 bg-[var(--bg)]/50 text-[var(--muted)] hover:bg-[var(--bg)]/80 hover:border-[var(--accent)]/60 transition-colors flex items-center gap-1.5">
                  {c}
                  <button onClick={() => onDeleteCategory(c)} className="text-[var(--muted)] hover:text-[var(--danger)]">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2 mb-4">
              <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="New category" className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text)]" />
              <button onClick={() => { if (newCat.trim()) { onAddCategory(newCat.trim()); setNewCat(''); } }} className="border border-[var(--border)]/70 bg-[var(--bg)]/50 text-[var(--muted)] hover:bg-[var(--bg)]/80 hover:border-[var(--accent)]/60 transition-colors rounded-lg px-3 text-xs">Add</button>
            </div>
            <label className="text-[11px] text-[var(--muted)] block mb-1.5">Monthly pot</label>
            <div className="flex gap-2">
              <input type="number" value={pot} onChange={(e) => setPot(e.target.value)} placeholder="e.g. 40000" className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text)]" />
              <button onClick={() => onSaveMonthlyPot(parseFloat(pot) || 0)} className="border border-[var(--border)]/70 bg-[var(--bg)]/50 text-[var(--muted)] hover:bg-[var(--bg)]/80 hover:border-[var(--accent)]/60 transition-colors rounded-lg px-3 text-xs">Save</button>
            </div>
          </Section>

          <Section title="API and parsing">
            <label className="text-[11px] text-[var(--muted)] block mb-1.5">Claude API key</label>
            {!editingKey ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--muted)]">
                  {apiKey ? '•'.repeat(24) : 'Not set'}
                </div>
                <button
                  onClick={() => { setKey(''); setEditingKey(true); }}
                  className="border border-[var(--border)]/70 bg-[var(--bg)]/50 text-[var(--muted)] hover:bg-[var(--bg)]/80 hover:border-[var(--accent)]/60 transition-colors rounded-lg px-3 text-xs shrink-0"
                >
                  {apiKey ? 'Change' : 'Add'}
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  autoFocus
                  type="password"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text)]"
                />
                <button
                  onClick={() => { onSaveApiKey(key); setEditingKey(false); }}
                  className="border border-[var(--border)]/70 bg-[var(--bg)]/50 text-[var(--muted)] hover:bg-[var(--bg)]/80 hover:border-[var(--accent)]/60 transition-colors rounded-lg px-3 text-xs shrink-0"
                >
                  Save
                </button>
                <button
                  onClick={() => { setKey(apiKey); setEditingKey(false); }}
                  className="text-[var(--muted)] text-xs px-2 shrink-0"
                >
                  Cancel
                </button>
              </div>
            )}
            <p className="text-[10px] text-[var(--muted)] mt-1.5">Used for AI-assisted categorisation on merchants the built-in patterns don&apos;t recognise.</p>
          </Section>

          <Section title="Recurring templates">
            <div className="flex flex-col gap-1.5 mb-3">
              {recurringTemplates.length === 0 && <p className="text-[11px] text-[var(--muted)]">None yet — add one below.</p>}
              {recurringTemplates.map((t) => (
                <div key={t.id} className="flex justify-between items-center bg-[var(--surface)] border border-[var(--border)]/60 rounded-lg px-2.5 py-2">
                  <div>
                    <p className="text-xs text-[var(--text)]">{t.name}</p>
                    <p className="text-[10px] text-[var(--muted)]">₹{t.amount.toLocaleString('en-IN')} · {t.cadence} · {t.category}</p>
                  </div>
                  <button onClick={() => onDeleteRecurringTemplate(t.id)} className="text-[var(--muted)] hover:text-[var(--danger)] text-xs">×</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mb-2">
              <input value={recName} onChange={(e) => setRecName(e.target.value)} placeholder="Name, e.g. Rent" className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text)]" />
              <input type="number" value={recAmount} onChange={(e) => setRecAmount(e.target.value)} placeholder="Amount" className="w-24 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text)]" />
            </div>
            <div className="flex gap-2 mb-2">
              <select value={recCadence} onChange={(e) => setRecCadence(e.target.value as 'monthly' | 'weekly')} className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--muted)]">
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
              </select>
              <button
                onClick={() => {
                  if (!recName.trim() || !recAmount) return;
                  onAddRecurringTemplate({ name: recName.trim(), amount: parseFloat(recAmount), category: categories[0] || 'Other', indulgence: false, essential: true, cadence: recCadence });
                  setRecName(''); setRecAmount('');
                }}
                className="border border-[var(--border)]/70 bg-[var(--bg)]/50 text-[var(--muted)] hover:bg-[var(--bg)]/80 hover:border-[var(--accent)]/60 transition-colors rounded-lg px-3 text-xs"
              >
                Add
              </button>
            </div>
          </Section>

          <Section title="Data and sync">
            <button onClick={onExportCSV} className="w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] rounded-lg py-2 text-xs mb-2">Export as CSV</button>
            <p className="text-[10px] text-[var(--muted)]">Your data lives in Supabase and is reachable from any device you sign into — no manual backup needed.</p>
          </Section>

          <Section title="Danger zone" danger>
            {!confirmClear ? (
              <button onClick={() => setConfirmClear(true)} className="w-full border border-[var(--danger)] text-[var(--danger)] rounded-lg py-2 text-xs">Clear all data</button>
            ) : (
              <div>
                <p className="text-xs text-[var(--danger)] mb-2">This permanently deletes every transaction. This can&apos;t be undone.</p>
                <div className="flex gap-2">
                  <button onClick={() => { onClearAllData(); setConfirmClear(false); }} className="flex-1 bg-[var(--danger)] text-[var(--text)] rounded-lg py-2 text-xs">Yes, delete everything</button>
                  <button onClick={() => setConfirmClear(false)} className="border border-[var(--border)]/70 bg-[var(--bg)]/50 text-[var(--muted)] hover:bg-[var(--bg)]/80 hover:border-[var(--accent)]/60 transition-colors rounded-lg px-3 text-xs">Cancel</button>
                </div>
              </div>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}

function Section({ title, children, danger }: { title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <div className="mb-6">
      <h3 className={`text-[11px] uppercase tracking-wide mb-2.5 ${danger ? 'text-[var(--danger)]' : 'text-[var(--muted)]'}`}>{title}</h3>
      {children}
    </div>
  );
}
