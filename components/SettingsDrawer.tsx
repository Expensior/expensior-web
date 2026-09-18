'use client';

import { useState, useRef } from 'react';
import { IconX, IconCheck, IconChevronDown, IconPencil, IconArrowUp, IconArrowDown, IconLogout, IconCompass } from '@tabler/icons-react';
import FeatureGuide from './FeatureGuide';
import MfaSettings from './MfaSettings';
import { THEMES } from '@/lib/themes';
import type { RecurringTemplate, Category } from '@/lib/types';

export default function SettingsDrawer({
  open,
  onClose,
  categories,
  categoryRecords,
  onAddCategory,
  onDeleteCategory,
  onRenameCategory,
  onReorderCategory,
  monthlyPot,
  onSaveMonthlyPot,
  theme,
  onSaveTheme,
  textSize,
  onSaveTextSize,
  apiKey,
  onSaveApiKey,
  onExportCSV,
  onClearAllData,
  recurringTemplates,
  onAddRecurringTemplate,
  onDeleteRecurringTemplate,
  onEditRecurringTemplate,
  fridayDigestEnabled,
  onSaveFridayDigestEnabled,
  sundayWrapEnabled,
  onSaveSundayWrapEnabled,
  onSendFeedback,
  gmailConnected,
  onAddFlaggedSubscription,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  categories: string[];
  categoryRecords: Category[];
  onAddCategory: (name: string) => void;
  onDeleteCategory: (name: string) => void;
  onRenameCategory: (id: string, newName: string) => void;
  onReorderCategory: (id: string, direction: 'up' | 'down') => void;
  monthlyPot: number | null;
  onSaveMonthlyPot: (n: number) => void;
  theme: string;
  onSaveTheme: (id: string) => void;
  textSize: 'compact' | 'default' | 'large';
  onSaveTextSize: (size: 'compact' | 'default' | 'large') => void;
  apiKey: string;
  onSaveApiKey: (k: string) => void;
  onExportCSV: () => void;
  onClearAllData: () => void;
  recurringTemplates: RecurringTemplate[];
  onAddRecurringTemplate: (t: Omit<RecurringTemplate, 'id' | 'sort_order'>) => void;
  onDeleteRecurringTemplate: (id: string) => void;
  onEditRecurringTemplate: (id: string, updates: { name: string; amount: number; cadence: 'monthly' | 'weekly' }) => void;
  fridayDigestEnabled: boolean;
  onSaveFridayDigestEnabled: (enabled: boolean) => void;
  sundayWrapEnabled: boolean;
  onSaveSundayWrapEnabled: (enabled: boolean) => void;
  onSendFeedback: (message: string) => void;
  gmailConnected: boolean;
  onAddFlaggedSubscription: (merchant: string, amount: number) => void;
  onSignOut: () => void;
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
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [subMerchant, setSubMerchant] = useState('');
  const [subAmount, setSubAmount] = useState('');
  const [editingRecId, setEditingRecId] = useState<string | null>(null);
  const [editRecName, setEditRecName] = useState('');
  const [editRecAmount, setEditRecAmount] = useState('');
  const [editRecCadence, setEditRecCadence] = useState<'monthly' | 'weekly'>('monthly');
  const [guideOpen, setGuideOpen] = useState(false);
  const apiKeySectionRef = useRef<HTMLDivElement>(null);

  const currentTheme = THEMES.find((t) => t.id === theme);
  const sortedCats = [...categoryRecords].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <>
      {open && <div onClick={onClose} className="fixed inset-0 bg-black/45 z-40" />}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-sm bg-[var(--bg)] border-l border-[var(--border)] z-50 transition-transform overflow-y-auto ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h2 className="text-sc-16 font-medium text-[var(--text)]">Settings</h2>
          <button onClick={onClose} aria-label="Close settings"><IconX size={18} className="text-[var(--muted)]" /></button>
        </div>

        <div className="p-4">
          <button
            onClick={onSignOut}
            className="w-full flex items-center justify-center gap-2 bg-[var(--bg)]/40 border border-[var(--border)]/60 text-[var(--text)] rounded-lg py-2.5 text-sc-14 font-medium mb-2"
          >
            <IconLogout size={16} /> Sign out
          </button>
          <button
            onClick={() => setGuideOpen(true)}
            className="w-full flex items-center justify-center gap-2 text-[var(--muted)] hover:text-[var(--accent)] transition-colors text-sc-13 mb-6"
          >
            <IconCompass size={15} /> Feature guide
          </button>

          <Section title="Tiers">
            <TierRow
              name="Getting a feel"
              tagline="Manual entry, categories, weekly view"
              active
            />
            <TierRow
              name="Getting curious"
              tagline="Gmail import, subscription audit"
              active={gmailConnected}
              inactiveHint="Connect Gmail from the Gmail tile in Add Expense"
            />
            <TierRow
              name="Master of my domain"
              tagline="Receipt scan, AI-assisted categorisation"
              active={!!apiKey}
              inactiveHint="Add a Claude API key below to activate"
              onInactiveClick={() => { setEditingKey(true); apiKeySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}
            />
          </Section>

          <Section title="Security">
            <MfaSettings />
          </Section>

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
              <span className="text-sc-14 text-[var(--text)] flex-1">{(currentTheme || THEMES[0]).name}</span>
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
                    <span className="text-sc-14 text-[var(--text)] flex-1">{t.name}</span>
                    {theme === t.id && <IconCheck size={16} className="text-[var(--accent)] shrink-0" />}
                  </button>
                ))}
              </div>
            )}

            <label className="text-sc-13 text-[var(--muted)] block mt-4 mb-1.5">Text size</label>
            <div className="flex gap-2">
              {(['compact', 'default', 'large'] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => onSaveTextSize(size)}
                  className="flex-1 rounded-lg py-2 text-sc-13 font-medium capitalize border transition-colors"
                  style={{
                    borderColor: textSize === size ? 'var(--accent)' : 'var(--border)',
                    background: textSize === size ? 'color-mix(in srgb, var(--accent), transparent 85%)' : 'transparent',
                    color: textSize === size ? 'var(--accent)' : 'var(--muted)',
                  }}
                >
                  {size === 'compact' ? 'A-' : size === 'large' ? 'A+' : 'A'}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Categories & budget">
            <div className="flex flex-col gap-1.5 mb-3">
              {sortedCats.map((c, i) => (
                <div key={c.id} className="flex items-center gap-2 bg-[var(--surface)] border border-[var(--border)]/60 rounded-lg px-2.5 py-2">
                  {editingCatId === c.id ? (
                    <input
                      autoFocus
                      value={editCatName}
                      onChange={(e) => setEditCatName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { onRenameCategory(c.id, editCatName); setEditingCatId(null); }
                        if (e.key === 'Escape') setEditingCatId(null);
                      }}
                      className="flex-1 bg-[var(--bg)]/50 border border-[var(--accent)] rounded px-2 py-1 text-sc-14 text-[var(--text)]"
                    />
                  ) : (
                    <span className="flex-1 text-sc-14 text-[var(--text)]">{c.name}</span>
                  )}
                  <button onClick={() => onReorderCategory(c.id, 'up')} disabled={i === 0} aria-label="Move up" className="text-[var(--muted)] hover:text-[var(--accent)] disabled:opacity-25 disabled:hover:text-[var(--muted)]">
                    <IconArrowUp size={14} />
                  </button>
                  <button onClick={() => onReorderCategory(c.id, 'down')} disabled={i === sortedCats.length - 1} aria-label="Move down" className="text-[var(--muted)] hover:text-[var(--accent)] disabled:opacity-25 disabled:hover:text-[var(--muted)]">
                    <IconArrowDown size={14} />
                  </button>
                  {editingCatId === c.id ? (
                    <button onClick={() => { onRenameCategory(c.id, editCatName); setEditingCatId(null); }} className="text-[var(--accent)] text-sc-12 font-medium">Save</button>
                  ) : (
                    <button onClick={() => { setEditCatName(c.name); setEditingCatId(c.id); }} aria-label="Rename" className="text-[var(--muted)] hover:text-[var(--accent)]">
                      <IconPencil size={14} />
                    </button>
                  )}
                  <button onClick={() => onDeleteCategory(c.name)} aria-label="Delete" className="text-[var(--muted)] hover:text-[var(--danger)]">×</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mb-4">
              <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="New category" className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-sc-14 text-[var(--text)]" />
              <button onClick={() => { if (newCat.trim()) { onAddCategory(newCat.trim()); setNewCat(''); } }} className="border border-[var(--border)]/70 bg-[var(--bg)]/50 text-[var(--muted)] hover:bg-[var(--bg)]/80 hover:border-[var(--accent)]/60 transition-colors rounded-lg px-3 text-sc-14">Add</button>
            </div>
            <label className="text-sc-13 text-[var(--muted)] block mb-1.5">Monthly pot</label>
            <div className="flex gap-2">
              <input type="number" value={pot} onChange={(e) => setPot(e.target.value)} placeholder="e.g. 40000" className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-sc-14 text-[var(--text)]" />
              <button onClick={() => onSaveMonthlyPot(parseFloat(pot) || 0)} className="border border-[var(--border)]/70 bg-[var(--bg)]/50 text-[var(--muted)] hover:bg-[var(--bg)]/80 hover:border-[var(--accent)]/60 transition-colors rounded-lg px-3 text-sc-14">Save</button>
            </div>
          </Section>

          <Section title="API and parsing" refProp={apiKeySectionRef}>
            <label className="text-sc-13 text-[var(--muted)] block mb-1.5">Claude API key</label>
            {!editingKey ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-sc-14 text-[var(--muted)]">
                  {apiKey ? '•'.repeat(24) : 'Not set'}
                </div>
                <button
                  onClick={() => { setKey(''); setEditingKey(true); }}
                  className="border border-[var(--border)]/70 bg-[var(--bg)]/50 text-[var(--muted)] hover:bg-[var(--bg)]/80 hover:border-[var(--accent)]/60 transition-colors rounded-lg px-3 text-sc-14 shrink-0"
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
                  className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-sc-14 text-[var(--text)]"
                />
                <button
                  onClick={() => { onSaveApiKey(key); setEditingKey(false); }}
                  className="border border-[var(--border)]/70 bg-[var(--bg)]/50 text-[var(--muted)] hover:bg-[var(--bg)]/80 hover:border-[var(--accent)]/60 transition-colors rounded-lg px-3 text-sc-14 shrink-0"
                >
                  Save
                </button>
                <button
                  onClick={() => { setKey(apiKey); setEditingKey(false); }}
                  className="text-[var(--muted)] text-sc-14 px-2 shrink-0"
                >
                  Cancel
                </button>
              </div>
            )}
            <p className="text-sc-12 text-[var(--muted)] mt-1.5">Used for AI-assisted categorisation on merchants the built-in patterns don&apos;t recognise.</p>
          </Section>

          <Section title="Subscriptions">
            <p className="text-sc-12 text-[var(--muted)] mb-2">Automatic detection needs Gmail connected. Flag one manually here in the meantime.</p>
            <div className="flex gap-2">
              <input value={subMerchant} onChange={(e) => setSubMerchant(e.target.value)} placeholder="Merchant, e.g. Netflix" className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-sc-14 text-[var(--text)]" />
              <input type="number" value={subAmount} onChange={(e) => setSubAmount(e.target.value)} placeholder="₹/mo" className="w-20 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-sc-14 text-[var(--text)]" />
              <button
                onClick={() => {
                  if (!subMerchant.trim()) return;
                  onAddFlaggedSubscription(subMerchant.trim(), parseFloat(subAmount) || 0);
                  setSubMerchant(''); setSubAmount('');
                }}
                className="border border-[var(--border)]/70 bg-[var(--bg)]/50 text-[var(--muted)] hover:bg-[var(--bg)]/80 hover:border-[var(--accent)]/60 transition-colors rounded-lg px-3 text-sc-14 shrink-0"
              >
                Flag
              </button>
            </div>
          </Section>

          <Section title="Recurring templates">
            <div className="flex flex-col gap-1.5 mb-3">
              {recurringTemplates.length === 0 && <p className="text-sc-13 text-[var(--muted)]">None yet — add one below.</p>}
              {recurringTemplates.map((t) => (
                <div key={t.id} className="bg-[var(--surface)] border border-[var(--border)]/60 rounded-lg px-2.5 py-2">
                  {editingRecId === t.id ? (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex gap-2">
                        <input autoFocus value={editRecName} onChange={(e) => setEditRecName(e.target.value)} className="flex-1 bg-[var(--bg)]/50 border border-[var(--accent)] rounded px-2 py-1 text-sc-14 text-[var(--text)]" />
                        <input type="number" value={editRecAmount} onChange={(e) => setEditRecAmount(e.target.value)} className="w-20 bg-[var(--bg)]/50 border border-[var(--accent)] rounded px-2 py-1 text-sc-14 text-[var(--text)]" />
                      </div>
                      <div className="flex gap-2 items-center">
                        <select value={editRecCadence} onChange={(e) => setEditRecCadence(e.target.value as 'monthly' | 'weekly')} className="flex-1 bg-[var(--bg)]/50 border border-[var(--accent)] rounded px-2 py-1 text-sc-13 text-[var(--text)]">
                          <option value="monthly">Monthly</option>
                          <option value="weekly">Weekly</option>
                        </select>
                        <button
                          onClick={() => {
                            onEditRecurringTemplate(t.id, { name: editRecName.trim() || t.name, amount: parseFloat(editRecAmount) || t.amount, cadence: editRecCadence });
                            setEditingRecId(null);
                          }}
                          className="text-[var(--accent)] text-sc-13 font-medium shrink-0"
                        >
                          Save
                        </button>
                        <button onClick={() => setEditingRecId(null)} className="text-[var(--muted)] text-sc-13 shrink-0">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sc-14 text-[var(--text)]">{t.name}</p>
                        <p className="text-sc-12 text-[var(--muted)]">₹{t.amount.toLocaleString('en-IN')} · {t.cadence} · {t.category}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => { setEditRecName(t.name); setEditRecAmount(String(t.amount)); setEditRecCadence(t.cadence); setEditingRecId(t.id); }}
                          aria-label="Edit"
                          className="text-[var(--muted)] hover:text-[var(--accent)]"
                        >
                          <IconPencil size={14} />
                        </button>
                        <button onClick={() => onDeleteRecurringTemplate(t.id)} className="text-[var(--muted)] hover:text-[var(--danger)] text-sc-14">×</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 mb-2">
              <input value={recName} onChange={(e) => setRecName(e.target.value)} placeholder="Name, e.g. Rent" className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-sc-14 text-[var(--text)]" />
              <input type="number" value={recAmount} onChange={(e) => setRecAmount(e.target.value)} placeholder="Amount" className="w-24 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-sc-14 text-[var(--text)]" />
            </div>
            <div className="flex gap-2 mb-2">
              <select value={recCadence} onChange={(e) => setRecCadence(e.target.value as 'monthly' | 'weekly')} className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-sc-14 text-[var(--muted)]">
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
              </select>
              <button
                onClick={() => {
                  if (!recName.trim() || !recAmount) return;
                  onAddRecurringTemplate({ name: recName.trim(), amount: parseFloat(recAmount), category: 'Other', indulgence: false, essential: true, cadence: recCadence });
                  setRecName(''); setRecAmount('');
                }}
                className="border border-[var(--border)]/70 bg-[var(--bg)]/50 text-[var(--muted)] hover:bg-[var(--bg)]/80 hover:border-[var(--accent)]/60 transition-colors rounded-lg px-3 text-sc-14"
              >
                Add
              </button>
            </div>
          </Section>

          <Section title="Notifications">
            <ToggleRow label="Friday digest" sublabel="Weekly summary" checked={fridayDigestEnabled} onChange={onSaveFridayDigestEnabled} />
            <ToggleRow label="Sunday wrap" sublabel="Weekend reflection" checked={sundayWrapEnabled} onChange={onSaveSundayWrapEnabled} />
            <p className="text-sc-12 text-[var(--muted)] mt-1">
              These show up in the Reflect and digest section of your dashboard as in-app alerts only.
            </p>
          </Section>

          <Section title="Data and sync">
            <button onClick={onExportCSV} className="w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] rounded-lg py-2 text-sc-14 mb-2">Export as CSV</button>
            <p className="text-sc-12 text-[var(--muted)]">Your data lives in Supabase and is reachable from any device you sign into — no manual backup needed.</p>
          </Section>

          <Section title="Error reporting">
            {feedbackSent ? (
              <p className="text-sc-14 text-[var(--positive)]">Thanks — that&apos;s been sent.</p>
            ) : (
              <>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Describe what went wrong..."
                  rows={3}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 py-2 text-sc-14 text-[var(--text)] mb-2"
                />
                <button
                  onClick={() => {
                    if (!feedbackText.trim()) return;
                    onSendFeedback(feedbackText);
                    setFeedbackText('');
                    setFeedbackSent(true);
                    setTimeout(() => setFeedbackSent(false), 4000);
                  }}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] rounded-lg py-2 text-sc-14 mb-2"
                >
                  Send report
                </button>
                <p className="text-sc-12 text-[var(--muted)]">Reports are tied to your account so we can follow up — never shared or sold.</p>
              </>
            )}
          </Section>

          <Section title="Danger zone" danger>
            {!confirmClear ? (
              <button onClick={() => setConfirmClear(true)} className="w-full border border-[var(--danger)] text-[var(--danger)] rounded-lg py-2 text-sc-14">Clear all data</button>
            ) : (
              <div>
                <p className="text-sc-14 text-[var(--danger)] mb-2">This permanently deletes every transaction. This can&apos;t be undone.</p>
                <div className="flex gap-2">
                  <button onClick={() => { onClearAllData(); setConfirmClear(false); }} className="flex-1 bg-[var(--danger)] text-[var(--text)] rounded-lg py-2 text-sc-14">Yes, delete everything</button>
                  <button onClick={() => setConfirmClear(false)} className="border border-[var(--border)]/70 bg-[var(--bg)]/50 text-[var(--muted)] hover:bg-[var(--bg)]/80 hover:border-[var(--accent)]/60 transition-colors rounded-lg px-3 text-sc-14">Cancel</button>
                </div>
              </div>
            )}
          </Section>
        </div>
      </div>
      <FeatureGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
    </>
  );
}

function ToggleRow({ label, sublabel, checked, onChange }: { label: string; sublabel: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex justify-between items-center mb-3">
      <div>
        <p className="text-sc-14 text-[var(--text)]">{label}</p>
        <p className="text-sc-12 text-[var(--muted)]">{sublabel}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        aria-label={label}
        aria-pressed={checked}
        className="relative w-11 h-6 rounded-full transition-colors shrink-0"
        style={{
          background: checked ? 'var(--accent)' : 'transparent',
          border: checked ? 'none' : '1.5px solid var(--muted)',
        }}
      >
        <span
          className="absolute top-0.5 w-5 h-5 rounded-full flex items-center justify-center transition-transform"
          style={{ background: checked ? 'var(--bg)' : 'var(--muted)', transform: checked ? 'translateX(21px)' : 'translateX(1px)' }}
        >
          {checked && <IconCheck size={12} style={{ color: 'var(--accent)' }} />}
        </span>
      </button>
    </div>
  );
}

function TierRow({
  name, tagline, active, inactiveHint, onInactiveClick,
}: {
  name: string; tagline: string; active: boolean; inactiveHint?: string; onInactiveClick?: () => void;
}) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sc-14 font-medium text-[var(--text)]">{name}</p>
          <p className="text-sc-12 text-[var(--muted)]">{tagline}</p>
        </div>
        {active ? (
          <span className="text-sc-11 font-semibold uppercase tracking-wide" style={{ color: 'var(--positive)' }}>Active</span>
        ) : (
          <button
            onClick={onInactiveClick}
            className="text-sc-11 uppercase tracking-wide text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
            disabled={!onInactiveClick}
          >
            Not active
          </button>
        )}
      </div>
      {!active && inactiveHint && <p className="text-sc-11 text-[var(--muted)] mt-1">{inactiveHint}</p>}
    </div>
  );
}

function Section({ title, children, danger, refProp }: { title: string; children: React.ReactNode; danger?: boolean; refProp?: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div className="mb-6" ref={refProp}>
      <h3 className={`text-sc-13 uppercase tracking-wide mb-2.5 ${danger ? 'text-[var(--danger)]' : 'text-[var(--muted)]'}`}>{title}</h3>
      {children}
    </div>
  );
}
