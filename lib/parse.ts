const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8,
  september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function extractDate(text: string): { date: string | null; remaining: string } {
  const lower = text.toLowerCase();

  if (/\byesterday\b/.test(lower)) {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return { date: ymd(d), remaining: text.replace(/\byesterday\b/i, '').trim() };
  }
  if (/\btoday\b/.test(lower)) {
    return { date: ymd(new Date()), remaining: text.replace(/\btoday\b/i, '').trim() };
  }

  // DD/MM or DD-MM(-YYYY)
  const slash = text.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
  if (slash) {
    const day = parseInt(slash[1]);
    const month = parseInt(slash[2]) - 1;
    const year = slash[3] ? (slash[3].length === 2 ? 2000 + parseInt(slash[3]) : parseInt(slash[3])) : new Date().getFullYear();
    if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
      const d = new Date(year, month, day);
      return { date: ymd(d), remaining: text.replace(slash[0], '').trim() };
    }
  }

  // "7 sept" / "7 september" / "sept 7" / "7-Sep-2026" / "7/Sep/2026"
  const monthNames = Object.keys(MONTHS).join('|');
  const sep = '[\\s\\-\\/,]+';
  const dayMonth = text.match(new RegExp(`\\b(\\d{1,2})${sep}(${monthNames})(?:${sep}(\\d{2,4}))?\\b`, 'i'));
  const monthDay = text.match(new RegExp(`\\b(${monthNames})${sep}(\\d{1,2})(?:${sep}(\\d{2,4}))?\\b`, 'i'));
  const match = dayMonth || monthDay;
  if (match) {
    const day = parseInt(dayMonth ? match[1] : match[2]);
    const monthKey = (dayMonth ? match[2] : match[1]).toLowerCase();
    const yearMatch = match[3];
    const year = yearMatch ? (yearMatch.length === 2 ? 2000 + parseInt(yearMatch) : parseInt(yearMatch)) : new Date().getFullYear();
    const month = MONTHS[monthKey];
    const d = new Date(year, month, day);
    return { date: ymd(d), remaining: text.replace(match[0], '').trim() };
  }

  return { date: null, remaining: text };
}

// For low-trust sources (arbitrary email text, not something the person
// typed as an expense) — requires an explicit currency marker next to the
// number. No bare-number fallback, since most numbers in an email aren't
// amounts at all (dates, tracking IDs, "3 months free", "MD5", etc).
export function extractAmountStrict(text: string): number | null {
  const patterns = [
    /(?:₹|rs\.?\s*|inr\s*)([0-9,]+(?:\.[0-9]{1,2})?)/i,
    /([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:₹|rs\.?|inr)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const amount = parseFloat(m[1].replace(/,/g, ''));
      // Sanity bound — a personal expense in the tens of lakhs is almost
      // certainly a mis-parsed tracking number, phone number, or account ID.
      if (amount > 0 && amount <= 200000) return amount;
    }
  }
  return null;
}

export function parseQuickAdd(text: string): { amount: number | null; description: string; date: string } {
  const raw = text.trim();
  const { date, remaining: afterDate } = extractDate(raw);

  const patterns = [
    /(?:₹|rs\.?\s*|inr\s*)([0-9,]+(?:\.[0-9]{1,2})?)/i,
    /([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:₹|rs\.?|inr)/i,
    /([0-9,]+(?:\.[0-9]{1,2})?)/,
  ];

  let amount: number | null = null;
  let remaining = afterDate;

  for (const p of patterns) {
    const m = remaining.match(p);
    if (m) {
      amount = parseFloat(m[1].replace(/,/g, ''));
      remaining = remaining.replace(m[0], '').trim().replace(/^[-:,.]\s*/, '');
      break;
    }
  }

  return { amount, description: remaining || raw, date: date || todayStr() };
}

export function fmt(n: number): string {
  return '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export interface BulkCandidate {
  amount: number;
  description: string;
  date: string;
}

export function parseBulkText(text: string): BulkCandidate[] {
  let blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  if (blocks.length <= 1) {
    blocks = text.split('\n').map((b) => b.trim()).filter(Boolean);
  }

  const candidates: BulkCandidate[] = [];
  for (const block of blocks) {
    const { amount, description, date } = parseQuickAdd(block);
    if (amount && amount > 0) {
      const cleaned = extractMerchantDescription(description) || description;
      candidates.push({ amount, description: cleaned.slice(0, 80) || 'Transaction', date });
    }
  }
  return candidates;
}

export function parseFlexibleDate(raw: string): string {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const { date } = extractDate(trimmed);
  if (date) return date;

  return todayStr();
}

export interface CsvParseResult {
  headers: string[];
  rows: string[][];
}

export function parseCsv(text: string): CsvParseResult {
  const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
  const parseLine = (line: string): string[] => {
    const cells: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        cells.push(cur); cur = '';
      } else {
        cur += ch;
      }
    }
    cells.push(cur);
    return cells.map((c) => c.trim());
  };

  const [headerLine, ...rest] = lines;
  return { headers: headerLine ? parseLine(headerLine) : [], rows: rest.map(parseLine) };
}

function findColumn(headers: string[], keywords: string[]): number {
  const lower = headers.map((h) => h.toLowerCase());
  for (const kw of keywords) {
    const idx = lower.findIndex((h) => h.includes(kw));
    if (idx !== -1) return idx;
  }
  return -1;
}

export interface CsvColumnMap {
  dateCol: number;
  descCol: number;
  amountCol: number; // single signed amount, or debit column
  creditCol?: number; // if separate credit column exists (skipped as income)
  isDedicatedDebitColumn?: boolean; // true if matched via "debit"/"withdrawal" — values are always positive spends, no sign to check
}

export function autoDetectCsvColumns(headers: string[]): CsvColumnMap | null {
  const dateCol = findColumn(headers, ['date']);
  const descCol = findColumn(headers, ['narration', 'description', 'particulars', 'details', 'remarks']);
  const debitCol = findColumn(headers, ['debit', 'withdrawal']);
  const creditCol = findColumn(headers, ['credit', 'deposit']);
  const amountCol = findColumn(headers, ['amount', 'amt']);

  if (dateCol === -1 || descCol === -1) return null;
  if (debitCol !== -1) return { dateCol, descCol, amountCol: debitCol, creditCol: creditCol !== -1 ? creditCol : undefined, isDedicatedDebitColumn: true };
  if (amountCol !== -1) return { dateCol, descCol, amountCol };
  return null;
}

export function candidatesFromCsv(csv: CsvParseResult, map: CsvColumnMap, trustAllRows = false): BulkCandidate[] {
  const candidates: BulkCandidate[] = [];
  for (const row of csv.rows) {
    const dateRaw = row[map.dateCol];
    const descRaw = row[map.descCol];
    const amountRaw = row[map.amountCol];
    if (!amountRaw) continue;

    const cleaned = amountRaw.replace(/[₹,\s]/g, '');
    const num = parseFloat(cleaned);
    if (!num || isNaN(num)) continue;

    // A dedicated debit column, or manual confirmation, means every value here is a spend
    // (debit columns are conventionally positive — there's no sign to check).
    // Otherwise (a generic signed "amount" column): negative = spend, positive = skip (assumed income).
    let finalAmount: number | null = null;
    if (trustAllRows || map.isDedicatedDebitColumn) {
      finalAmount = Math.abs(num);
    } else if (num < 0) {
      finalAmount = Math.abs(num);
    } else {
      continue;
    }

    if (!finalAmount) continue;
    candidates.push({
      amount: finalAmount,
      description: (descRaw || 'Transaction').slice(0, 80),
      date: parseFlexibleDate(dateRaw || ''),
    });
  }
  return candidates;
}

export function extractMerchantDescription(raw: string): string {
  const text = raw.trim();

  function stripTrailingPreposition(s: string): string {
    return s.replace(/\s+(on|at|to|for)\s*$/i, '').trim();
  }

  function titleCaseIfShouting(s: string): string {
    const cleaned = stripTrailingPreposition(s.replace(/[.,]+$/, ''));
    if (cleaned === cleaned.toUpperCase() && /[A-Z]/.test(cleaned)) {
      return cleaned.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return cleaned;
  }

  // Bank/UPI alerts put the merchant right before a date or the end of the
  // sentence — "...at MERCHANT on 14-Sep-26", "...to MERCHANT.", etc. If the
  // date was already stripped upstream (e.g. by parseQuickAdd), only a bare
  // trailing "on" remains — stripTrailingPreposition cleans that up too.
  // Take the LAST match of each preposition, since the merchant is usually
  // near the end (an earlier "at"/"to" might just be part of boilerplate).
  const prepositions = ['at', 'to', 'towards'];
  for (const prep of prepositions) {
    const re = new RegExp(`\\b${prep}\\s+([A-Za-z0-9][A-Za-z0-9&.,'\\-\\s]{1,40}?)(?=\\s+on\\s+\\d|\\s+on\\s+[A-Za-z]{3}|[.,]|$)`, 'gi');
    const matches = [...text.matchAll(re)];
    if (matches.length > 0) {
      const merchant = matches[matches.length - 1][1];
      if (merchant.trim().length > 1) return titleCaseIfShouting(merchant);
    }
  }

  // Bill payments / services: "...for Credit Card Bill Payment"
  const forMatch = text.match(/\bfor\s+([A-Za-z][A-Za-z\s]{2,40}?)(?:[.,]|$)/i);
  if (forMatch) return titleCaseIfShouting(forMatch[1]);

  // No recognizable pattern — return the raw text with dangling trailing
  // prepositions cleaned up (leftover from stripped amount/date fragments).
  return stripTrailingPreposition(text);
}

export function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
