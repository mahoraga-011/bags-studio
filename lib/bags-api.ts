import {
  TokenMetadata,
  FeeShareInfo,
  ClaimEvent,
  ClaimEventsResponse,
  AdminToken,
  PoolInfo,
} from './types';

const API_BASE = '/api/bags';

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bags API error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function getTokenMetadata(mint: string): Promise<TokenMetadata> {
  return apiFetch<TokenMetadata>(`/token/${mint}`);
}

export async function getFeeShareInfo(mint: string): Promise<FeeShareInfo> {
  return apiFetch<FeeShareInfo>(`/fee-share/token/${mint}`);
}

export async function getPoolInfo(mint: string): Promise<PoolInfo> {
  return apiFetch<PoolInfo>(`/token/${mint}/pool`);
}

export async function getClaimEvents(
  mint: string,
  page = 1,
  pageSize = 100
): Promise<ClaimEventsResponse> {
  return apiFetch<ClaimEventsResponse>(
    `/fee-share/token/claim-events?tokenMint=${mint}&page=${page}&pageSize=${pageSize}`
  );
}

export async function getAllClaimEvents(mint: string): Promise<ClaimEvent[]> {
  const allEvents: ClaimEvent[] = [];
  let page = 1;
  const pageSize = 100;

  while (true) {
    const res = await getClaimEvents(mint, page, pageSize);
    allEvents.push(...res.claimEvents);
    if (allEvents.length >= res.total || res.claimEvents.length < pageSize) {
      break;
    }
    page++;
  }

  return allEvents;
}

export async function getAdminTokens(): Promise<AdminToken[]> {
  return apiFetch<AdminToken[]>(`/fee-share/admin/list`);
}
