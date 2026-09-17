'use client';

import { useEffect, useState } from 'react';
import type { NewTransaction, Transaction } from '@/lib/types';

const chip = (active: boolean) =>
  `text-[13px] px-2.5 py-1 rounded-full border cursor-pointer transition-colors ${
    active ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]' : 'border-[var(--border)]/70 bg-[var(--bg)]/50 text-[var(--muted)] hover:bg-[var(--bg)]/80 hover:border-[var(--accent)]/60'
  }`;

const TAGS = ['Celebration', 'Stress', 'Boredom', 'Social', 'Just wanted'];

export default function EditTransactionModal({
  categories,
  editingTxn,
  onCancelEdit,
  onUpdate,
  onDelete,
}: {
  categories: string[];
  editingTxn: Transaction;
  onCancelEdit: () => void;
  onUpdate: (id: string, t: Partial<NewTransaction>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [detail, setDetail] = useState<NewTransaction>({
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

  useEffect(() => {
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
  }, [editingTxn]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!detail.amount || !detail.description.trim()) return;
    await onUpdate(editingTxn.id, detail);
    onCancelEdit();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: 'color-mix(in srgb, var(--bg), transparent 40%)' }} onClick={onCancelEdit}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--surface)] border border-[var(--border)]/60 rounded-2xl p-4 w-full max-w-sm shadow-lg max-h-[85vh] overflow-auto"
      >
        <p className="text-[12px] text-[var(--muted)] mb-3">editing: {editingTxn.description} · {editingTxn.date}</p>

        <div className="flex gap-2 mb-2">
          <input
            type="number"
            placeholder="Amount"
            value={detail.amount || ''}
            onChange={(e) => setDetail({ ...detail, amount: parseFloat(e.target.value) || 0 })}
            className="w-28 bg-[var(--bg)]/50 border border-[var(--border)]/70 rounded-lg px-3 py-2 text-base text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
          />
          <input
            placeholder="Merchant / description"
            value={detail.description}
            onChange={(e) => setDetail({ ...detail, description: e.target.value })}
            className="flex-1 bg-[var(--bg)]/50 border border-[var(--border)]/70 rounded-lg px-3 py-2 text-base text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        <p className="text-[12px] text-[var(--muted)] mb-1.5">Category</p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {categories.map((c) => (
            <span key={c} className={chip(detail.category === c)} onClick={() => setDetail({ ...detail, category: c })}>{c}</span>
          ))}
        </div>

        <div className="flex gap-4 mb-2 text-[13px] text-[var(--muted)]">
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

        <p className="text-[12px] text-[var(--muted)] mb-1.5">Emotional tag</p>
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
            className="flex-1 bg-[var(--bg)]/50 border border-[var(--border)]/70 rounded-lg px-2 py-1.5 text-sm text-[var(--text)]"
          />
          <select
            value={detail.repeats}
            onChange={(e) => setDetail({ ...detail, repeats: e.target.value as NewTransaction['repeats'] })}
            className="flex-1 bg-[var(--bg)]/50 border border-[var(--border)]/70 rounded-lg px-2 py-1.5 text-sm text-[var(--muted)]"
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
          className="w-full bg-[var(--bg)]/50 border border-[var(--border)]/70 rounded-lg px-3 py-1.5 text-sm text-[var(--text)] mb-3"
        />

        <div className="flex gap-2 pt-3 border-t border-[var(--border)]/30">
          <button type="submit" className="flex-1 bg-[var(--accent)] text-[var(--bg)] rounded-lg py-2 text-sm font-medium">Save changes</button>
          <button
            type="button"
            onClick={async () => { await onDelete(editingTxn.id); onCancelEdit(); }}
            className="border border-[var(--danger)] text-[var(--danger)] rounded-lg px-3 text-sm"
          >
            Delete
          </button>
          <button type="button" onClick={onCancelEdit} className="bg-[var(--bg)]/50 border border-[var(--border)]/70 text-[var(--muted)] rounded-lg px-3 text-sm">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
