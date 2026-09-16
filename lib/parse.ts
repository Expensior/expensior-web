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

  // "7 sept" / "7 september" / "sept 7"
  const monthNames = Object.keys(MONTHS).join('|');
  const dayMonth = text.match(new RegExp(`\\b(\\d{1,2})\\s+(${monthNames})\\b`, 'i'));
  const monthDay = text.match(new RegExp(`\\b(${monthNames})\\s+(\\d{1,2})\\b`, 'i'));
  const match = dayMonth || monthDay;
  if (match) {
    const day = parseInt(dayMonth ? match[1] : match[2]);
    const monthKey = (dayMonth ? match[2] : match[1]).toLowerCase();
    const month = MONTHS[monthKey];
    const d = new Date(new Date().getFullYear(), month, day);
    return { date: ymd(d), remaining: text.replace(match[0], '').trim() };
  }

  return { date: null, remaining: text };
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

export function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
