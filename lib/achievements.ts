import { getServiceSupabase, getSupabase } from './supabase';
import { Achievement, BadgeType } from './types';
import { BADGE_DEFINITIONS } from './constants';

/**
 * Get all achievements for a wallet.
 */
export async function getWalletAchievements(
  mint: string,
  wallet: string,
): Promise<Achievement[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data } = await supabase
    .from('achievements')
    .select('*')
    .eq('mint_address', mint)
    .eq('wallet', wallet);

  return (data || []) as Achievement[];
}

/**
 * Check all badge conditions and award any newly earned badges.
 */
export async function checkAndAwardBadges(
  mint: string,
  wallet: string,
): Promise<Achievement[]> {
  const supabase = getServiceSupabase();
  if (!supabase) return [];

  // Get existing badges
  const { data: existing } = await supabase
    .from('achievements')
    .select('badge_type')
    .eq('mint_address', mint)
    .eq('wallet', wallet);

  const earnedTypes = new Set((existing || []).map(a => a.badge_type));
  const newBadges: BadgeType[] = [];

  // Check each badge condition
  for (const badge of BADGE_DEFINITIONS) {
    if (earnedTypes.has(badge.type)) continue;

    const earned = await checkBadgeCondition(supabase, mint, wallet, badge.type as BadgeType);
    if (earned) newBadges.push(badge.type as BadgeType);
  }

  // Insert new badges
  if (newBadges.length > 0) {
    await supabase.from('achievements').insert(
      newBadges.map(badge_type => ({
        mint_address: mint,
        wallet,
        badge_type,
      })),
    );
  }

  // Return all badges
  return getWalletAchievements(mint, wallet);
}

async function checkBadgeCondition(
  supabase: ReturnType<typeof getServiceSupabase>,
  mint: string,
  wallet: string,
  badgeType: BadgeType,
): Promise<boolean> {
  if (!supabase) return false;

  switch (badgeType) {
    case 'og_holder': {
      const { data } = await supabase
        .from('engagement_leaderboard')
        .select('rank')
        .eq('mint_address', mint)
        .eq('wallet', wallet)
        .single();
      return data?.rank != null && data.rank <= 100;
    }

    case 'diamond_hands': {
      const { data } = await supabase
        .from('holding_streaks')
        .select('longest_streak')
        .eq('mint_address', mint)
        .eq('wallet', wallet)
        .single();
      return (data?.longest_streak || 0) >= 30;
    }

    case 'quest_master': {
      const { count } = await supabase
        .from('quest_completions')
        .select('id, quests!inner(mint_address)', { count: 'exact', head: true })
        .eq('wallet', wallet)
        .eq('quests.mint_address', mint);
      return (count || 0) >= 5;
    }

    case 'evangelist': {
      const { count } = await supabase
        .from('referrals')
        .select('*', { count: 'exact', head: true })
        .eq('mint_address', mint)
        .eq('referrer_wallet', wallet)
        .eq('status', 'verified');
      return (count || 0) >= 10;
    }

    case 'whale': {
      const { data: entry } = await supabase
        .from('engagement_leaderboard')
        .select('rank')
        .eq('mint_address', mint)
        .eq('wallet', wallet)
        .single();
      if (!entry?.rank) return false;
      const { count: total } = await supabase
        .from('engagement_leaderboard')
        .select('*', { count: 'exact', head: true })
        .eq('mint_address', mint);
      return total ? entry.rank <= Math.max(1, Math.ceil(total * 0.01)) : false;
    }

    case 'social_butterfly': {
      const { count } = await supabase
        .from('community_posts')
        .select('*', { count: 'exact', head: true })
        .eq('mint_address', mint)
        .eq('wallet', wallet);
      return (count || 0) >= 10;
    }

    default:
      return false;
  }
}
