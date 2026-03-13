import { BAGS_API_BASE } from './constants';
import { BagsApiResponse } from './types';

const BAGS_WRAPPER_ENDPOINTS = {
  CREATE_TOKEN_INFO: '/token-launch/create-token-info',
  CREATE_TOKEN_LAUNCH_TX: '/token-launch/create-token-launch-transaction',
  FEE_SHARE_CONFIG: '/fee-share/config',
  TRADE_QUOTE: '/trade/quote',
  TRADE_SWAP: '/trade/swap',
  CLAIMABLE_POSITIONS: '/token-launch/claimable-positions',
  CLAIM_TXS: '/token-launch/claim-txs/v3',
};

async function bagsPost<T>(path: string, body: unknown): Promise<T> {
  const apiKey = process.env.BAGS_API_KEY;
  if (!apiKey) throw new Error('BAGS_API_KEY not configured');

  const res = await fetch(`${BAGS_API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bags API error ${res.status}: ${text}`);
  }

  const json: BagsApiResponse<T> = await res.json();
  if (!json.success) throw new Error(json.error || 'Bags API error');
  return json.response;
}

async function bagsGet<T>(path: string, query: Record<string, string>): Promise<T> {
  const apiKey = process.env.BAGS_API_KEY;
  if (!apiKey) throw new Error('BAGS_API_KEY not configured');

  const params = new URLSearchParams(query).toString();
  const res = await fetch(`${BAGS_API_BASE}${path}?${params}`, {
    headers: { 'x-api-key': apiKey },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bags API error ${res.status}: ${text}`);
  }

  const json: BagsApiResponse<T> = await res.json();
  if (!json.success) throw new Error(json.error || 'Bags API error');
  return json.response;
}

// ── Token Launch ──

export interface CreateTokenInfoPayload {
  image: string; // base64 or URL
  name: string;
  symbol: string;
  description: string;
  twitter?: string;
  telegram?: string;
  website?: string;
}

export async function createTokenInfo(payload: CreateTokenInfoPayload) {
  return bagsPost(BAGS_WRAPPER_ENDPOINTS.CREATE_TOKEN_INFO, payload);
}

export interface FeeShareConfigPayload {
  tokenMint: string;
  claimersArray: Array<{ wallet: string; bps: number }>;
}

export async function configureFeeShare(payload: FeeShareConfigPayload) {
  return bagsPost(BAGS_WRAPPER_ENDPOINTS.FEE_SHARE_CONFIG, payload);
}

export interface CreateLaunchTxPayload {
  name: string;
  symbol: string;
  uri: string; // metadata URI from createTokenInfo
  initialBuyLamports?: number;
  wallet: string;
}

export async function createLaunchTransaction(payload: CreateLaunchTxPayload) {
  return bagsPost<{ transaction: string }>(BAGS_WRAPPER_ENDPOINTS.CREATE_TOKEN_LAUNCH_TX, payload);
}

// ── Trading ──

export interface TradeQuoteParams {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps?: string;
}

export async function getTradeQuote(params: TradeQuoteParams) {
  return bagsGet<{
    inAmount: string;
    outAmount: string;
    priceImpactPct: string;
    fee: string;
  }>(BAGS_WRAPPER_ENDPOINTS.TRADE_QUOTE, {
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: params.amount,
    ...(params.slippageBps ? { slippageBps: params.slippageBps } : {}),
  });
}

export interface SwapPayload {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps?: number;
  wallet: string;
}

export async function createSwapTransaction(payload: SwapPayload) {
  return bagsPost<{ transaction: string }>(BAGS_WRAPPER_ENDPOINTS.TRADE_SWAP, payload);
}

// ── Fee Claiming ──

export async function getClaimablePositions(wallet: string) {
  return bagsGet<Array<{
    tokenMint: string;
    claimableAmount: string;
    tokenName: string;
    tokenSymbol: string;
    tokenImage: string;
  }>>(BAGS_WRAPPER_ENDPOINTS.CLAIMABLE_POSITIONS, { wallet });
}

export async function createClaimTransactions(wallet: string, tokenMint: string) {
  return bagsPost<{ transactions: string[] }>(BAGS_WRAPPER_ENDPOINTS.CLAIM_TXS, {
    wallet,
    tokenMint,
  });
}
