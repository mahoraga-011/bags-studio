import { getServiceSupabase, getSupabase } from './supabase';
import { HoldingStreak, TokenHolder } from './types';
import { STREAK_BONUS_POINTS, HOLD_POINTS_BY_TIER } from './constants';
import { awardPoints } from './points';
import { ConvictionTier } from './types';

/**
 * Update streaks for all holders of a token. Called by daily cron.
 * - If wallet still holds → increment streak
 * - If wallet no longer holds → reset streak to 0
 */
export async function updateStreaks(
  mint: string,
  currentHolders: TokenHolder[],
  tierMap: Map<string, ConvictionTier>,
): Promise<{ updated: number; reset: number; milestones: string[] }> {
  const supabase = getServiceSupabase();
  if (!supabase) return { updated: 0, reset: 0, milestones: [] };

  const holderSet = new Set(currentHolders.filter(h => h.balance > 0).map(h => h.wallet));
  const now = new Date().toISOString();

  // Get existing streaks for this mint
  const { data: existingStreaks } = await supabase
    .from('holding_streaks')
    .select('*')
    .eq('mint_address', mint);

  const existing = new Map((existingStreaks || []).map(s => [s.wallet, s as HoldingStreak]));

  let updated = 0;
  let reset = 0;
  const milestones: string[] = [];
  const upserts: Array<{
    mint_address: string;
    wallet: string;
    current_streak: number;
    longest_streak: number;
    last_checked_at: string;
  }> = [];

  // Process current holders: increment streak
  for (const wallet of holderSet) {
    const prev = existing.get(wallet);
    const newStreak = (prev?.current_streak || 0) + 1;
    const longest = Math.max(newStreak, prev?.longest_streak || 0);

    upserts.push({
      mint_address: mint,
      wallet,
      current_streak: newStreak,
      longest_streak: longest,
      last_checked_at: now,
    });

    updated++;

    // Award hold points based on tier
    const tier = tierMap.get(wallet) || 'OG';
    await awardPoints(mint, wallet, HOLD_POINTS_BY_TIER[tier], 'hold');

    // Streak bonus every day
    if (newStreak > 1) {
      await awardPoints(mint, wallet, STREAK_BONUS_POINTS, 'streak');
    }

    // Milestones: 7, 30, 60, 90, 180, 365 days
    const milestoneThresholds = [7, 30, 60, 90, 180, 365];
    if (milestoneThresholds.includes(newStreak)) {
      milestones.push(wallet);
      await supabase.from('activity_feed').insert({
        mint_address: mint,
        wallet,
        event_type: 'streak_milestone',
        title: `${newStreak}-day holding streak!`,
        metadata: { streak: newStreak },
      });
    }
  }

  // Process wallets that no longer hold: reset streak
  for (const [wallet, streak] of existing) {
    if (!holderSet.has(wallet) && streak.current_streak > 0) {
      upserts.push({
        mint_address: mint,
        wallet,
        current_streak: 0,
        longest_streak: streak.longest_streak,
        last_checked_at: now,
      });
      reset++;
    }
  }

  // Batch upsert
  for (let i = 0; i < upserts.length; i += 500) {
    await supabase
      .from('holding_streaks')
      .upsert(upserts.slice(i, i + 500), { onConflict: 'mint_address,wallet' });
  }

  return { updated, reset, milestones };
}

/**
 * Get streak info for a wallet.
 */
export async function getStreak(
  mint: string,
  wallet: string,
): Promise<HoldingStreak | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data } = await supabase
    .from('holding_streaks')
    .select('*')
    .eq('mint_address', mint)
    .eq('wallet', wallet)
    .single();

  return data as HoldingStreak | null;
}
