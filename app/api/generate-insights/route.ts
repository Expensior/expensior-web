import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { buildInsightsSummary } from '@/lib/insightsSummary';
import type { Transaction } from '@/lib/types';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data: settings } = await supabase
    .from('settings')
    .select('claude_api_key')
    .eq('user_id', user.id)
    .maybeSingle();

  const apiKey = settings?.claude_api_key;
  if (!apiKey) {
    return NextResponse.json({ error: 'No Claude API key set' }, { status: 400 });
  }

  const { data: transactions } = await supabase
    .from('transactions')
    .select('amount, description, category, type, indulgence, essential, regret, date')
    .eq('user_id', user.id);

  if (!transactions || transactions.length < 8) {
    return NextResponse.json({ error: 'Not enough transaction history yet for meaningful insights.' }, { status: 400 });
  }

  const summary = buildInsightsSummary(transactions as Transaction[]);

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 700,
        messages: [
          {
            role: 'user',
            content: `You are writing short insight cards for a personal expense tracker called Expensior!. The app's whole philosophy is "awareness without guilt" -- every insight sentence in the rest of the app is observational and warm, never scolding, never implying the person did something wrong. Read this carefully because it matters more than anything else in this task.

Here is pre-aggregated data about this person's spending (already computed correctly -- do not recompute or second-guess the numbers, just interpret them):

Day-of-week x category spend totals: ${JSON.stringify(summary.dayCategoryTotals)}
Regret-tagged transaction counts by day: ${JSON.stringify(summary.dayRegretCounts)}
Indulgence rate by category (indulgentCount out of totalCount): ${JSON.stringify(summary.categoryIndulgenceRate)}
Month-over-month category spend deltas: ${JSON.stringify(summary.monthOverMonthDeltas)}
Most frequent merchants: ${JSON.stringify(summary.frequentMerchants)}

Write 2 to 3 short insight cards. Each finds a SPECIFIC pattern connecting at least two of these dimensions together (e.g. a day-of-week AND a category, or a category AND its indulgence rate) -- not a single flat number restated. Only surface a pattern if the data actually shows one; if nothing stands out in a dimension, leave it out rather than inventing something.

Tone rules, non-negotiable:
- Observational first: state the pattern as a fact you noticed, not a problem to fix.
- You may include ONE gentle, optional suggestion per card if it naturally fits -- phrase it as a soft possibility ("might be worth..."), never as an instruction ("you should...", "try to...", "cut back on...").
- Never use the words "overspending", "wasting", "bad", "guilty", or similar judgment-carrying language.
- Never scold, never imply a number is too high just because it's the biggest one -- big numbers aren't automatically a problem.
- Keep each card to 1-2 sentences.

Respond with ONLY a JSON array, no other text, no markdown fences: [{"title": "<short label, 3-5 words>", "body": "<the insight, 1-2 sentences>"}]`,
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const body = await anthropicRes.text();
      console.error('Anthropic insights error:', body);
      return NextResponse.json({ error: 'Could not reach the insights service.' }, { status: 502 });
    }

    const data = await anthropicRes.json();
    const textBlock = data.content?.find((b: any) => b.type === 'text')?.text || '[]';
    const cleaned = textBlock.replace(/```json|```/g, '').trim();
    const cards = JSON.parse(cleaned);

    if (!Array.isArray(cards) || cards.length === 0) {
      return NextResponse.json({ error: 'Could not generate insights from your data yet.' }, { status: 502 });
    }

    await supabase.from('insights').upsert({ user_id: user.id, cards, generated_at: new Date().toISOString() });

    return NextResponse.json({ cards });
  } catch (err) {
    console.error('Insights generation failed:', err);
    return NextResponse.json({ error: 'Something went wrong generating insights.' }, { status: 500 });
  }
}
