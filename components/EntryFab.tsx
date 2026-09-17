'use client';

import { useRef, useState } from 'react';
import {
  IconPlus, IconKeyboard, IconMicrophone, IconMessage2, IconScan, IconMail,
  IconRepeat, IconChevronsDown, IconArrowLeft, IconReceipt, IconLock, IconFileSpreadsheet,
} from '@tabler/icons-react';
import { parseQuickAdd, parseBulkText, todayStr, fmt, parseCsv, autoDetectCsvColumns, candidatesFromCsv, type CsvParseResult, type CsvColumnMap } from '@/lib/parse';
import { guessCategory } from '@/lib/categories';
import { createClient } from '@/lib/supabase/client';
import type { NewTransaction, RecurringTemplate } from '@/lib/types';

type View = 'hub' | 'type' | 'voice' | 'sms' | 'scan' | 'gmail';

const chip = (active: boolean) =>
  `text-[17px] font-medium px-3 py-2 rounded-lg cursor-pointer transition-colors ${
    active ? 'bg-[var(--accent)] text-[var(--bg)]' : 'bg-[var(--accent)]/8 border border-[var(--accent)]/25 text-[var(--text)] hover:bg-[var(--accent)]/15'
  }`;

export default function EntryFab({
  categories,
  recurringTemplates,
  hasApiKey,
  gmailConnected,
  onAdd,
  onBulkAdd,
  onLogRecurring,
}: {
  categories: string[];
  recurringTemplates: RecurringTemplate[];
  hasApiKey: boolean;
  gmailConnected: boolean;
  onAdd: (t: NewTransaction) => Promise<void>;
  onBulkAdd: (items: NewTransaction[]) => Promise<void>;
  onLogRecurring: (template: RecurringTemplate) => Promise<void>;
}) {
  const [fabOpen, setFabOpen] = useState(false);
  const [view, setView] = useState<View>('hub');
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [toast, setToast] = useState('');

  function closeAll() {
    setFabOpen(false);
    setTimeout(() => setView('hub'), 200);
  }

  function flashToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  }

  return (
    <div className="absolute bottom-5 right-5 z-30" style={{ maxWidth: 'calc(100% - 40px)' }}>
      {toast && (
        <div className="absolute bottom-[80px] right-0 bg-[var(--surface)] border border-[var(--border)]/50 text-[var(--text)] text-xl rounded-lg px-4 py-2.5 shadow-lg whitespace-nowrap">
          {toast}
        </div>
      )}

      {fabOpen && <div className="fixed inset-0 -z-10" onClick={closeAll} />}

      <div
        className="absolute bottom-[52px] right-0 origin-bottom-right transition-all duration-200"
        style={{
          opacity: fabOpen ? 1 : 0,
          transform: fabOpen ? 'scale(1)' : 'scale(0.15)',
          pointerEvents: fabOpen ? 'auto' : 'none',
          width: 'min(94%, 560px)',
        }}
      >
        <div
          className="bg-[var(--surface)] border border-[var(--border)]/40 shadow-lg overflow-hidden"
          style={{ borderRadius: '26px 26px 14px 26px', maxHeight: '82vh', overflowY: 'auto' }}
        >
          {view === 'hub' && (
            <div className="p-6">
              <div className="fab-grid grid gap-4" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <Tile icon={IconKeyboard} label="Type" primary onClick={() => setView('type')} />
                <Tile icon={IconMicrophone} label="Voice" onClick={() => setView('voice')} />
                <Tile icon={IconMessage2} label="SMS/Chat" onClick={() => setView('sms')} />
                <Tile icon={IconScan} label="Scan" locked={!hasApiKey} onClick={() => setView('scan')} />
                <Tile icon={IconMail} label="Gmail" locked={!gmailConnected} onClick={() => setView('gmail')} />
                <RecurringTile open={recurringOpen} onClick={() => setRecurringOpen((v) => !v)} />
              </div>
              {recurringOpen && (
                <div className="border-t border-[var(--border)]/30 mt-4 pt-4 flex flex-col gap-2">
                  {recurringTemplates.length === 0 && (
                    <p className="text-xl text-[var(--muted)]">No templates yet — add one in Settings.</p>
                  )}
                  {recurringTemplates.map((t) => (
                    <div key={t.id} className="flex justify-between items-center bg-[var(--accent)]/8 rounded-lg px-4 py-3">
                      <div>
                        <p className="text-xl font-medium text-[var(--text)]">{t.name}</p>
                        <p className="text-lg text-[var(--muted)]">{fmt(t.amount)} · {t.cadence}</p>
                      </div>
                      <button
                        onClick={async () => { await onLogRecurring(t); flashToast(`Logged ${t.name}`); closeAll(); }}
                        className="bg-[var(--accent)] text-[var(--bg)] text-lg font-medium px-4 py-2 rounded-md"
                      >
                        Log now
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {view === 'type' && (
            <TypeView categories={categories} onBack={() => setView('hub')} onAdd={onAdd} onDone={(msg) => { flashToast(msg); closeAll(); }} />
          )}
          {view === 'voice' && (
            <VoiceView categories={categories} onBack={() => setView('hub')} onAdd={onAdd} onDone={(msg) => { flashToast(msg); closeAll(); }} />
          )}
          {view === 'sms' && (
            <SmsView categories={categories} onBack={() => setView('hub')} onBulkAdd={onBulkAdd} onDone={(msg) => { flashToast(msg); closeAll(); }} />
          )}
          {view === 'scan' && (
            <ScanView categories={categories} hasApiKey={hasApiKey} onBack={() => setView('hub')} onAdd={onAdd} onDone={(msg) => { flashToast(msg); closeAll(); }} />
          )}
          {view === 'gmail' && <GmailView connected={gmailConnected} onBack={() => setView('hub')} onBulkAdd={onBulkAdd} onDone={(msg) => { flashToast(msg); closeAll(); }} categories={categories} />}
        </div>
      </div>

      <button
        aria-label="Add expense"
        onClick={() => setFabOpen((v) => !v)}
        className="w-16 h-16 rounded-full bg-[var(--accent)] border-2 flex items-center justify-center shadow-lg relative z-10"
        style={{ borderColor: 'var(--surface)' }}
      >
        <IconPlus size={30} className="text-[var(--bg)] transition-transform duration-200" style={{ transform: fabOpen ? 'rotate(45deg)' : 'rotate(0)' }} />
      </button>
    </div>
  );
}

function Tile({ icon: Icon, label, primary, locked, onClick }: { icon: any; label: string; primary?: boolean; locked?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2" style={locked ? { opacity: 0.45 } : undefined}>
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center relative"
        style={primary ? { background: 'var(--accent)' } : { background: 'color-mix(in srgb, var(--accent), transparent 90%)', border: '1px solid color-mix(in srgb, var(--accent), transparent 75%)' }}
      >
        <Icon size={28} className={primary ? 'text-[var(--bg)]' : 'text-[var(--accent)]'} />
        {locked && (
          <IconLock size={16} className="absolute -bottom-1 -right-1 bg-[var(--surface)] rounded-full text-[var(--muted)]" />
        )}
      </div>
      <p className="text-base text-[var(--text)]">{label}</p>
    </button>
  );
}

function RecurringTile({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center relative" style={{ background: 'color-mix(in srgb, var(--accent), transparent 90%)', border: '1px solid color-mix(in srgb, var(--accent), transparent 75%)' }}>
        <IconRepeat size={28} className="text-[var(--accent)]" />
        <IconChevronsDown
          size={16}
          className="absolute -bottom-1 -right-1 bg-[var(--surface)] rounded-full text-[var(--accent)] transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)' }}
        />
      </div>
      <p className="text-base text-[var(--text)]">Recurring</p>
    </button>
  );
}

function BackHeader({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3 px-6 pt-6 pb-2">
      <button onClick={onBack} aria-label="Back" className="text-[var(--muted)]"><IconArrowLeft size={20} /></button>
      <p className="text-xl font-medium text-[var(--text)]">{label}</p>
    </div>
  );
}

function TypeView({ categories, onBack, onAdd, onDone }: { categories: string[]; onBack: () => void; onAdd: (t: NewTransaction) => Promise<void>; onDone: (msg: string) => void }) {
  const [mode, setMode] = useState<'quick' | 'detailed'>('quick');
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<{ amount: number; description: string; category: string; indulgence: boolean; date: string } | null>(null);
  const [detail, setDetail] = useState<NewTransaction>({
    amount: 0, description: '', category: 'Other', type: 'expense',
    indulgence: false, essential: true, regret: false, tag: null, notes: null, date: todayStr(), repeats: 'none',
  });

  function handleChange(v: string) {
    setText(v);
    const { amount, description, date } = parseQuickAdd(v);
    if (amount && v.trim().length > 2) {
      const guess = guessCategory(description) || { category: 'Other', indulgence: false };
      setPreview({ amount, description, category: guess.category, indulgence: guess.indulgence, date });
    } else {
      setPreview(null);
    }
  }

  async function confirmQuick() {
    if (!preview) return;
    await onAdd({
      amount: preview.amount, description: preview.description, category: preview.category,
      type: 'expense', indulgence: preview.indulgence, essential: !preview.indulgence,
      regret: false, tag: null, notes: null, date: preview.date, repeats: 'none',
    });
    onDone(`Added ${fmt(preview.amount)} · ${preview.description}`);
  }

  async function confirmDetailed(e: React.FormEvent) {
    e.preventDefault();
    if (!detail.amount || !detail.description.trim()) return;
    await onAdd(detail);
    onDone(`Added ${fmt(detail.amount)} · ${detail.description}`);
  }

  return (
    <div className="p-5">
      <BackHeader label="Type" onBack={onBack} />
      <div className="flex gap-2 mb-2 mt-1">
        <span className={chip(mode === 'quick')} onClick={() => setMode('quick')}>Quick</span>
        <span className={chip(mode === 'detailed')} onClick={() => setMode('detailed')}>Detailed</span>
      </div>

      {mode === 'quick' && (
        <>
          <input
            autoFocus
            value={text}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="450 swiggy lunch"
            className="w-full bg-[var(--bg)]/40 border border-[var(--border)]/50 rounded-lg px-3 py-2.5 text-xl text-[var(--text)] placeholder:text-[var(--muted)] mb-2"
          />
          {preview && (
            <div className="bg-[var(--bg)]/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[22px] font-semibold text-[var(--text)]">{fmt(preview.amount)}</span>
                <input value={preview.description} onChange={(e) => setPreview({ ...preview, description: e.target.value })} className="flex-1 bg-[var(--surface)] border border-[var(--border)]/40 rounded px-2 py-1 text-lg text-[var(--text)]" />
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {categories.map((c) => (
                  <span key={c} className={chip(preview.category === c)} onClick={() => setPreview({ ...preview, category: c })} style={{ padding: '4px 10px' }}>{c}</span>
                ))}
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className={chip(preview.indulgence)} style={{ padding: '4px 10px' }} onClick={() => setPreview({ ...preview, indulgence: true })}>indulgence</span>
                <span className={chip(!preview.indulgence)} style={{ padding: '4px 10px' }} onClick={() => setPreview({ ...preview, indulgence: false })}>essential</span>
                <input type="date" value={preview.date} onChange={(e) => setPreview({ ...preview, date: e.target.value })} className="ml-auto bg-[var(--surface)] border border-[var(--border)]/40 rounded px-1.5 py-1 text-[15px] text-[var(--muted)]" />
              </div>
              <button onClick={confirmQuick} className="w-full bg-[var(--accent)] text-[var(--bg)] rounded-lg py-2 text-lg font-medium">Add transaction</button>
            </div>
          )}
        </>
      )}

      {mode === 'detailed' && (
        <form onSubmit={confirmDetailed}>
          <div className="flex gap-2 mb-2">
            <input type="number" placeholder="Amount" value={detail.amount || ''} onChange={(e) => setDetail({ ...detail, amount: parseFloat(e.target.value) || 0 })} className="w-24 bg-[var(--bg)]/40 border border-[var(--border)]/50 rounded-lg px-2 py-2 text-xl text-[var(--text)]" />
            <input placeholder="Description" value={detail.description} onChange={(e) => setDetail({ ...detail, description: e.target.value })} className="flex-1 bg-[var(--bg)]/40 border border-[var(--border)]/50 rounded-lg px-2 py-2 text-xl text-[var(--text)]" />
          </div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {categories.map((c) => (
              <span key={c} className={chip(detail.category === c)} style={{ padding: '4px 10px' }} onClick={() => setDetail({ ...detail, category: c })}>{c}</span>
            ))}
          </div>
          <div className="flex gap-2 mb-2">
            <span className={chip(detail.indulgence)} style={{ padding: '4px 10px' }} onClick={() => setDetail({ ...detail, indulgence: !detail.indulgence, essential: detail.indulgence })}>indulgence</span>
            <span className={chip(detail.essential)} style={{ padding: '4px 10px' }} onClick={() => setDetail({ ...detail, essential: !detail.essential, indulgence: detail.essential })}>essential</span>
          </div>
          <input type="date" value={detail.date} onChange={(e) => setDetail({ ...detail, date: e.target.value })} className="w-full bg-[var(--bg)]/40 border border-[var(--border)]/50 rounded-lg px-2 py-1.5 text-lg text-[var(--text)] mb-2" />
          <button type="submit" className="w-full bg-[var(--accent)] text-[var(--bg)] rounded-lg py-2 text-lg font-medium">Add transaction</button>
        </form>
      )}
    </div>
  );
}

function VoiceView({ categories, onBack, onAdd, onDone }: { categories: string[]; onBack: () => void; onAdd: (t: NewTransaction) => Promise<void>; onDone: (msg: string) => void }) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [preview, setPreview] = useState<{ amount: number; description: string; category: string; indulgence: boolean; date: string } | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const recRef = useRef<any>(null);

  function start() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setUnsupported(true); return; }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = 'en-IN';
    rec.onresult = (e: any) => {
      const text = Array.from(e.results).map((r: any) => r[0].transcript).join(' ');
      setTranscript(text);
    };
    rec.onend = () => {
      setListening(false);
      setTranscript((finalText) => {
        if (finalText.trim()) {
          const { amount, description, date } = parseQuickAdd(finalText);
          if (amount) {
            const guess = guessCategory(description) || { category: 'Other', indulgence: false };
            setPreview({ amount, description, category: guess.category, indulgence: guess.indulgence, date });
          }
        }
        return finalText;
      });
    };
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  function stop() { recRef.current?.stop(); }

  async function confirm() {
    if (!preview) return;
    await onAdd({
      amount: preview.amount, description: preview.description, category: preview.category,
      type: 'expense', indulgence: preview.indulgence, essential: !preview.indulgence,
      regret: false, tag: null, notes: null, date: preview.date, repeats: 'none',
    });
    onDone(`Added ${fmt(preview.amount)} · ${preview.description}`);
  }

  return (
    <div className="p-5">
      <BackHeader label="Voice" onBack={onBack} />
      {unsupported && (
        <p className="text-lg text-[var(--muted)] mt-2">Voice input isn&apos;t supported in this browser — it works in Chrome and Edge, not Firefox or Safari on some platforms.</p>
      )}
      {!unsupported && !preview && (
        <div className="text-center py-3">
          <button
            onClick={listening ? stop : start}
            className="w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-2"
            style={{ background: 'var(--accent)', boxShadow: listening ? '0 0 0 8px color-mix(in srgb, var(--accent), transparent 85%)' : 'none' }}
          >
            <IconMicrophone size={32} className="text-[var(--bg)]" />
          </button>
          <p className="text-lg text-[var(--muted)]">{listening ? (transcript || 'Listening…') : 'Tap to speak'}</p>
        </div>
      )}
      {preview && (
        <div className="bg-[var(--bg)]/30 rounded-lg p-4 mt-2">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[22px] font-semibold text-[var(--text)]">{fmt(preview.amount)}</span>
            <input value={preview.description} onChange={(e) => setPreview({ ...preview, description: e.target.value })} className="flex-1 bg-[var(--surface)] border border-[var(--border)]/40 rounded px-2 py-1 text-lg text-[var(--text)]" />
          </div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {categories.map((c) => (
              <span key={c} className={chip(preview.category === c)} style={{ padding: '4px 10px' }} onClick={() => setPreview({ ...preview, category: c })}>{c}</span>
            ))}
          </div>
          <button onClick={confirm} className="w-full bg-[var(--accent)] text-[var(--bg)] rounded-lg py-2 text-lg font-medium">Add transaction</button>
        </div>
      )}
    </div>
  );
}

function SmsView({ categories, onBack, onBulkAdd, onDone }: { categories: string[]; onBack: () => void; onBulkAdd: (items: NewTransaction[]) => Promise<void>; onDone: (msg: string) => void }) {
  const [text, setText] = useState('');
  const [candidates, setCandidates] = useState<{ amount: number; description: string; date: string; category: string; indulgence: boolean; selected: boolean }[] | null>(null);
  const [csvData, setCsvData] = useState<CsvParseResult | null>(null);
  const [mapDate, setMapDate] = useState(0);
  const [mapDesc, setMapDesc] = useState(0);
  const [mapAmount, setMapAmount] = useState(0);
  const [csvError, setCsvError] = useState('');
  const csvFileRef = useRef<HTMLInputElement>(null);

  function toReviewable(found: { amount: number; description: string; date: string }[]) {
    setCandidates(found.map((c) => {
      const guess = guessCategory(c.description) || { category: 'Other', indulgence: false };
      return { ...c, category: guess.category, indulgence: guess.indulgence, selected: true };
    }));
  }

  function parse() {
    toReviewable(parseBulkText(text));
  }

  async function handleCsvFile(file: File) {
    setCsvError('');
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.headers.length < 2 || parsed.rows.length === 0) {
      setCsvError('Could not read that as a CSV file.');
      return;
    }
    const auto = autoDetectCsvColumns(parsed.headers);
    if (auto) {
      const found = candidatesFromCsv(parsed, auto);
      if (found.length === 0) {
        setCsvError('No spend transactions found — columns were detected, but no matching rows.');
        return;
      }
      toReviewable(found);
    } else {
      // Couldn't confidently auto-detect — show the manual mapping step.
      setMapDate(0);
      setMapDesc(Math.min(1, parsed.headers.length - 1));
      setMapAmount(Math.min(2, parsed.headers.length - 1));
      setCsvData(parsed);
    }
  }

  function confirmMapping() {
    if (!csvData) return;
    const map: CsvColumnMap = { dateCol: mapDate, descCol: mapDesc, amountCol: mapAmount };
    const found = candidatesFromCsv(csvData, map, true);
    setCsvData(null);
    toReviewable(found);
  }

  async function confirm() {
    if (!candidates) return;
    const items = candidates.filter((c) => c.selected).map((c) => ({
      amount: c.amount, description: c.description, category: c.category, type: 'expense' as const,
      indulgence: c.indulgence, essential: !c.indulgence, regret: false, tag: null, notes: null, date: c.date, repeats: 'none' as const,
    }));
    await onBulkAdd(items);
    onDone(`Added ${items.length} transaction${items.length === 1 ? '' : 's'}`);
  }

  const selectedCount = candidates?.filter((c) => c.selected).length || 0;

  return (
    <div className="p-5">
      <BackHeader label="SMS, WhatsApp, or statement" onBack={onBack} />

      {!candidates && !csvData && (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste a thread — each message becomes a reviewable transaction"
            rows={4}
            className="w-full bg-[var(--bg)]/40 border border-[var(--border)]/50 rounded-lg px-3 py-2 text-lg text-[var(--text)] placeholder:text-[var(--muted)] mb-2"
          />
          <button onClick={parse} disabled={!text.trim()} className="w-full bg-[var(--accent)] text-[var(--bg)] rounded-lg py-2 text-lg font-medium disabled:opacity-50 mb-3">Parse thread</button>

          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 h-px bg-[var(--border)]/30" />
            <span className="text-[15px] text-[var(--muted)]">or</span>
            <div className="flex-1 h-px bg-[var(--border)]/30" />
          </div>

          <input ref={csvFileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleCsvFile(e.target.files[0])} />
          <button onClick={() => csvFileRef.current?.click()} className="w-full flex items-center justify-center gap-2 border border-dashed border-[var(--accent)]/40 rounded-lg py-2.5 text-lg font-medium text-[var(--text)]">
            <IconFileSpreadsheet size={20} className="text-[var(--accent)]" />
            Upload a bank or UPI statement (CSV)
          </button>
          {csvError && <p className="text-[17px] text-[var(--danger)] mt-2">{csvError}</p>}
        </>
      )}

      {csvData && !candidates && (
        <div>
          <p className="text-lg text-[var(--text)] font-medium mb-1">Couldn&apos;t auto-detect columns</p>
          <p className="text-[17px] text-[var(--muted)] mb-3">Match your statement&apos;s columns once — Expensior will recognize this format going forward.</p>

          <label className="text-[15px] text-[var(--muted)] block mb-1">Date column</label>
          <select value={mapDate} onChange={(e) => setMapDate(parseInt(e.target.value))} className="w-full bg-[var(--bg)]/40 border border-[var(--border)]/50 rounded-lg px-2 py-1.5 text-lg text-[var(--text)] mb-2">
            {csvData.headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
          </select>

          <label className="text-[15px] text-[var(--muted)] block mb-1">Description column</label>
          <select value={mapDesc} onChange={(e) => setMapDesc(parseInt(e.target.value))} className="w-full bg-[var(--bg)]/40 border border-[var(--border)]/50 rounded-lg px-2 py-1.5 text-lg text-[var(--text)] mb-2">
            {csvData.headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
          </select>

          <label className="text-[15px] text-[var(--muted)] block mb-1">Amount column (debit or signed amount)</label>
          <select value={mapAmount} onChange={(e) => setMapAmount(parseInt(e.target.value))} className="w-full bg-[var(--bg)]/40 border border-[var(--border)]/50 rounded-lg px-2 py-1.5 text-lg text-[var(--text)] mb-3">
            {csvData.headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
          </select>

          <div className="flex gap-2">
            <button onClick={confirmMapping} className="flex-1 bg-[var(--accent)] text-[var(--bg)] rounded-lg py-2 text-lg font-medium">Continue</button>
            <button onClick={() => setCsvData(null)} className="border border-[var(--border)]/70 text-[var(--muted)] rounded-lg px-3 text-lg">Cancel</button>
          </div>
        </div>
      )}

      {candidates && (
        <>
          {candidates.length === 0 && <p className="text-lg text-[var(--muted)]">No amounts found.</p>}
          <div className="flex flex-col gap-1.5 mb-2 max-h-[340px] overflow-auto">
            {candidates.map((c, i) => (
              <label key={i} className="flex items-center gap-2 bg-[var(--bg)]/30 rounded-lg px-2.5 py-2 cursor-pointer">
                <input type="checkbox" checked={c.selected} onChange={() => setCandidates(candidates.map((x, j) => j === i ? { ...x, selected: !x.selected } : x))} />
                <div className="flex-1 min-w-0">
                  <p className="text-lg text-[var(--text)] truncate">{c.description}</p>
                  <p className="text-[15px] text-[var(--muted)]">{c.date} · {c.category}</p>
                </div>
                <span className="text-lg font-medium text-[var(--text)] shrink-0">{fmt(c.amount)}</span>
              </label>
            ))}
          </div>
          {candidates.length > 0 && (
            <button onClick={confirm} disabled={selectedCount === 0} className="w-full bg-[var(--accent)] text-[var(--bg)] rounded-lg py-2 text-lg font-medium disabled:opacity-50">
              Add {selectedCount} transaction{selectedCount === 1 ? '' : 's'}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function ScanView({ categories, hasApiKey, onBack, onAdd, onDone }: { categories: string[]; hasApiKey: boolean; onBack: () => void; onAdd: (t: NewTransaction) => Promise<void>; onDone: (msg: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{ amount: number; description: string; category: string; indulgence: boolean; date: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!hasApiKey) {
    return (
      <div className="p-5">
        <BackHeader label="Scan" onBack={onBack} />
        <div className="flex items-center gap-2 mb-2 mt-1">
          <IconLock size={18} className="text-[var(--muted)]" />
          <p className="text-lg font-medium text-[var(--text)]">Needs a Claude API key</p>
        </div>
        <p className="text-[17px] text-[var(--muted)] leading-relaxed">
          Scan reads receipts using Claude&apos;s vision — add a free API key in Settings → API and parsing to turn this on. Everything else in Add Expense works without one.
        </p>
      </div>
    );
  }

  async function handleFile(file: File) {
    setLoading(true);
    setError('');
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mediaType: file.type }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not read that image.'); setLoading(false); return; }
      if (!data.amount) { setError('Could not find an amount in that image — try Type instead.'); setLoading(false); return; }
      const guess = guessCategory(data.merchant) || { category: 'Other', indulgence: false };
      setPreview({ amount: data.amount, description: data.merchant, category: guess.category, indulgence: guess.indulgence, date: data.date || todayStr() });
    } catch {
      setError('Something went wrong reading that image.');
    }
    setLoading(false);
  }

  async function confirm() {
    if (!preview) return;
    await onAdd({
      amount: preview.amount, description: preview.description, category: preview.category,
      type: 'expense', indulgence: preview.indulgence, essential: !preview.indulgence,
      regret: false, tag: null, notes: null, date: preview.date, repeats: 'none',
    });
    onDone(`Added ${fmt(preview.amount)} · ${preview.description}`);
  }

  return (
    <div className="p-5">
      <BackHeader label="Scan" onBack={onBack} />
      {!preview && (
        <div
          onClick={() => fileRef.current?.click()}
          className="border border-dashed border-[var(--accent)]/40 rounded-lg p-8 text-center cursor-pointer mt-1"
        >
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          {loading ? (
            <p className="text-lg text-[var(--muted)]">Reading image…</p>
          ) : (
            <>
              <IconScan size={26} className="text-[var(--accent)] mx-auto mb-1.5" />
              <p className="text-lg font-medium text-[var(--text)]">Tap to upload a photo</p>
              <p className="text-[15px] text-[var(--muted)] mt-1">Receipt, invoice, or order screenshot</p>
            </>
          )}
          {error && <p className="text-[17px] text-[var(--danger)] mt-2">{error}</p>}
        </div>
      )}
      {preview && (
        <div className="bg-[var(--bg)]/30 rounded-lg p-4 mt-1">
          <div className="flex items-center gap-2 mb-2">
            <IconReceipt size={22} className="text-[var(--accent)]" />
            <span className="text-[22px] font-semibold text-[var(--text)]">{fmt(preview.amount)}</span>
          </div>
          <input value={preview.description} onChange={(e) => setPreview({ ...preview, description: e.target.value })} className="w-full bg-[var(--surface)] border border-[var(--border)]/40 rounded px-2 py-1.5 text-lg text-[var(--text)] mb-2" />
          <div className="flex flex-wrap gap-1.5 mb-2">
            {categories.map((c) => (
              <span key={c} className={chip(preview.category === c)} style={{ padding: '4px 10px' }} onClick={() => setPreview({ ...preview, category: c })}>{c}</span>
            ))}
          </div>
          <button onClick={confirm} className="w-full bg-[var(--accent)] text-[var(--bg)] rounded-lg py-2 text-lg font-medium">Add transaction</button>
        </div>
      )}
    </div>
  );
}

function GmailView({
  connected, categories, onBack, onBulkAdd, onDone,
}: {
  connected: boolean;
  categories: string[];
  onBack: () => void;
  onBulkAdd: (items: NewTransaction[]) => Promise<void>;
  onDone: (msg: string) => void;
}) {
  const [connecting, setConnecting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [candidates, setCandidates] = useState<{ amount: number; description: string; date: string; category: string; indulgence: boolean; selected: boolean }[] | null>(null);

  async function connect() {
    setConnecting(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/gmail.readonly',
        redirectTo: `${location.origin}/auth/gmail-callback`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
  }

  async function scan() {
    setScanning(true);
    setError('');
    try {
      const res = await fetch('/api/gmail-scan', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not scan Gmail.'); setScanning(false); return; }
      setCandidates((data.candidates || []).map((c: any) => {
        const guess = guessCategory(c.description) || { category: 'Other', indulgence: false };
        return { ...c, category: guess.category, indulgence: guess.indulgence, selected: true };
      }));
    } catch {
      setError('Something went wrong reaching Gmail.');
    }
    setScanning(false);
  }

  async function confirm() {
    if (!candidates) return;
    const items = candidates.filter((c) => c.selected).map((c) => ({
      amount: c.amount, description: c.description, category: c.category, type: 'expense' as const,
      indulgence: c.indulgence, essential: !c.indulgence, regret: false, tag: null, notes: null, date: c.date, repeats: 'none' as const,
    }));
    await onBulkAdd(items);
    onDone(`Added ${items.length} transaction${items.length === 1 ? '' : 's'}`);
  }

  const selectedCount = candidates?.filter((c) => c.selected).length || 0;

  if (!connected) {
    return (
      <div className="p-5">
        <BackHeader label="Gmail" onBack={onBack} />
        <div className="flex items-center gap-2 mb-2 mt-1">
          <IconMail size={22} className="text-[var(--accent)]" />
          <p className="text-lg font-medium text-[var(--text)]">Not connected yet</p>
        </div>
        <p className="text-[17px] text-[var(--muted)] leading-relaxed mb-3">
          Read-only access — this app can search for receipts and order confirmations, never send, delete, or modify anything.
        </p>
        <button onClick={connect} disabled={connecting} className="w-full bg-[var(--accent)] text-[var(--bg)] rounded-lg py-2 text-lg font-medium disabled:opacity-60">
          {connecting ? 'Redirecting…' : 'Connect Gmail'}
        </button>
      </div>
    );
  }

  return (
    <div className="p-5">
      <BackHeader label="Gmail" onBack={onBack} />
      {!candidates && (
        <div className="mt-1">
          <p className="text-[17px] text-[var(--muted)] mb-2">Connected. Scans the last 30 days for receipts and order confirmations.</p>
          <button onClick={scan} disabled={scanning} className="w-full bg-[var(--accent)] text-[var(--bg)] rounded-lg py-2 text-lg font-medium disabled:opacity-60">
            {scanning ? 'Scanning…' : 'Scan inbox'}
          </button>
          {error && <p className="text-[17px] text-[var(--danger)] mt-2">{error}</p>}
        </div>
      )}
      {candidates && (
        <>
          {candidates.length === 0 && <p className="text-lg text-[var(--muted)]">No receipt-like emails found in the last 30 days.</p>}
          <div className="flex flex-col gap-1.5 mb-2 max-h-[340px] overflow-auto">
            {candidates.map((c, i) => (
              <label key={i} className="flex items-center gap-2 bg-[var(--bg)]/30 rounded-lg px-2.5 py-2 cursor-pointer">
                <input type="checkbox" checked={c.selected} onChange={() => setCandidates(candidates.map((x, j) => j === i ? { ...x, selected: !x.selected } : x))} />
                <div className="flex-1 min-w-0">
                  <p className="text-lg text-[var(--text)] truncate">{c.description}</p>
                  <p className="text-[15px] text-[var(--muted)]">{c.date} · {c.category}</p>
                </div>
                <span className="text-lg font-medium text-[var(--text)] shrink-0">{fmt(c.amount)}</span>
              </label>
            ))}
          </div>
          {candidates.length > 0 && (
            <button onClick={confirm} disabled={selectedCount === 0} className="w-full bg-[var(--accent)] text-[var(--bg)] rounded-lg py-2 text-lg font-medium disabled:opacity-50">
              Add {selectedCount} transaction{selectedCount === 1 ? '' : 's'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
