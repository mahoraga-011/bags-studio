'use client';

import { use } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import EligibilityTable from '@/components/studio/EligibilityTable';
import { Campaign } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ mint: string; id: string }>;
}) {
  const { mint, id } = use(params);

  const { data: campaigns } = useSWR<Campaign[]>(`/api/campaigns?mint=${mint}`, fetcher);
  const campaign = campaigns?.find(c => c.id === id);

  const { data: scoreData, isLoading: scoresLoading } = useSWR(
    `/api/score/${mint}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  if (!campaigns) {
    return (
      <div className="flex justify-center pt-12">
        <div className="w-6 h-6 border-2 border-green/30 border-t-green rounded-full animate-spin" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center pt-12">
        <p className="text-gray-500 mb-4">Campaign not found</p>
        <Link href={`/studio/${mint}/campaigns`} className="text-green hover:underline text-sm">
          ← Back to campaigns
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/studio/${mint}/campaigns`}
          className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
        >
          ← Campaigns
        </Link>
      </div>

      {/* Campaign header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-display font-bold">{campaign.name}</h1>
          <span
            className={`text-xs font-mono px-2 py-1 rounded-full ${
              campaign.status === 'active'
                ? 'bg-green/10 text-green'
                : 'bg-gray-600/20 text-gray-400'
            }`}
          >
            {campaign.status}
          </span>
        </div>
        {campaign.description && (
          <p className="text-gray-400 text-sm">{campaign.description}</p>
        )}
        <div className="flex gap-4 mt-3 text-xs text-gray-500 font-mono">
          <span>Type: {campaign.type}</span>
          <span>Min tier: {campaign.tier_threshold}</span>
          {campaign.max_wallets && <span>Cap: {campaign.max_wallets}</span>}
        </div>

        {/* Share link */}
        <div className="mt-4 p-3 rounded-lg bg-surface-2 border border-border-subtle">
          <div className="text-xs text-gray-500 mb-1">Public supporter link:</div>
          <div className="flex items-center gap-2">
            <code className="text-xs text-green font-mono flex-1 truncate">
              {typeof window !== 'undefined' ? window.location.origin : ''}/campaign/{campaign.id}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  `${window.location.origin}/campaign/${campaign.id}`
                );
              }}
              className="px-2 py-1 text-xs font-mono rounded bg-surface border border-border-subtle text-gray-400 hover:text-green transition-colors"
            >
              Copy
            </button>
          </div>
        </div>
      </div>

      {/* Eligibility table */}
      {scoresLoading ? (
        <div className="flex justify-center pt-8">
          <div className="text-center">
            <div className="w-6 h-6 border-2 border-green/30 border-t-green rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Loading scores...</p>
          </div>
        </div>
      ) : scoreData?.scores ? (
        <EligibilityTable scores={scoreData.scores} campaign={campaign} />
      ) : (
        <p className="text-gray-500 text-sm text-center pt-8">
          No scores available for this token.
        </p>
      )}
    </div>
  );
}
