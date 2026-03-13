import { NextRequest, NextResponse } from 'next/server';
import { createLaunchTransaction } from '@/lib/bags-wrapper';

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { name, symbol, uri, initialBuyLamports, wallet } = body as {
    name: string;
    symbol: string;
    uri: string;
    initialBuyLamports?: number;
    wallet: string;
  };

  if (!name || !symbol || !uri || !wallet) {
    return NextResponse.json({ error: 'Missing required fields: name, symbol, uri, wallet' }, { status: 400 });
  }

  try {
    const response = await createLaunchTransaction({ name, symbol, uri, initialBuyLamports, wallet });
    return NextResponse.json({ transaction: response.transaction });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create launch transaction';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
