import { NextRequest, NextResponse } from 'next/server';
import { BAGS_API_BASE, BAGS_ENDPOINTS } from '@/lib/constants';
import { computeConvictionScores } from '@/lib/conviction';
import { ClaimEvent, BagsApiResponse, ClaimEventsResponse, TokenHolder } from '@/lib/types';
import { getCached, setCache } from '@/lib/cache';

const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function getHeliusRpc(): string {
  const key = process.env.HELIUS_API_KEY;
  if (key) return `https://mainnet.helius-rpc.com/?api-key=${key}`;
  return 'https://api.mainnet-beta.solana.com';
}

interface DashboardData {
  token: {
    mint: string;
    name: string;
    symbol: string;
    description: string;
    image: string;
    decimals: number;
  };
  creators: unknown[];
  lifetimeFees: string;
  claimStats: unknown[];
  pool: unknown | null;
  scores: unknown[];
  totalSupporters: number;
  totalHolders: number;
}

/** Fetch on-chain token metadata + decimals via Helius */
async function fetchTokenMeta(mint: string, rpc: string) {
  const res = await fetch(rpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getAsset', params: { id: mint } }),
  });
  const json = await res.json();
  const result = json.result;
  if (!result) return null;

  const metadata = result.content?.metadata || {};
  const links = result.content?.links || {};
  const files = result.content?.files || [];
  const decimals = result.token_info?.decimals ?? 9;

  return {
    name: metadata.name || '',
    symbol: metadata.symbol || '',
    description: metadata.description || '',
    image: links.image || files[0]?.uri || '',
    decimals,
  };
}

/** Fetch all token holders via DAS getTokenAccounts */
async function fetchHolders(mint: string, rpc: string): Promise<TokenHolder[]> {
  const holders: TokenHolder[] = [];
  let cursor: string | undefined;

  while (true) {
    const params: Record<string, unknown> = { mint, limit: 1000 };
    if (cursor) params.cursor = cursor;

    const res = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTokenAccounts', params }),
    });

    const json = await res.json();
    const result = json.result;
    if (!result?.token_accounts) break;

    for (const acc of result.token_accounts) {
      if (acc.amount > 0) {
        holders.push({ wallet: acc.owner, balance: acc.amount, tokenAccount: acc.address });
      }
    }

    if (!result.cursor || result.token_accounts.length < 1000) break;
    cursor = result.cursor;
    if (holders.length >= 10000) break;
  }

  return holders;
}

/** Bags API helper */
async function bagsFetch<T>(path: string, query: Record<string, string>, apiKey: string): Promise<T | null> {
  const params = new URLSearchParams(query).toString();
  const url = `${BAGS_API_BASE}${path}?${params}`;
  try {
    const res = await fetch(url, { headers: { 'x-api-key': apiKey } });
    if (!res.ok) return null;
    const json: BagsApiResponse<T> = await res.json();
    if (!json.success) return null;
    return json.response;
  } catch {
    return null;
  }
}

/** Fetch all claim events (paginated) */
async function fetchAllClaimEvents(mint: string, apiKey: string): Promise<ClaimEvent[]> {
  const all: ClaimEvent[] = [];
  let offset = 0;

  while (true) {
    const data = await bagsFetch<ClaimEventsResponse>(
      BAGS_ENDPOINTS.CLAIM_EVENTS,
      { tokenMint: mint, mode: 'offset', offset: String(offset), limit: '100' },
      apiKey
    );
    const events = data?.events || [];
    all.push(...events);
    if (events.length < 100) break;
    offset += 100;
    if (offset > 5000) break;
  }

  return all;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mint: string }> }
) {
  const { mint } = await params;
  const forceRefresh = request.nextUrl.searchParams.get('refresh') === '1';

  // Check cache
  const cacheKey = `dashboard:${mint}`;
  if (!forceRefresh) {
    const cached = getCached<DashboardData>(cacheKey);
    if (cached) {
      return NextResponse.json({ ...cached, cached: true });
    }
  }

  const apiKey = process.env.BAGS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  const rpc = getHeliusRpc();

  // Fetch everything in parallel (1 RPC call for metadata, N for holders, 4 Bags calls)
  const [tokenMeta, holders, claimEvents, creators, lifetimeFees, claimStats, pool] = await Promise.all([
    fetchTokenMeta(mint, rpc),
    fetchHolders(mint, rpc),
    fetchAllClaimEvents(mint, apiKey),
    bagsFetch<unknown[]>(BAGS_ENDPOINTS.TOKEN_CREATORS, { tokenMint: mint }, apiKey),
    bagsFetch<string>(BAGS_ENDPOINTS.TOKEN_LIFETIME_FEES, { tokenMint: mint }, apiKey),
    bagsFetch<unknown[]>(BAGS_ENDPOINTS.TOKEN_CLAIM_STATS, { tokenMint: mint }, apiKey),
    bagsFetch<unknown>(BAGS_ENDPOINTS.POOL_BY_MINT, { tokenMint: mint }, apiKey),
  ]);

  const decimals = tokenMeta?.decimals ?? 9;
  const scores = computeConvictionScores(holders, claimEvents, decimals);

  const data: DashboardData = {
    token: {
      mint,
      name: tokenMeta?.name || '',
      symbol: tokenMeta?.symbol || '',
      description: tokenMeta?.description || '',
      image: tokenMeta?.image || '',
      decimals,
    },
    creators: creators || [],
    lifetimeFees: (lifetimeFees as string) || '0',
    claimStats: claimStats || [],
    pool: pool || null,
    scores,
    totalSupporters: scores.length,
    totalHolders: holders.length,
  };

  // Cache the result
  setCache(cacheKey, data, CACHE_TTL);

  return NextResponse.json({ ...data, cached: false });
}
