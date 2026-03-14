import { NextRequest, NextResponse } from 'next/server';
import { getWalletPoints } from '@/lib/points';
import { getStreak } from '@/lib/streaks';
import { checkAndAwardBadges } from '@/lib/achievements';
import { getPostCount } from '@/lib/community';
import { getSupabase } from '@/lib/supabase';
import { TIER_ORDER, TIER_PERCENTILES } from '@/lib/constants';
import { ConvictionTier } from '@/lib/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ mint: string; wallet: string }> }
) {
  const { mint, wallet } = await params;

  try {
    const supabase = getSupabase();

    // Parallel fetches
    const [points, streak, achievements, postCount] = await Promise.all([
      getWalletPoints(mint, wallet),
      getStreak(mint, wallet),
      checkAndAwardBadges(mint, wallet),
      getPostCount(mint, wallet),
    ]);

    // Count quests completed
    let questsCompleted = 0;
    let referralCount = 0;
    if (supabase) {
      const [qc, rc] = await Promise.all([
        supabase
          .from('quest_completions')
          .select('id, quests!inner(mint_address)', { count: 'exact', head: true })
          .eq('wallet', wallet)
          .eq('quests.mint_address', mint),
        supabase
          .from('referrals')
          .select('*', { count: 'exact', head: true })
          .eq('mint_address', mint)
          .eq('referrer_wallet', wallet)
          .eq('status', 'verified'),
      ]);
      questsCompleted = qc.count || 0;
      referralCount = rc.count || 0;
    }

    // Determine tier from leaderboard rank
    let tier: ConvictionTier | null = null;
    if (supabase && points) {
      const { count: totalWallets } = await supabase
        .from('engagement_leaderboard')
        .select('*', { count: 'exact', head: true })
        .eq('mint_address', mint);

      if (totalWallets && points.rank > 0) {
        const percentile = points.rank / totalWallets;
        for (const t of TIER_ORDER) {
          if (percentile <= TIER_PERCENTILES[t]) {
            tier = t;
            break;
          }
        }
      }
    }

    return NextResponse.json({
      wallet,
      username: null,
      pfp: null,
      tier,
      total_points: points?.total_points || 0,
      hold_points: points?.hold_points || 0,
      quest_points: points?.quest_points || 0,
      referral_points: points?.referral_points || 0,
      streak_points: points?.streak_points || 0,
      current_streak: streak?.current_streak || 0,
      longest_streak: streak?.longest_streak || 0,
      quests_completed: questsCompleted,
      referral_count: referralCount,
      post_count: postCount,
      achievements,
    });
  } catch (err) {
    console.error('Profile error:', err);
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }
}
