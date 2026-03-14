'use client';

import { useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { motion } from 'framer-motion';
import useSWR from 'swr';
import ReactionBar from './ReactionBar';
import ProfileCard from './ProfileCard';
import TierBadge from './TierBadge';
import { CommunityPost } from '@/lib/types';
import { MAX_POST_LENGTH } from '@/lib/constants';

const fetcher = (url: string) => fetch(url).then(r => r.json());

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

interface CommunityWallProps {
  mint: string;
}

export default function CommunityWall({ mint }: CommunityWallProps) {
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58();
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [profileWallet, setProfileWallet] = useState<string | null>(null);

  const { data, mutate } = useSWR(
    `/api/engage/${mint}/community`,
    fetcher,
    { refreshInterval: 15000 },
  );

  const posts: CommunityPost[] = data?.posts || [];

  const handlePost = useCallback(async () => {
    if (!wallet || !content.trim() || posting) return;
    setPosting(true);
    setError('');

    const optimisticPost: CommunityPost = {
      id: `temp-${Date.now()}`,
      mint_address: mint,
      wallet,
      content: content.trim(),
      created_at: new Date().toISOString(),
      reactions: [],
    };

    // Optimistic insert
    mutate({ posts: [optimisticPost, ...posts] }, false);
    setContent('');

    try {
      const res = await fetch(`/api/engage/${mint}/community`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, content: content.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to post');
      }

      mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post');
      // Revert optimistic insert
      mutate();
    } finally {
      setPosting(false);
    }
  }, [wallet, content, posting, mint, posts, mutate]);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Post composer */}
      {wallet ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-border-subtle p-4 mb-6"
        >
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="What's happening with this token?"
            maxLength={MAX_POST_LENGTH}
            rows={3}
            className="w-full bg-transparent text-white text-sm placeholder:text-gray-600 resize-none focus:outline-none"
          />
          <div className="flex items-center justify-between mt-2">
            <span className={`text-[10px] font-mono ${content.length > MAX_POST_LENGTH - 20 ? 'text-red' : 'text-gray-600'}`}>
              {content.length}/{MAX_POST_LENGTH}
            </span>
            <button
              onClick={handlePost}
              disabled={posting || !content.trim()}
              className="px-4 py-1.5 rounded-full bg-green text-black text-xs font-semibold hover:bg-green-dark transition-colors disabled:opacity-50"
            >
              {posting ? 'Posting...' : 'Post'}
            </button>
          </div>
          {error && <p className="text-xs text-red mt-1">{error}</p>}
        </motion.div>
      ) : (
        <div className="rounded-xl border border-border-subtle p-4 mb-6 text-center">
          <p className="text-sm text-gray-500">Connect your wallet to join the conversation.</p>
        </div>
      )}

      {/* Posts */}
      {posts.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-3xl mb-3">💬</div>
          <p className="text-sm text-gray-500">No posts yet. Be the first to say something!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post, i) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3) }}
              className="rounded-xl border border-border-subtle p-4 hover:border-green/10 transition-colors"
            >
              {/* Post header */}
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => setProfileWallet(post.wallet)}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <div className="w-7 h-7 rounded-full bg-surface-2 border border-border-subtle flex items-center justify-center text-[10px] font-mono text-gray-500">
                    {post.wallet.slice(0, 2)}
                  </div>
                  <span className="text-xs font-mono text-gray-300 hover:text-green transition-colors">
                    {post.wallet.slice(0, 6)}...{post.wallet.slice(-4)}
                  </span>
                </button>
                <span className="text-[10px] text-gray-600">{timeAgo(post.created_at)}</span>
              </div>

              {/* Content */}
              <p className="text-sm text-gray-300 leading-relaxed mb-3 whitespace-pre-wrap break-words">
                {post.content}
              </p>

              {/* Reactions */}
              <ReactionBar
                postId={post.id}
                mint={mint}
                wallet={wallet}
                reactions={post.reactions || []}
              />
            </motion.div>
          ))}
        </div>
      )}

      {/* Profile card modal */}
      {profileWallet && (
        <ProfileCard
          mint={mint}
          wallet={profileWallet}
          open={!!profileWallet}
          onClose={() => setProfileWallet(null)}
        />
      )}
    </div>
  );
}
