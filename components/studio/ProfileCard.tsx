'use client';

import { motion, AnimatePresence } from 'framer-motion';
import useSWR from 'swr';
import TierBadge from './TierBadge';
import AchievementBadge from './AchievementBadge';
import { BADGE_DEFINITIONS } from '@/lib/constants';
import { UserProfile, BadgeType } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface ProfileCardProps {
  mint: string;
  wallet: string;
  open: boolean;
  onClose: () => void;
}

function StatBar({ label, value, max, color = 'bg-green' }: { label: string; value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] mb-0.5">
        <span className="text-gray-500">{label}</span>
        <span className="font-mono text-gray-300">{Math.round(value)}</span>
      </div>
      <div className="h-1 rounded-full bg-border-strong overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function ProfileCard({ mint, wallet, open, onClose }: ProfileCardProps) {
  const { data, isLoading } = useSWR<UserProfile>(
    open ? `/api/engage/${mint}/profile/${wallet}` : null,
    fetcher,
  );

  const shortWallet = `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
  const earnedTypes = new Set(data?.achievements?.map(a => a.badge_type) || []);
  const maxPoints = Math.max(
    data?.hold_points || 0,
    data?.quest_points || 0,
    data?.referral_points || 0,
    data?.streak_points || 0,
    1,
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={onClose}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-border-subtle bg-surface p-6 shadow-xl"
              onClick={e => e.stopPropagation()}
            >
              {isLoading || !data ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-5 h-5 border-2 border-green/30 border-t-green rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-12 h-12 rounded-full bg-surface-2 border border-border-subtle flex items-center justify-center text-lg font-mono text-gray-500">
                      {wallet.slice(0, 2)}
                    </div>
                    <div>
                      <div className="font-mono text-sm font-bold">{shortWallet}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {data.tier && <TierBadge tier={data.tier} size="sm" />}
                        <span className="text-xs font-mono text-green">{Math.round(data.total_points)} pts</span>
                      </div>
                    </div>
                  </div>

                  {/* Points breakdown */}
                  <div className="space-y-2 mb-5">
                    <StatBar label="Hold" value={data.hold_points} max={maxPoints} />
                    <StatBar label="Quests" value={data.quest_points} max={maxPoints} color="bg-[#C084FC]" />
                    <StatBar label="Referrals" value={data.referral_points} max={maxPoints} color="bg-[#60A5FA]" />
                    <StatBar label="Streak" value={data.streak_points} max={maxPoints} color="bg-[#FFD700]" />
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-4 gap-2 mb-5">
                    {[
                      { label: 'Streak', value: `${data.current_streak}d` },
                      { label: 'Quests', value: String(data.quests_completed) },
                      { label: 'Referrals', value: String(data.referral_count) },
                      { label: 'Posts', value: String(data.post_count) },
                    ].map(s => (
                      <div key={s.label} className="text-center p-2 rounded-lg bg-surface-2 border border-border-subtle">
                        <div className="text-sm font-mono font-bold">{s.value}</div>
                        <div className="text-[9px] text-gray-500">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Achievements */}
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Achievements</div>
                    <div className="flex flex-wrap gap-1.5">
                      {BADGE_DEFINITIONS.map(b => (
                        <AchievementBadge
                          key={b.type}
                          badgeType={b.type as BadgeType}
                          locked={!earnedTypes.has(b.type)}
                          size="sm"
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
