import { getServiceSupabase, getSupabase } from './supabase';
import { Quest, QuestCompletion, QuestSubmission } from './types';
import { awardPoints } from './points';
import { addFeedEvent } from './feed';

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
  }

  return {
    quest: quest as Quest,
    completed,
    submission,
    completionCount: completionCount || 0,
  };
}

/**
 * Auto-check quest completion for verifiable quest types.
 */
export async function checkQuestCompletion(
  questId: string,
  wallet: string,
  currentValue: number,
): Promise<boolean> {
  const supabase = getServiceSupabase();
  if (!supabase) return false;

  const { data: quest } = await supabase
    .from('quests')
    .select('*')
    .eq('id', questId)
    .single();

  if (!quest || !quest.active) return false;

  // Check expiry
  if (quest.expires_at && new Date(quest.expires_at) < new Date()) return false;

  // Check max completions
  if (quest.max_completions) {
    const { count } = await supabase
      .from('quest_completions')
      .select('*', { count: 'exact', head: true })
      .eq('quest_id', questId);
    if ((count || 0) >= quest.max_completions) return false;
  }

  // Check already completed
  const { data: existing } = await supabase
    .from('quest_completions')
    .select('id')
    .eq('quest_id', questId)
    .eq('wallet', wallet)
    .single();

  if (existing) return false;

  // Check target value
  if (currentValue < quest.target_value) return false;

  // Complete the quest
  return await completeQuest(questId, wallet, quest as Quest);
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
