import { NextRequest, NextResponse } from 'next/server';
import { addReaction, removeReaction } from '@/lib/community';
import { ALLOWED_REACTIONS } from '@/lib/constants';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ mint: string; postId: string }> }
) {
  const { postId } = await params;

  let body: { wallet: string; emoji: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.wallet || !body.emoji) {
    return NextResponse.json({ error: 'wallet and emoji are required' }, { status: 400 });
  }

  if (!ALLOWED_REACTIONS.includes(body.emoji as typeof ALLOWED_REACTIONS[number])) {
    return NextResponse.json({ error: 'Invalid reaction emoji' }, { status: 400 });
  }

  const ok = await addReaction(postId, body.wallet, body.emoji);
  return NextResponse.json({ ok });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ mint: string; postId: string }> }
) {
  const { postId } = await params;

  let body: { wallet: string; emoji: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const ok = await removeReaction(postId, body.wallet, body.emoji);
  return NextResponse.json({ ok });
}
