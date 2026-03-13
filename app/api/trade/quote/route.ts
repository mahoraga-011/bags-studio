import { NextRequest, NextResponse } from 'next/server';
import { getTradeQuote } from '@/lib/bags-wrapper';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const inputMint = searchParams.get('inputMint');
  const outputMint = searchParams.get('outputMint');
  const amount = searchParams.get('amount');
  const slippageBps = searchParams.get('slippageBps') || undefined;

  if (!inputMint || !outputMint || !amount) {
    return NextResponse.json({ error: 'Missing required params: inputMint, outputMint, amount' }, { status: 400 });
  }

  try {
    const quote = await getTradeQuote({ inputMint, outputMint, amount, slippageBps });
    return NextResponse.json(quote);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get trade quote';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
