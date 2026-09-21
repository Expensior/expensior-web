export const DEFAULT_CATEGORIES = [
  'Food & dining', 'Groceries', 'Entertainment', 'Travel', 'Shopping',
  'Health & fitness', 'Rent & utilities', 'Subscriptions', 'Transport', 'Other',
];

export const CAT_COLORS: Record<string, string> = {
  'Food & dining': 'var(--cat-1)',
  'Groceries': 'var(--cat-2)',
  'Entertainment': 'var(--cat-3)',
  'Travel': 'var(--cat-4)',
  'Shopping': 'var(--cat-5)',
  'Health & fitness': 'var(--cat-1)',
  'Rent & utilities': 'var(--cat-2)',
  'Subscriptions': 'var(--cat-3)',
  'Transport': 'var(--cat-4)',
  'Other': 'var(--cat-5)',
};

// Parallel to CAT_COLORS — the correct text color (white or dark) for
// whichever cat-N a category maps to, computed per-theme since the same
// hardcoded white text was found to fail WCAG contrast against several
// category colors in several themes (46 of 77 real theme/background
// combinations failed when checked). See globals.css --on-cat-N variables.
export const ON_CAT_COLORS: Record<string, string> = {
  'Food & dining': 'var(--on-cat-1)',
  'Groceries': 'var(--on-cat-2)',
  'Entertainment': 'var(--on-cat-3)',
  'Travel': 'var(--on-cat-4)',
  'Shopping': 'var(--on-cat-5)',
  'Health & fitness': 'var(--on-cat-1)',
  'Rent & utilities': 'var(--on-cat-2)',
  'Subscriptions': 'var(--on-cat-3)',
  'Transport': 'var(--on-cat-4)',
  'Other': 'var(--on-cat-5)',
};

// Deduped — each merchant maps to exactly one entry. Merchants that
// genuinely span categories (Swiggy, Blinkit, Zepto) are handled by
// keyword hints checked first, not by a merchant-only lookup.
const KEYWORD_HINTS: { keywords: string[]; category: string; indulgence: boolean }[] = [
  { keywords: ['grocery', 'groceries', 'supermarket', 'kirana', 'vegetables', 'fruits', 'dmart', 'bigbasket', 'instamart'], category: 'Groceries', indulgence: false },
  { keywords: ['pharmacy', 'medical', 'medicine', 'chemist', 'hospital', 'clinic', 'diagnostic', 'apollo', 'medplus'], category: 'Health & fitness', indulgence: false },
  { keywords: ['electricity', 'water bill', 'gas bill', 'broadband', 'recharge', 'postpaid', 'prepaid', 'rent'], category: 'Rent & utilities', indulgence: false },
  { keywords: ['fuel', 'petrol', 'diesel', 'cng', 'parking', 'uber', 'ola', 'rapido'], category: 'Transport', indulgence: false },
  { keywords: ['restaurant', 'cafe', 'coffee', 'dining', 'lunch', 'dinner', 'biryani', 'pizza', 'food court'], category: 'Food & dining', indulgence: true },
  { keywords: ['netflix', 'spotify', 'hotstar', 'prime video', 'youtube premium'], category: 'Subscriptions', indulgence: true },
  { keywords: ['bookmyshow', 'pvr', 'inox', 'movie', 'concert'], category: 'Entertainment', indulgence: true },
  { keywords: ['makemytrip', 'irctc', 'goibibo', 'flight', 'hotel'], category: 'Travel', indulgence: false },
  { keywords: ['amazon', 'flipkart', 'myntra', 'ajio'], category: 'Shopping', indulgence: false },
];

const MERCHANT_ONLY_HINTS: Record<string, { category: string; indulgence: boolean }> = {
  swiggy: { category: 'Food & dining', indulgence: true },
  zomato: { category: 'Food & dining', indulgence: true },
  zepto: { category: 'Groceries', indulgence: false },
  blinkit: { category: 'Groceries', indulgence: false },
  netflix: { category: 'Subscriptions', indulgence: true },
  spotify: { category: 'Subscriptions', indulgence: true },
};

export function guessCategory(text: string): { category: string; indulgence: boolean } | null {
  const lower = text.toLowerCase();
  for (const hint of KEYWORD_HINTS) {
    if (hint.keywords.some((k) => lower.includes(k))) {
      return { category: hint.category, indulgence: hint.indulgence };
    }
  }
  for (const [merchant, info] of Object.entries(MERCHANT_ONLY_HINTS)) {
    if (lower.includes(merchant)) return info;
  }
  return null;
}
