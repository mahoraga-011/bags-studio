'use client';

import { use } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import useSWR from 'swr';
import Link from 'next/link';
import CampaignBuilder from '@/components/studio/CampaignBuilder';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function NewCampaignPage({
  params,
}: {
  params: Promise<{ mint: string }>;
}) {
  const { mint } = use(params);
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58();

  const { data: dashData, isLoading } = useSWR(`/api/dashboard/${mint}`, fetcher);
  const creator = dashData?.creators?.find((c: { isCreator: boolean }) => c.isCreator);
  const isCreator = wallet && creator?.wallet === wallet;

  if (isLoading) {
    return (
      <div className="flex justify-center pt-12">
        <div className="w-6 h-6 border-2 border-green/30 border-t-green rounded-full animate-spin" />
      </div>
    );
  }

  if (!wallet || !isCreator) {
    return (
      <div className="max-w-md mx-auto pt-12 text-center">
        <div className="text-red text-lg mb-2">Access Denied</div>
        <p className="text-gray-500 text-sm mb-6">
          {!wallet
            ? 'Connect your wallet to create campaigns.'
            : 'Only the token creator can create campaigns.'}
        </p>
        <Link
          href={`/studio/${mint}/campaigns`}
          className="text-green hover:underline text-sm"
        >
          ← Back to Campaigns
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

      <CampaignBuilder mint={mint} creatorWallet={wallet} />
    </div>
  );
}
