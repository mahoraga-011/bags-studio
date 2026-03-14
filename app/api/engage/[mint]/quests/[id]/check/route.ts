import { NextRequest, NextResponse } from 'next/server';
import { checkQuestCompletion } from '@/lib/quests';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ mint: string; id: string }> }
) {
  const { id } = await params;

  let body: { wallet: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.wallet) {
    return NextResponse.json({ error: 'wallet is required' }, { status: 400 });
  }

  try {
    const result = await checkQuestCompletion(id, body.wallet);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Quest check error:', err);
    return NextResponse.json({ error: 'Failed to check quest' }, { status: 500 });
  }
}
