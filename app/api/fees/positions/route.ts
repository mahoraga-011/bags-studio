import { NextRequest, NextResponse } from 'next/server';
import { getClaimablePositions } from '@/lib/bags-wrapper';

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet');

  if (!wallet) {
    return NextResponse.json({ error: 'Missing required param: wallet' }, { status: 400 });
  }

  try {
    const positions = await getClaimablePositions(wallet);
    return NextResponse.json({ positions });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get claimable positions';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
