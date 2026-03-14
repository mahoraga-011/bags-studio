import { getServiceSupabase, getSupabase } from './supabase';
import { CommunityPost, ReactionCount } from './types';

/**
 * Create a community post.
 */
export async function createPost(
  mint: string,
  wallet: string,
  content: string,
): Promise<CommunityPost | null> {
  const supabase = getServiceSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('community_posts')
    .insert({ mint_address: mint, wallet, content })
    .select()
    .single();

  if (error) {
    console.error('Failed to create post:', error);
    return null;
  }

  return { ...data, reactions: [] } as CommunityPost;
}

/**
 * Get community posts with reaction counts.
 */
export async function getPosts(
  mint: string,
  limit = 30,
  offset = 0,
): Promise<CommunityPost[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data: posts } = await supabase
    .from('community_posts')
    .select('*')
    .eq('mint_address', mint)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (!posts || posts.length === 0) return [];

  // Fetch reaction counts for all posts
  const postIds = posts.map(p => p.id);
  const { data: reactions } = await supabase
    .from('post_reactions')
    .select('post_id, emoji')
    .in('post_id', postIds);

  // Group reactions by post_id + emoji
  const reactionMap: Record<string, ReactionCount[]> = {};
  if (reactions) {
    for (const r of reactions) {
      if (!reactionMap[r.post_id]) reactionMap[r.post_id] = [];
      const existing = reactionMap[r.post_id].find(rc => rc.emoji === r.emoji);
      if (existing) {
        existing.count++;
      } else {
        reactionMap[r.post_id].push({ emoji: r.emoji, count: 1 });
      }
    }
  }

  return posts.map(p => ({
    ...p,
    reactions: reactionMap[p.id] || [],
  })) as CommunityPost[];
}

/**
 * Add a reaction to a post.
 */
export async function addReaction(
  postId: string,
  wallet: string,
  emoji: string,
): Promise<boolean> {
  const supabase = getServiceSupabase();
  if (!supabase) return false;

  const { error } = await supabase
    .from('post_reactions')
    .upsert({ post_id: postId, wallet, emoji }, { onConflict: 'post_id,wallet,emoji' });

  return !error;
}

/**
 * Remove a reaction from a post.
 */
export async function removeReaction(
  postId: string,
  wallet: string,
  emoji: string,
): Promise<boolean> {
  const supabase = getServiceSupabase();
  if (!supabase) return false;

  const { error } = await supabase
    .from('post_reactions')
    .delete()
    .eq('post_id', postId)
    .eq('wallet', wallet)
    .eq('emoji', emoji);

  return !error;
}

/**
 * Get post count for a wallet on a mint.
 */
export async function getPostCount(mint: string, wallet: string): Promise<number> {
  const supabase = getSupabase();
  if (!supabase) return 0;

  const { count } = await supabase
    .from('community_posts')
    .select('*', { count: 'exact', head: true })
    .eq('mint_address', mint)
    .eq('wallet', wallet);

  return count || 0;
}
