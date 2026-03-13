'use client';

import { use } from 'react';
import useSWR from 'swr';
import ConvictionLeaderboard from '@/components/studio/ConvictionLeaderboard';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function SupportersPage({
  params,
}: {
  params: Promise<{ mint: string }>;
}) {
  const { mint } = use(params);

  const { data: scoreData, isLoading } = useSWR(`/api/score/${mint}`, fetcher, {
    revalidateOnFocus: false,
  });

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/studio/${mint}`}
          className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
        >
          ← Dashboard
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center pt-12">
          <div className="text-center">
            <div className="w-6 h-6 border-2 border-green/30 border-t-green rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Computing conviction scores...</p>
          </div>
        </div>
      ) : scoreData?.scores ? (
        <ConvictionLeaderboard scores={scoreData.scores} mint={mint} />
      ) : (
        <div className="text-center pt-12 text-gray-500 text-sm">
          No claim events found.
        </div>
      )}
    </div>
  );
}
