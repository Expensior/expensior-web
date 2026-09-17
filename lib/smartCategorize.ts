import type { SupabaseClient } from '@supabase/supabase-js';
import { guessCategory } from './categories';
import { lookupGlobalMerchant, contributeGlobalMerchant } from './globalMerchants';

export interface CategoryGuess {
  category: string;
  indulgence: boolean;
  source: 'local' | 'global' | 'ai' | 'fallback';
}

// Tries, in order: local keyword/merchant hints (instant, free) -> shared
// crowd knowledge from other users (one DB read) -> Claude, only if the
// person has an API key set (Tier 3) -- and only this last step costs
// anything or takes real time, so it's the one worth skipping when a
// fast/free answer already exists.
export async function smartCategorize(
  supabase: SupabaseClient,
  merchant: string,
  categories: string[],
  hasApiKey: boolean
): Promise<CategoryGuess> {
  const local = guessCategory(merchant);
  if (local) return { ...local, source: 'local' };

  const global = await lookupGlobalMerchant(supabase, merchant);
  if (global) return { ...global, source: 'global' };

  if (hasApiKey) {
    try {
      const res = await fetch('/api/categorize-merchant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchant, categories }),
      });
      if (res.ok) {
        const data = await res.json();
        contributeGlobalMerchant(supabase, merchant, data.category, data.indulgence).catch(() => {});
        return { category: data.category, indulgence: data.indulgence, source: 'ai' };
      }
    } catch {
      // Fall through to the default below.
    }
  }

  return { category: categories[0] || 'Other', indulgence: false, source: 'fallback' };
}
