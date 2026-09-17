import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
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

  const { merchant, categories } = await request.json();
  if (!merchant || !Array.isArray(categories) || categories.length === 0) {
    return NextResponse.json({ error: 'Missing merchant or categories' }, { status: 400 });
  }

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 150,
        messages: [
          {
            role: 'user',
            content: `A personal expense tracker needs to categorize a transaction from an unrecognized merchant: "${merchant}".

Pick the single best-fitting category from this exact list (respond with the category text exactly as written, no changes): ${categories.join(', ')}

Also decide if this is likely an "indulgence" (a discretionary treat — dining out, entertainment, shopping) versus not (groceries, bills, essentials, transport).

Respond with ONLY a JSON object, no other text, no markdown fences: {"category": "<one of the exact category strings above>", "indulgence": <true or false>}`,
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const body = await anthropicRes.text();
      console.error('Anthropic categorization error:', body);
      return NextResponse.json({ error: 'Could not reach the categorization service.' }, { status: 502 });
    }

    const data = await anthropicRes.json();
    const textBlock = data.content?.find((b: any) => b.type === 'text')?.text || '{}';
    const cleaned = textBlock.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (!categories.includes(parsed.category)) {
      return NextResponse.json({ error: 'Model returned an unrecognized category' }, { status: 502 });
    }

    return NextResponse.json({ category: parsed.category, indulgence: !!parsed.indulgence });
  } catch (err) {
    console.error('Categorization failed:', err);
    return NextResponse.json({ error: 'Something went wrong categorizing that merchant.' }, { status: 500 });
  }
}
