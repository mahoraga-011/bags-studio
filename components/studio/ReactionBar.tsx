'use client';

import { useState } from 'react';
import { ALLOWED_REACTIONS } from '@/lib/constants';
import { ReactionCount } from '@/lib/types';

interface ReactionBarProps {
  postId: string;
  mint: string;
  wallet?: string;
  reactions: ReactionCount[];
}

export default function ReactionBar({ postId, mint, wallet, reactions }: ReactionBarProps) {
  const [localReactions, setLocalReactions] = useState<ReactionCount[]>(reactions);
  const [toggling, setToggling] = useState<string | null>(null);

  const handleToggle = async (emoji: string) => {
    if (toggling) return;
    setToggling(emoji);

    const existing = localReactions.find(r => r.emoji === emoji);
    const hasReacted = existing && existing.count > 0;

    // Optimistic update
    if (hasReacted) {
      setLocalReactions(prev =>
        prev.map(r => r.emoji === emoji ? { ...r, count: Math.max(0, r.count - 1) } : r).filter(r => r.count > 0)
      );
    } else {
      setLocalReactions(prev => {
        const idx = prev.findIndex(r => r.emoji === emoji);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], count: next[idx].count + 1 };
          return next;
        }
        return [...prev, { emoji, count: 1 }];
      });
    }

    try {
      await fetch(`/api/engage/${mint}/community/${postId}/react`, {
        method: hasReacted ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, emoji }),
      });
    } catch {
      // Revert on error
      setLocalReactions(reactions);
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {ALLOWED_REACTIONS.map(emoji => {
        const reaction = localReactions.find(r => r.emoji === emoji);
        const count = reaction?.count || 0;
        const isActive = count > 0;

        return (
          <button
            key={emoji}
            onClick={() => handleToggle(emoji)}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-all cursor-pointer ${
              isActive
                ? 'bg-green/10 border border-green/20 text-white'
                : 'bg-surface-2 border border-border-subtle text-gray-600 hover:border-green/20 hover:text-gray-400'
            }`}
          >
            <span>{emoji}</span>
            {count > 0 && <span className="font-mono text-[10px]">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
