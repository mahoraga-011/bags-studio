import { NextRequest, NextResponse } from 'next/server';
import { createTokenInfo } from '@/lib/bags-wrapper';

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { image, name, symbol, description, twitter, telegram, website } = body as {
    image: string;
    name: string;
    symbol: string;
    description: string;
    twitter?: string;
    telegram?: string;
    website?: string;
  };

  if (!image || !name || !symbol || !description) {
    return NextResponse.json({ error: 'Missing required fields: image, name, symbol, description' }, { status: 400 });
  }

  try {
    const response = await createTokenInfo({ image, name, symbol, description, twitter, telegram, website });
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create token info';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
