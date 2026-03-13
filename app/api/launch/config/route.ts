import { NextRequest, NextResponse } from 'next/server';
import { configureFeeShare } from '@/lib/bags-wrapper';

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { tokenMint, claimersArray } = body as {
    tokenMint: string;
    claimersArray: Array<{ wallet: string; bps: number }>;
  };

  if (!tokenMint || !Array.isArray(claimersArray) || claimersArray.length === 0) {
    return NextResponse.json({ error: 'Missing required fields: tokenMint, claimersArray' }, { status: 400 });
  }

  try {
    const response = await configureFeeShare({ tokenMint, claimersArray });
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to configure fee share';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
