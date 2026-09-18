import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const { data: settings } = await supabase
    .from('settings')
    .select('claude_api_key')
    .eq('user_id', user.id)
    .maybeSingle();

  const apiKey = settings?.claude_api_key;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Add a Claude API key in Settings → API and parsing before scanning receipts.' },
      { status: 400 }
    );
  }

  const { imageBase64, mediaType } = await request.json();
  if (!imageBase64 || !mediaType) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 });
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
        model: 'claude-sonnet-5',
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
              {
                type: 'text',
                text: 'This is a receipt, invoice, or order confirmation screenshot. Read it and respond with ONLY a JSON object, no other text, no markdown fences: {"amount": <number, total amount paid, no currency symbol>, "merchant": "<merchant or store name>", "date": "<YYYY-MM-DD if visible, else null>"}. If you cannot find a clear total amount, set amount to null.',
              },
            ],
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text();
      console.error('Anthropic API error:', errBody);
      return NextResponse.json({ error: 'Could not reach the scanning service. Check your API key in Settings.' }, { status: 502 });
    }

    const data = await anthropicRes.json();
    const textBlock = data.content?.find((b: any) => b.type === 'text')?.text || '{}';
    const cleaned = textBlock.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json({
      amount: typeof parsed.amount === 'number' ? parsed.amount : null,
      merchant: parsed.merchant || 'Scanned receipt',
      date: parsed.date || null,
    });
  } catch (err: any) {
    console.error('Scan parsing failed:', err);
    return NextResponse.json({ error: 'Could not read that image. Try a clearer photo or enter it manually.' }, { status: 500 });
  }
}
