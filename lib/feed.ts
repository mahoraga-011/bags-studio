import { getSupabase, getServiceSupabase } from './supabase';
import { ActivityFeedItem, FeedEventType } from './types';

/**
 * Add an event to the activity feed.
 */
export async function addFeedEvent(
  mint: string,
  wallet: string,
  eventType: FeedEventType,
  title: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) return;

  await supabase.from('activity_feed').insert({
    mint_address: mint,
    wallet,
    event_type: eventType,
    title,
    metadata,
  });
}

/**
 * Get activity feed for a mint.
 */
export async function getFeed(
  mint: string,
  limit = 30,
  offset = 0,
): Promise<ActivityFeedItem[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data } = await supabase
    .from('activity_feed')
    .select('*')
    .eq('mint_address', mint)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  return (data || []) as ActivityFeedItem[];
}
