'use client';

import { BADGE_DEFINITIONS } from '@/lib/constants';
import { BadgeType } from '@/lib/types';

interface AchievementBadgeProps {
  badgeType: BadgeType;
  locked?: boolean;
  size?: 'sm' | 'md';
}

export default function AchievementBadge({ badgeType, locked = false, size = 'md' }: AchievementBadgeProps) {
  const badge = BADGE_DEFINITIONS.find(b => b.type === badgeType);
  if (!badge) return null;

  const sizeClasses = size === 'sm' ? 'text-[10px] px-1.5 py-0.5 gap-1' : 'text-xs px-2 py-1 gap-1.5';

  if (locked) {
    return (
      <span className={`inline-flex items-center rounded-full bg-surface-2 border border-border-subtle text-gray-600 ${sizeClasses}`}>
        <span className="grayscale opacity-50">{badge.emoji}</span>
        <span>{badge.label}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-full bg-green/10 border border-green/20 text-green ${sizeClasses}`}
      title={badge.description}
    >
      <span>{badge.emoji}</span>
      <span className="font-mono">{badge.label}</span>
    </span>
  );
}
