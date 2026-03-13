import { NextRequest, NextResponse } from 'next/server';
import { createClaimTransactions } from '@/lib/bags-wrapper';

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { wallet, tokenMint } = body as { wallet: string; tokenMint: string };

  if (!wallet || !tokenMint) {
    return NextResponse.json({ error: 'Missing required fields: wallet, tokenMint' }, { status: 400 });
  }

  try {
    const response = await createClaimTransactions(wallet, tokenMint);
    return NextResponse.json({ transactions: response.transactions });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create claim transactions';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
