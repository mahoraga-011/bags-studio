import { ClaimEvent, WalletScore, ConvictionTier } from './types';
import { TIER_PERCENTILES, TIER_ORDER } from './constants';

interface WalletStats {
  wallet: string;
  claims: ClaimEvent[];
  totalClaimed: number;
  firstClaimAt: Date;
  lastClaimAt: Date;
  distinctDays: Set<string>;
}

function dayKey(ts: string): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function aggregateByWallet(events: ClaimEvent[]): Map<string, WalletStats> {
  const map = new Map<string, WalletStats>();

  for (const e of events) {
    let stats = map.get(e.wallet);
    if (!stats) {
      stats = {
        wallet: e.wallet,
        claims: [],
        totalClaimed: 0,
        firstClaimAt: new Date(e.timestamp),
        lastClaimAt: new Date(e.timestamp),
        distinctDays: new Set(),
      };
      map.set(e.wallet, stats);
    }
    stats.claims.push(e);
    stats.totalClaimed += e.amount;
    const d = new Date(e.timestamp);
    if (d < stats.firstClaimAt) stats.firstClaimAt = d;
    if (d > stats.lastClaimAt) stats.lastClaimAt = d;
    stats.distinctDays.add(dayKey(e.timestamp));
  }

  return map;
}

export function computeConvictionScores(events: ClaimEvent[]): WalletScore[] {
  if (events.length === 0) return [];

  const walletMap = aggregateByWallet(events);
  const wallets = Array.from(walletMap.values());

  // Find global extremes
  const allTimestamps = events.map(e => new Date(e.timestamp).getTime());
  const earliestGlobal = Math.min(...allTimestamps);
  const latestGlobal = Math.max(...allTimestamps);
  const timeSpan = latestGlobal - earliestGlobal || 1;
  const now = Date.now();

  const maxClaimed = Math.max(...wallets.map(w => w.totalClaimed), 1);
  const maxDays = Math.max(...wallets.map(w => w.distinctDays.size), 1);

  // Score each wallet
  const scored: WalletScore[] = wallets.map(w => {
    // Early score (25pts): how early first claim was relative to token age
    const earlyRatio = 1 - (w.firstClaimAt.getTime() - earliestGlobal) / timeSpan;
    const earlyScore = earlyRatio * 25;

    // Volume score (25pts): total claimed normalized to max claimer
    const volumeScore = (w.totalClaimed / maxClaimed) * 25;

    // Consistency (25pts): distinct active days normalized to max
    const consistencyScore = (w.distinctDays.size / maxDays) * 25;

    // Recency score (25pts): decays with days since last claim
    const daysSinceLast = (now - w.lastClaimAt.getTime()) / (1000 * 60 * 60 * 24);
    const recencyScore = Math.max(0, 25 * Math.exp(-daysSinceLast / 30));

    const score = earlyScore + volumeScore + consistencyScore + recencyScore;

    return {
      wallet: w.wallet,
      score: Math.round(score * 100) / 100,
      tier: 'OG' as ConvictionTier, // assigned below
      earlyScore: Math.round(earlyScore * 100) / 100,
      volumeScore: Math.round(volumeScore * 100) / 100,
      consistencyScore: Math.round(consistencyScore * 100) / 100,
      recencyScore: Math.round(recencyScore * 100) / 100,
      claimCount: w.claims.length,
      totalClaimed: w.totalClaimed,
      firstClaimAt: w.firstClaimAt.toISOString(),
      lastClaimAt: w.lastClaimAt.toISOString(),
      distinctDays: w.distinctDays.size,
    };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Assign tiers by percentile
  const total = scored.length;
  scored.forEach((w, i) => {
    const percentile = (i + 1) / total;
    for (const tier of TIER_ORDER) {
      if (percentile <= TIER_PERCENTILES[tier]) {
        w.tier = tier;
        break;
      }
    }
  });

  return scored;
}

export function getWalletRank(scores: WalletScore[], wallet: string): number {
  const idx = scores.findIndex(s => s.wallet === wallet);
  return idx === -1 ? -1 : idx + 1;
}

export function filterByTier(scores: WalletScore[], minTier: ConvictionTier): WalletScore[] {
  const minIdx = TIER_ORDER.indexOf(minTier);
  return scores.filter(s => TIER_ORDER.indexOf(s.tier) <= minIdx);
}
