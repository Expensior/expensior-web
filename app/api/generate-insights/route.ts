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
        max_tokens: 1024,
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

Write 2 to 3 short insight cards. Each finds a SPECIFIC pattern connecting at least two of these dimensions together (e.g. a day-of-week AND a category, or a category AND its indulgence rate) -- not a single flat number restated. Only surface a pattern if the data actually shows one; if nothing stands out in a dimension, leave it out rather than inventing something. All amounts in the data are Indian Rupees -- if you mention a number, format it as ₹ (e.g. ₹2,109), never $ or USD.

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

    // Robust extraction: pull out the [...] substring rather than trusting the
    // WHOLE response is pure JSON. Claude can add a stray word of preamble
    // despite instructions, or the response can get cut off mid-array by the
    // token cap -- either would break a naive JSON.parse on the full string.
    const arrayMatch = textBlock.match(/\[[\s\S]*\]/);
    if (!arrayMatch) {
      console.error('Insights: no JSON array found in response:', textBlock);
      return NextResponse.json({ error: 'Could not read the insights response — try again.' }, { status: 502 });
    }

    let cards: any[];
    try {
      cards = JSON.parse(arrayMatch[0]);
    } catch (parseErr) {
      console.error('Insights: JSON parse failed. Raw text:', textBlock, 'Parse error:', parseErr);
      return NextResponse.json({ error: 'Could not read the insights response — try again.' }, { status: 502 });
    }

    // Filter out any malformed entries rather than failing the whole batch over one bad card.
    const validCards = (Array.isArray(cards) ? cards : []).filter(
      (c) => c && typeof c.title === 'string' && typeof c.body === 'string' && c.title.trim() && c.body.trim()
    );

    if (validCards.length === 0) {
      return NextResponse.json({ error: 'Could not generate insights from your data yet.' }, { status: 502 });
    }

    await supabase.from('insights').upsert({ user_id: user.id, cards: validCards, generated_at: new Date().toISOString() });

    return NextResponse.json({ cards: validCards });
  } catch (err) {
    console.error('Insights generation failed:', err);
    return NextResponse.json({ error: 'Something went wrong generating insights.' }, { status: 500 });
  }
}
