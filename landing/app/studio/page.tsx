'use client';

import CoinSelector from '@/components/studio/CoinSelector';

export default function StudioPage() {
  return (
    <div className="max-w-4xl mx-auto pt-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-display font-bold mb-3">
          Welcome to <span className="text-green">BagsStudio</span>
        </h1>
        <p className="text-gray-400 max-w-lg mx-auto">
          Connect your Bags coin to analyze supporter conviction, build leaderboards, and create targeted campaigns.
        </p>
      </div>
      <CoinSelector />
    </div>
  );
}
