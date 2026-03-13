import { getServiceSupabase, getSupabase } from './supabase';
import { PointSource, EngagementLeaderboardEntry } from './types';
import { DECAY_RATE } from './constants';

/**
 * Award points to a wallet (append-only ledger).
 */
export async function awardPoints(
  mint: string,
  wallet: string,
  points: number,
  source: PointSource,
  sourceId?: string,
): Promise<boolean> {
  const supabase = getServiceSupabase();
  if (!supabase) return false;

  const { error } = await supabase.from('engagement_points').insert({
    mint_address: mint,
    wallet,
    points,
    source,
    source_id: sourceId || null,
  });

  if (error) {
    console.error('Failed to award points:', error);
    return false;
  }

  // Update materialized leaderboard
  await refreshLeaderboardEntry(mint, wallet);
  return true;
}

/**
 * Apply decay: effective = raw * 0.9^(months_since_earned)
 */
export function applyDecay(points: number, earnedAt: Date, now: Date = new Date()): number {
  const monthsElapsed = (now.getTime() - earnedAt.getTime()) / (30 * 24 * 60 * 60 * 1000);
  return points * Math.pow(DECAY_RATE, monthsElapsed);
}

/**
 * Refresh a single wallet's leaderboard entry by summing all points with decay.
 */
export async function refreshLeaderboardEntry(mint: string, wallet: string): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) return;

  const { data: entries } = await supabase
    .from('engagement_points')
    .select('points, source, created_at')
    .eq('mint_address', mint)
    .eq('wallet', wallet);

  if (!entries || entries.length === 0) return;

  const now = new Date();
  let total = 0;
  let referral = 0;
  let quest = 0;
  let streak = 0;
  let hold = 0;

  for (const e of entries) {
    const decayed = applyDecay(e.points, new Date(e.created_at), now);
    total += decayed;
    switch (e.source) {
      case 'referral': referral += decayed; break;
      case 'quest': quest += decayed; break;
      case 'streak': streak += decayed; break;
      case 'hold': hold += decayed; break;
    }
  }

  await supabase.from('engagement_leaderboard').upsert({
    mint_address: mint,
    wallet,
    total_points: Math.round(total * 100) / 100,
    referral_points: Math.round(referral * 100) / 100,
    quest_points: Math.round(quest * 100) / 100,
    streak_points: Math.round(streak * 100) / 100,
    hold_points: Math.round(hold * 100) / 100,
    updated_at: now.toISOString(),
  }, { onConflict: 'mint_address,wallet' });
}

/**
 * Refresh leaderboard ranks for a mint.
 */
export async function refreshLeaderboardRanks(mint: string): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) return;

  const { data } = await supabase
    .from('engagement_leaderboard')
    .select('wallet, total_points')
    .eq('mint_address', mint)
    .order('total_points', { ascending: false });

  if (!data) return;

  // Batch update ranks
  for (let i = 0; i < data.length; i += 500) {
    const batch = data.slice(i, i + 500).map((entry, idx) => ({
      mint_address: mint,
      wallet: entry.wallet,
      total_points: entry.total_points,
      rank: i + idx + 1,
    }));
    await supabase
      .from('engagement_leaderboard')
      .upsert(batch, { onConflict: 'mint_address,wallet' });
  }
}

/**
 * Get leaderboard for a mint.
 */
export async function getLeaderboard(
  mint: string,
  limit = 50,
  offset = 0,
): Promise<{ entries: EngagementLeaderboardEntry[]; total: number }> {
  const supabase = getSupabase();
  if (!supabase) return { entries: [], total: 0 };

  const { count } = await supabase
    .from('engagement_leaderboard')
    .select('*', { count: 'exact', head: true })
    .eq('mint_address', mint);

  const { data } = await supabase
    .from('engagement_leaderboard')
    .select('*')
    .eq('mint_address', mint)
    .order('total_points', { ascending: false })
    .range(offset, offset + limit - 1);

  return {
    entries: (data || []) as EngagementLeaderboardEntry[],
    total: count || 0,
  };
}

/**
 * Get a specific wallet's points breakdown.
 */
export async function getWalletPoints(
  mint: string,
  wallet: string,
): Promise<EngagementLeaderboardEntry | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data } = await supabase
    .from('engagement_leaderboard')
    .select('*')
    .eq('mint_address', mint)
    .eq('wallet', wallet)
    .single();

  return data as EngagementLeaderboardEntry | null;
}

/**
 * Bulk refresh all leaderboard entries for a mint (used by cron).
 */
export async function refreshFullLeaderboard(mint: string): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) return;

  // Get all unique wallets for this mint
  const { data: wallets } = await supabase
    .from('engagement_points')
    .select('wallet')
    .eq('mint_address', mint);

  if (!wallets) return;

  const unique = [...new Set(wallets.map(w => w.wallet))];
  for (const wallet of unique) {
    await refreshLeaderboardEntry(mint, wallet);
  }
  await refreshLeaderboardRanks(mint);
}
