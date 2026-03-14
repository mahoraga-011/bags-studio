'use client';

import { use } from 'react';
import { motion } from 'framer-motion';
import CommunityWall from '@/components/studio/CommunityWall';

export default function CommunityPage({ params }: { params: Promise<{ mint: string }> }) {
  const { mint } = use(params);

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-6"
      >
        <div>
          <h1 className="text-2xl font-display font-bold">Community</h1>
          <p className="text-sm text-gray-500 mt-1">Token holders only. Say something, react, vibe.</p>
        </div>
      </motion.div>

      <CommunityWall mint={mint} />
    </div>
  );
}
