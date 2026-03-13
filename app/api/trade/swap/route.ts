import { NextRequest, NextResponse } from 'next/server';
import { createSwapTransaction } from '@/lib/bags-wrapper';

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { inputMint, outputMint, amount, slippageBps, wallet } = body as {
    inputMint: string;
    outputMint: string;
    amount: string;
    slippageBps?: number;
    wallet: string;
  };

  if (!inputMint || !outputMint || !amount || !wallet) {
    return NextResponse.json({ error: 'Missing required fields: inputMint, outputMint, amount, wallet' }, { status: 400 });
  }

  try {
    const response = await createSwapTransaction({ inputMint, outputMint, amount, slippageBps, wallet });
    return NextResponse.json({ transaction: response.transaction });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create swap transaction';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
