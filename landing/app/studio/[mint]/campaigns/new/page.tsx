'use client';

import { use } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import Link from 'next/link';
import CampaignBuilder from '@/components/studio/CampaignBuilder';

export default function NewCampaignPage({
  params,
}: {
  params: Promise<{ mint: string }>;
}) {
  const { mint } = use(params);
  const { publicKey } = useWallet();

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

      {publicKey ? (
        <CampaignBuilder mint={mint} creatorWallet={publicKey.toBase58()} />
      ) : (
        <div className="text-center pt-12">
          <p className="text-gray-400 mb-2">Connect your wallet to create a campaign</p>
          <p className="text-xs text-gray-600">
            Your wallet address is used to verify you as the coin creator
          </p>
        </div>
      )}
    </div>
  );
}
