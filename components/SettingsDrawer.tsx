'use client';

import { useState } from 'react';
import { IconX } from '@tabler/icons-react';

export default function SettingsDrawer({
  open,
  onClose,
  categories,
  onAddCategory,
  onDeleteCategory,
  monthlyPot,
  onSaveMonthlyPot,
  apiKey,
  onSaveApiKey,
  onExportCSV,
  onClearAllData,
}: {
  open: boolean;
  onClose: () => void;
  categories: string[];
  onAddCategory: (name: string) => void;
  onDeleteCategory: (name: string) => void;
  monthlyPot: number | null;
  onSaveMonthlyPot: (n: number) => void;
  apiKey: string;
  onSaveApiKey: (k: string) => void;
  onExportCSV: () => void;
  onClearAllData: () => void;
}) {
  const [newCat, setNewCat] = useState('');
  const [pot, setPot] = useState(monthlyPot?.toString() || '');
  const [key, setKey] = useState(apiKey);
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <>
      {open && <div onClick={onClose} className="fixed inset-0 bg-black/45 z-40" />}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-sm bg-[#1D2C3E] border-l border-[#6D597A] z-50 transition-transform overflow-y-auto ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between p-4 border-b border-[#6D597A]">
          <h2 className="text-sm font-medium text-[#FAF7F2]">Settings</h2>
          <button onClick={onClose} aria-label="Close settings"><IconX size={18} className="text-[#BDB4C3]" /></button>
        </div>

        <div className="p-4">
          <Section title="Categories & budget">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {categories.map((c) => (
                <span key={c} className="text-[11px] px-2 py-1 rounded-full border border-[#6D597A] text-[#BDB4C3] flex items-center gap-1.5">
                  {c}
                  <button onClick={() => onDeleteCategory(c)} className="text-[#BDB4C3] hover:text-[#E56B6F]">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2 mb-4">
              <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="New category" className="flex-1 bg-[#355070] border border-[#6D597A] rounded-lg px-2.5 py-1.5 text-xs text-[#FAF7F2]" />
              <button onClick={() => { if (newCat.trim()) { onAddCategory(newCat.trim()); setNewCat(''); } }} className="bg-[#1D2C3E] border border-[#6D597A] text-[#BDB4C3] rounded-lg px-3 text-xs">Add</button>
            </div>
            <label className="text-[11px] text-[#BDB4C3] block mb-1.5">Monthly pot</label>
            <div className="flex gap-2">
              <input type="number" value={pot} onChange={(e) => setPot(e.target.value)} placeholder="e.g. 40000" className="flex-1 bg-[#355070] border border-[#6D597A] rounded-lg px-2.5 py-1.5 text-xs text-[#FAF7F2]" />
              <button onClick={() => onSaveMonthlyPot(parseFloat(pot) || 0)} className="bg-[#1D2C3E] border border-[#6D597A] text-[#BDB4C3] rounded-lg px-3 text-xs">Save</button>
            </div>
          </Section>

          <Section title="API and parsing">
            <label className="text-[11px] text-[#BDB4C3] block mb-1.5">Claude API key</label>
            <div className="flex gap-2">
              <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-..." className="flex-1 bg-[#355070] border border-[#6D597A] rounded-lg px-2.5 py-1.5 text-xs text-[#FAF7F2]" />
              <button onClick={() => onSaveApiKey(key)} className="bg-[#1D2C3E] border border-[#6D597A] text-[#BDB4C3] rounded-lg px-3 text-xs">Save</button>
            </div>
            <p className="text-[10px] text-[#BDB4C3] mt-1.5">Used for AI-assisted categorisation on merchants the built-in patterns don&apos;t recognise.</p>
          </Section>

          <Section title="Data and sync">
            <button onClick={onExportCSV} className="w-full bg-[#355070] border border-[#6D597A] text-[#FAF7F2] rounded-lg py-2 text-xs mb-2">Export as CSV</button>
            <p className="text-[10px] text-[#BDB4C3]">Your data lives in Supabase and is reachable from any device you sign into — no manual backup needed.</p>
          </Section>

          <Section title="Danger zone" danger>
            {!confirmClear ? (
              <button onClick={() => setConfirmClear(true)} className="w-full border border-[#E56B6F] text-[#E56B6F] rounded-lg py-2 text-xs">Clear all data</button>
            ) : (
              <div>
                <p className="text-xs text-[#E56B6F] mb-2">This permanently deletes every transaction. This can&apos;t be undone.</p>
                <div className="flex gap-2">
                  <button onClick={() => { onClearAllData(); setConfirmClear(false); }} className="flex-1 bg-[#E56B6F] text-[#FAF7F2] rounded-lg py-2 text-xs">Yes, delete everything</button>
                  <button onClick={() => setConfirmClear(false)} className="bg-[#1D2C3E] border border-[#6D597A] text-[#BDB4C3] rounded-lg px-3 text-xs">Cancel</button>
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
      <h3 className={`text-[11px] uppercase tracking-wide mb-2.5 ${danger ? 'text-[#E56B6F]' : 'text-[#BDB4C3]'}`}>{title}</h3>
      {children}
    </div>
  );
}
