'use client';

import { useEffect, useState } from 'react';
import { parseQuickAdd, todayStr } from '@/lib/parse';
import { guessCategory } from '@/lib/categories';
import type { NewTransaction, Transaction } from '@/lib/types';

const chip = (active: boolean) =>
  `text-[11px] px-2.5 py-1 rounded-full border cursor-pointer transition-colors ${
    active ? 'border-[#B56576] bg-[#B56576]/15 text-[#B56576]' : 'border-[#6D597A] text-[#BDB4C3] hover:border-[#B56576]'
  }`;

const TAGS = ['Celebration', 'Stress', 'Boredom', 'Social', 'Just wanted'];

export default function EntryZone({
  categories,
  editingTxn,
  onCancelEdit,
  onAdd,
  onUpdate,
  onDelete,
}: {
  categories: string[];
  editingTxn: Transaction | null;
  onCancelEdit: () => void;
  onAdd: (t: NewTransaction) => Promise<void>;
  onUpdate: (id: string, t: Partial<NewTransaction>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<'quick' | 'detail'>('quick');
  const [quickText, setQuickText] = useState('');
  const [preview, setPreview] = useState<{ amount: number; description: string; category: string; indulgence: boolean; date: string } | null>(null);
  const [toast, setToast] = useState('');

  const [detail, setDetail] = useState<NewTransaction>(blankDetail());

  function blankDetail(): NewTransaction {
    return {
      amount: 0,
      description: '',
      category: categories[0] || 'Other',
      type: 'expense',
      indulgence: false,
      essential: true,
      regret: false,
      tag: null,
      notes: null,
      date: todayStr(),
      repeats: 'none',
    };
  }

  useEffect(() => {
    if (editingTxn) {
      setMode('detail');
      setDetail({
        amount: editingTxn.amount,
        description: editingTxn.description,
        category: editingTxn.category,
        type: editingTxn.type,
        indulgence: editingTxn.indulgence,
        essential: editingTxn.essential,
        regret: editingTxn.regret,
        tag: editingTxn.tag,
        notes: editingTxn.notes,
        date: editingTxn.date,
        repeats: editingTxn.repeats,
      });
    }
  }, [editingTxn]);

  function handleQuickChange(v: string) {
    setQuickText(v);
    const { amount, description, date } = parseQuickAdd(v);
    if (amount && v.trim().length > 2) {
      const guess = guessCategory(description) || { category: categories[0] || 'Other', indulgence: false };
      setPreview({ amount, description, category: guess.category, indulgence: guess.indulgence, date });
    } else {
      setPreview(null);
    }
  }

  async function confirmQuick() {
    if (!preview) return;
    await onAdd({
      amount: preview.amount,
      description: preview.description,
      category: preview.category,
      type: 'expense',
      indulgence: preview.indulgence,
      essential: !preview.indulgence,
      regret: false,
      tag: null,
      notes: null,
      date: preview.date,
      repeats: 'none',
    });
    setToast(`Added ₹${preview.amount.toLocaleString('en-IN')} · ${preview.description}${preview.date !== todayStr() ? ` · ${preview.date}` : ''}`);
    setTimeout(() => setToast(''), 4000);
    setQuickText('');
    setPreview(null);
  }

  async function submitDetail(e: React.FormEvent) {
    e.preventDefault();
    if (!detail.amount || !detail.description.trim()) return;
    if (editingTxn) {
      await onUpdate(editingTxn.id, detail);
      onCancelEdit();
    } else {
      await onAdd(detail);
    }
    setDetail(blankDetail());
    if (!editingTxn) setMode('quick');
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => { setMode('quick'); onCancelEdit(); }}
          className={`text-[11px] px-3 py-1 rounded-full border ${mode === 'quick' ? 'border-[#B56576] bg-[#B56576]/15 text-[#B56576]' : 'border-[#6D597A] text-[#BDB4C3]'}`}
        >
          Quick
        </button>
        <button
          onClick={() => { setMode('detail'); onCancelEdit(); }}
          className={`text-[11px] px-3 py-1 rounded-full border ${mode === 'detail' && !editingTxn ? 'border-[#B56576] bg-[#B56576]/15 text-[#B56576]' : 'border-[#6D597A] text-[#BDB4C3]'}`}
        >
          Detailed
        </button>
        <span className="ml-auto text-[10px] text-[#BDB4C3]">
          {editingTxn ? `editing: ${editingTxn.description} · ${editingTxn.date}` : 'add mode'}
        </span>
      </div>

      {mode === 'quick' && !editingTxn && (
        <div className="flex-1 flex flex-col">
          <input
            autoFocus
            value={quickText}
            onChange={(e) => handleQuickChange(e.target.value)}
            placeholder="₹450 swiggy lunch"
            className="w-full bg-[#355070] border border-[#6D597A] rounded-lg px-3 py-2.5 text-sm text-[#FAF7F2] placeholder:text-[#BDB4C3] focus:outline-none focus:border-[#B56576] mb-3"
          />
          {preview && (
            <div className="bg-[#355070] border border-[#6D597A] rounded-lg p-3">
              <p className="text-[10px] text-[#BDB4C3] mb-2">Tap anything to fix it before adding</p>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg font-medium text-[#FAF7F2]">₹{preview.amount.toLocaleString('en-IN')}</span>
                <input
                  value={preview.description}
                  onChange={(e) => setPreview({ ...preview, description: e.target.value })}
                  className="flex-1 bg-[#1D2C3E] border border-[#6D597A] rounded px-2 py-1 text-xs text-[#FAF7F2]"
                />
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {categories.map((c) => (
                  <span key={c} className={chip(preview.category === c)} onClick={() => setPreview({ ...preview, category: c })}>
                    {c}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className={chip(preview.indulgence)} onClick={() => setPreview({ ...preview, indulgence: true })}>indulgence</span>
                <span className={chip(!preview.indulgence)} onClick={() => setPreview({ ...preview, indulgence: false })}>essential</span>
                <input
                  type="date"
                  value={preview.date}
                  onChange={(e) => setPreview({ ...preview, date: e.target.value })}
                  className="ml-auto bg-[#1D2C3E] border border-[#6D597A] rounded px-2 py-1 text-[11px] text-[#BDB4C3]"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={confirmQuick} className="flex-1 bg-[#B56576] text-[#1D2C3E] rounded-lg py-2 text-xs font-medium">
                  Add transaction
                </button>
                <button onClick={() => { setPreview(null); setQuickText(''); }} className="bg-[#1D2C3E] border border-[#6D597A] text-[#BDB4C3] rounded-lg px-3 text-xs">
                  Discard
                </button>
              </div>
            </div>
          )}
          {toast && <p className="text-xs text-[#EAAC8B] mt-2">{toast}</p>}
        </div>
      )}

      {mode === 'detail' && (
        <form onSubmit={submitDetail} className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto pr-1">
          <div className="flex gap-2 mb-2">
            <input
              type="number"
              placeholder="Amount"
              value={detail.amount || ''}
              onChange={(e) => setDetail({ ...detail, amount: parseFloat(e.target.value) || 0 })}
              className="w-28 bg-[#355070] border border-[#6D597A] rounded-lg px-3 py-2 text-sm text-[#FAF7F2] focus:outline-none focus:border-[#B56576]"
            />
            <input
              placeholder="Merchant / description"
              value={detail.description}
              onChange={(e) => setDetail({ ...detail, description: e.target.value })}
              className="flex-1 bg-[#355070] border border-[#6D597A] rounded-lg px-3 py-2 text-sm text-[#FAF7F2] focus:outline-none focus:border-[#B56576]"
            />
          </div>

          <p className="text-[10px] text-[#BDB4C3] mb-1.5">Category</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {categories.map((c) => (
              <span key={c} className={chip(detail.category === c)} onClick={() => setDetail({ ...detail, category: c })}>{c}</span>
            ))}
          </div>

          <div className="flex gap-4 mb-2 text-[11px] text-[#BDB4C3]">
            {(['expense', 'saving', 'windfall'] as const).map((t) => (
              <label key={t} className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" checked={detail.type === t} onChange={() => setDetail({ ...detail, type: t })} />
                {t[0].toUpperCase() + t.slice(1)}
              </label>
            ))}
          </div>

          <div className="flex gap-2 mb-2">
            <span className={chip(detail.indulgence)} onClick={() => setDetail({ ...detail, indulgence: !detail.indulgence, essential: detail.indulgence })}>indulgence</span>
            <span className={chip(detail.essential)} onClick={() => setDetail({ ...detail, essential: !detail.essential, indulgence: detail.essential })}>essential</span>
            <span className={chip(detail.regret)} onClick={() => setDetail({ ...detail, regret: !detail.regret })}>regret</span>
          </div>

          <p className="text-[10px] text-[#BDB4C3] mb-1.5">Emotional tag</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {TAGS.map((t) => (
              <span key={t} className={chip(detail.tag === t)} onClick={() => setDetail({ ...detail, tag: detail.tag === t ? null : t })}>{t}</span>
            ))}
          </div>

          <div className="flex gap-2 mb-2">
            <input
              type="date"
              value={detail.date}
              onChange={(e) => setDetail({ ...detail, date: e.target.value })}
              className="flex-1 bg-[#355070] border border-[#6D597A] rounded-lg px-2 py-1.5 text-xs text-[#FAF7F2]"
            />
            <select
              value={detail.repeats}
              onChange={(e) => setDetail({ ...detail, repeats: e.target.value as NewTransaction['repeats'] })}
              className="flex-1 bg-[#355070] border border-[#6D597A] rounded-lg px-2 py-1.5 text-xs text-[#BDB4C3]"
            >
              <option value="none">Repeats: none</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <input
            placeholder="Notes"
            value={detail.notes || ''}
            onChange={(e) => setDetail({ ...detail, notes: e.target.value })}
            className="w-full bg-[#355070] border border-[#6D597A] rounded-lg px-3 py-1.5 text-xs text-[#FAF7F2] mb-1"
          />
        </div>

          <div className="flex gap-2 pt-3 mt-1 border-t border-[#6D597A]/30 shrink-0">
            <button type="submit" className="flex-1 bg-[#B56576] text-[#1D2C3E] rounded-lg py-2 text-xs font-medium">
              {editingTxn ? 'Save changes' : 'Add transaction'}
            </button>
            {editingTxn && (
              <>
                <button
                  type="button"
                  onClick={async () => { await onDelete(editingTxn.id); onCancelEdit(); }}
                  className="border border-[#E56B6F] text-[#E56B6F] rounded-lg px-3 text-xs"
                >
                  Delete
                </button>
                <button type="button" onClick={onCancelEdit} className="bg-[#1D2C3E] border border-[#6D597A] text-[#BDB4C3] rounded-lg px-3 text-xs">
                  Cancel
                </button>
              </>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
