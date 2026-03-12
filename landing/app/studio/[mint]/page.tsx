'use client';

import { use } from 'react';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import DashboardHeader from '@/components/studio/DashboardHeader';
import MomentumCards from '@/components/studio/MomentumCards';
import ConvictionLeaderboard from '@/components/studio/ConvictionLeaderboard';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function CreatorDashboard({
  params,
}: {
  params: Promise<{ mint: string }>;
}) {
  const { mint } = use(params);

  const { data: token, error: tokenError } = useSWR(`/api/bags/token/${mint}`, fetcher);
  const { data: feeShare } = useSWR(`/api/bags/fee-share/token/${mint}`, fetcher);
  const { data: pool } = useSWR(`/api/bags/token/${mint}/pool`, fetcher);
  const { data: scoreData, isLoading: scoresLoading } = useSWR(
    `/api/score/${mint}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  if (tokenError) {
    return (
      <div className="max-w-2xl mx-auto pt-12 text-center">
        <div className="text-red text-lg mb-2">Token not found</div>
        <p className="text-gray-500 text-sm mb-6">
          This mint address doesn&apos;t appear to be a valid Bags coin.
        </p>
        <Link
          href="/studio"
          className="text-green hover:underline text-sm"
        >
          ← Try another coin
        </Link>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex items-center justify-center pt-24">
        <div className="w-6 h-6 border-2 border-green/30 border-t-green rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <DashboardHeader
        token={token}
        feeShare={feeShare}
        totalSupporters={scoreData?.totalSupporters || 0}
      />

      <MomentumCards feeShare={feeShare} pool={pool} />

      {/* Quick actions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex gap-3 mb-8"
      >
        <Link
          href={`/studio/${mint}/supporters`}
          className="px-4 py-2 rounded-lg bg-surface-2 border border-border-subtle text-sm text-gray-300 hover:text-green hover:border-green/30 transition-colors"
        >
          Full Leaderboard →
        </Link>
        <Link
          href={`/studio/${mint}/campaigns`}
          className="px-4 py-2 rounded-lg bg-surface-2 border border-border-subtle text-sm text-gray-300 hover:text-green hover:border-green/30 transition-colors"
        >
          Campaigns →
        </Link>
      </motion.div>

      {/* Leaderboard preview */}
      {scoresLoading ? (
        <div className="rounded-xl border border-border-subtle p-8 text-center">
          <div className="w-6 h-6 border-2 border-green/30 border-t-green rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Computing conviction scores...</p>
        </div>
      ) : scoreData?.scores ? (
        <ConvictionLeaderboard scores={scoreData.scores} mint={mint} compact />
      ) : (
        <div className="rounded-xl border border-border-subtle p-8 text-center text-gray-500 text-sm">
          No claim events found for this token yet.
        </div>
      )}
    </div>
  );
}
