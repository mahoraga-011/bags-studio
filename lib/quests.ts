import { getServiceSupabase, getSupabase } from './supabase';
import { Quest, QuestCompletion, QuestSubmission } from './types';
import { awardPoints } from './points';
import { addFeedEvent } from './feed';
import { getStreak } from './streaks';
import { getSplTokenBalance } from './solana-rpc';
import { getTradeVolume } from './trades';
import { TIER_INDEX, TIER_ORDER } from './constants';

/**
 * Create a new quest.
 */
export async function createQuest(
  mint: string,
  creatorWallet: string,
  data: {
    title: string;
    description?: string;
    quest_type: string;
    points_reward: number;
    target_value?: number;
    requires_approval?: boolean;
    max_completions?: number;
    expires_at?: string;
  },
): Promise<Quest | null> {
  const supabase = getServiceSupabase();
  if (!supabase) return null;

  const { data: quest, error } = await supabase
    .from('quests')
    .insert({
      mint_address: mint,
      creator_wallet: creatorWallet,
      title: data.title,
      description: data.description || null,
      quest_type: data.quest_type,
      points_reward: data.points_reward,
      target_value: data.target_value || 1,
      requires_approval: data.requires_approval || false,
      max_completions: data.max_completions || null,
      expires_at: data.expires_at || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create quest:', error);
    return null;
  }

  return quest as Quest;
}

/**
 * Get all quests for a mint.
 */
export async function getQuests(mint: string, activeOnly = true): Promise<Quest[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  let query = supabase
    .from('quests')
    .select('*')
    .eq('mint_address', mint)
    .order('created_at', { ascending: false });

  if (activeOnly) {
    query = query.eq('active', true);
  }

  const { data } = await query;
  return (data || []) as Quest[];
}

/**
 * Get quest with completion info for a wallet.
 */
export async function getQuestWithProgress(
  questId: string,
  wallet?: string,
): Promise<{
  quest: Quest;
  completed: boolean;
  submission: QuestSubmission | null;
  completionCount: number;
  progress: { current_value: number; target_value: number; percentage: number } | null;
} | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: quest } = await supabase
    .from('quests')
    .select('*')
    .eq('id', questId)
    .single();

  if (!quest) return null;

  const { count: completionCount } = await supabase
    .from('quest_completions')
    .select('*', { count: 'exact', head: true })
    .eq('quest_id', questId);

  let completed = false;
  let submission: QuestSubmission | null = null;
  let progress: { current_value: number; target_value: number; percentage: number } | null = null;

  if (wallet) {
    const { data: comp } = await supabase
      .from('quest_completions')
      .select('*')
      .eq('quest_id', questId)
      .eq('wallet', wallet)
      .single();

    completed = !!comp;

    const { data: sub } = await supabase
      .from('quest_submissions')
      .select('*')
      .eq('quest_id', questId)
      .eq('wallet', wallet)
      .single();

    submission = sub as QuestSubmission | null;

    // Compute progress for auto-verifiable quests
    if (!completed) {
      progress = await getQuestProgress(quest as Quest, wallet);
    }
  }

  return {
    quest: quest as Quest,
    completed,
    submission,
    completionCount: completionCount || 0,
    progress,
  };
}

/**
 * Resolve current value server-side based on quest type.
 * Returns -1 for manual-approval types (social_share, custom).
 */
async function resolveCurrentValue(quest: Quest, wallet: string): Promise<number> {
  const mint = quest.mint_address;

  switch (quest.quest_type) {
    case 'hold_duration':
    case 'streak': {
      const streak = await getStreak(mint, wallet);
      return streak?.current_streak || 0;
    }

    case 'claim_count': {
      const supabase = getSupabase();
      if (!supabase) return 0;
      const { count } = await supabase
        .from('engagement_points')
        .select('*', { count: 'exact', head: true })
        .eq('mint_address', mint)
        .eq('wallet', wallet)
        .eq('source', 'claim');
      return count || 0;
    }

    case 'referral_count': {
      const supabase = getSupabase();
      if (!supabase) return 0;
      const { count } = await supabase
        .from('referrals')
        .select('*', { count: 'exact', head: true })
        .eq('mint_address', mint)
        .eq('referrer_wallet', wallet)
        .eq('status', 'verified');
      return count || 0;
    }

    case 'token_balance': {
      return await getSplTokenBalance(wallet, mint);
    }

    case 'trade_volume': {
      return await getTradeVolume(mint, wallet);
    }

    case 'tier_reached': {
      const supabase = getSupabase();
      if (!supabase) return 0;
      const { data: entry } = await supabase
        .from('engagement_leaderboard')
        .select('total_points, rank')
        .eq('mint_address', mint)
        .eq('wallet', wallet)
        .single();
      if (!entry) return 0;

      // Get total count to determine percentile
      const { count: totalWallets } = await supabase
        .from('engagement_leaderboard')
        .select('*', { count: 'exact', head: true })
        .eq('mint_address', mint);

      if (!totalWallets || totalWallets === 0) return 0;

      const percentile = entry.rank / totalWallets;
      // Determine tier from percentile
      let tierIndex = TIER_INDEX.OG; // default
      if (percentile <= 0.01) tierIndex = TIER_INDEX.Champion;
      else if (percentile <= 0.05) tierIndex = TIER_INDEX.Catalyst;
      else if (percentile <= 0.15) tierIndex = TIER_INDEX.Loyal;
      else if (percentile <= 0.40) tierIndex = TIER_INDEX.Active;

      return tierIndex;
    }

    case 'meta': {
      const supabase = getSupabase();
      if (!supabase) return 0;
      // Count completed quests for this wallet+mint, excluding meta quests
      const { data: completions } = await supabase
        .from('quest_completions')
        .select('quest_id, quests!inner(mint_address, quest_type)')
        .eq('wallet', wallet)
        .eq('quests.mint_address', mint)
        .neq('quests.quest_type', 'meta');
      return completions?.length || 0;
    }

    case 'social_share':
    case 'custom':
      return -1; // Manual approval only

    default:
      return -1;
  }
}

/**
 * Get quest progress for UI display.
 */
export async function getQuestProgress(
  quest: Quest,
  wallet: string,
): Promise<{ current_value: number; target_value: number; percentage: number }> {
  const currentValue = await resolveCurrentValue(quest, wallet);
  const targetValue = quest.target_value;

  return {
    current_value: currentValue,
    target_value: targetValue,
    percentage: currentValue < 0 ? 0 : Math.min(100, Math.round((currentValue / targetValue) * 100)),
  };
}

/**
 * Auto-check quest completion using server-side verification.
 */
export async function checkQuestCompletion(
  questId: string,
  wallet: string,
): Promise<{ completed: boolean; current_value: number; target_value: number }> {
  const supabase = getServiceSupabase();
  if (!supabase) return { completed: false, current_value: 0, target_value: 0 };

  const { data: quest } = await supabase
    .from('quests')
    .select('*')
    .eq('id', questId)
    .single();

  if (!quest || !quest.active) return { completed: false, current_value: 0, target_value: 0 };

  const typedQuest = quest as Quest;

  // Check expiry
  if (typedQuest.expires_at && new Date(typedQuest.expires_at) < new Date()) {
    return { completed: false, current_value: 0, target_value: typedQuest.target_value };
  }

  // Check max completions
  if (typedQuest.max_completions) {
    const { count } = await supabase
      .from('quest_completions')
      .select('*', { count: 'exact', head: true })
      .eq('quest_id', questId);
    if ((count || 0) >= typedQuest.max_completions) {
      return { completed: false, current_value: 0, target_value: typedQuest.target_value };
    }
  }

  // Check already completed
  const { data: existing } = await supabase
    .from('quest_completions')
    .select('id')
    .eq('quest_id', questId)
    .eq('wallet', wallet)
    .single();

  if (existing) return { completed: true, current_value: typedQuest.target_value, target_value: typedQuest.target_value };

  // Resolve current value server-side
  const currentValue = await resolveCurrentValue(typedQuest, wallet);

  // Manual approval types can't be auto-checked
  if (currentValue < 0) {
    return { completed: false, current_value: 0, target_value: typedQuest.target_value };
  }

  // Check target value
  if (currentValue < typedQuest.target_value) {
    return { completed: false, current_value: currentValue, target_value: typedQuest.target_value };
  }

  // Complete the quest
  const success = await completeQuest(questId, wallet, typedQuest);
  return {
    completed: success,
    current_value: currentValue,
    target_value: typedQuest.target_value,
  };
}

/**
 * Submit proof for a social/custom quest (requires approval).
 */
export async function submitQuestProof(
  questId: string,
  wallet: string,
  proofUrl: string,
): Promise<QuestSubmission | null> {
  const supabase = getServiceSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('quest_submissions')
    .upsert({
      quest_id: questId,
      wallet,
      proof_url: proofUrl,
      status: 'pending',
    }, { onConflict: 'quest_id,wallet' })
    .select()
    .single();

  if (error) {
    console.error('Failed to submit quest proof:', error);
    return null;
  }

  return data as QuestSubmission;
}

/**
 * Approve or reject a quest submission (creator action).
 */
export async function reviewSubmission(
  submissionId: string,
  approved: boolean,
): Promise<boolean> {
  const supabase = getServiceSupabase();
  if (!supabase) return false;

  const { data: submission } = await supabase
    .from('quest_submissions')
    .select('*, quests(*)')
    .eq('id', submissionId)
    .single();

  if (!submission) return false;

  const status = approved ? 'approved' : 'rejected';
  await supabase
    .from('quest_submissions')
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq('id', submissionId);

  if (approved) {
    const quest = (submission as Record<string, unknown>).quests as Quest;
    await completeQuest(quest.id, submission.wallet, quest);
  }

  return true;
}

/**
 * Internal: mark quest as completed and award points.
 */
async function completeQuest(questId: string, wallet: string, quest: Quest): Promise<boolean> {
  const supabase = getServiceSupabase();
  if (!supabase) return false;

  const { error } = await supabase.from('quest_completions').insert({
    quest_id: questId,
    wallet,
  });

  if (error) return false;

  await awardPoints(quest.mint_address, wallet, quest.points_reward, 'quest', questId);

  await addFeedEvent(
    quest.mint_address,
    wallet,
    'quest_complete',
    `Completed "${quest.title}"`,
    { quest_id: questId, points: quest.points_reward },
  );

  return true;
}
