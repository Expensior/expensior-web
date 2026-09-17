import type { SupabaseClient } from '@supabase/supabase-js';

export function merchantKey(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function lookupGlobalMerchant(
  supabase: SupabaseClient,
  merchant: string
): Promise<{ category: string; indulgence: boolean } | null> {
  const key = merchantKey(merchant);
  if (!key) return null;
  const { data } = await supabase
    .from('global_merchant_patterns')
    .select('category, indulgence')
    .eq('merchant_key', key)
    .maybeSingle();
  return data ? { category: data.category, indulgence: data.indulgence } : null;
}

// Reinforces a mapping — if it already exists with the SAME category, bump
// confidence (more people agreeing). If someone contributes a DIFFERENT
// category, this simple version just overwrites it with confidence reset to
// 1 rather than trying to resolve disagreement — a real limitation, not a
// full voting system, but avoids silently ignoring corrections either.
export async function contributeGlobalMerchant(
  supabase: SupabaseClient,
  merchant: string,
  category: string,
  indulgence: boolean
): Promise<void> {
  const key = merchantKey(merchant);
  if (!key) return;

  const { data: existing } = await supabase
    .from('global_merchant_patterns')
    .select('category, confidence')
    .eq('merchant_key', key)
    .maybeSingle();

  if (existing && existing.category === category) {
    await supabase
      .from('global_merchant_patterns')
      .update({ confidence: existing.confidence + 1, updated_at: new Date().toISOString() })
      .eq('merchant_key', key);
  } else {
    await supabase
      .from('global_merchant_patterns')
      .upsert({ merchant_key: key, category, indulgence, confidence: 1, updated_at: new Date().toISOString() });
  }
}
