import { ConvictionTier } from './types';

export const BAGS_API_BASE = 'https://public-api-v2.bags.fm/api/v1';

export const TIER_PERCENTILES: Record<ConvictionTier, number> = {
  Champion: 0.01,
  Catalyst: 0.05,
  Loyal: 0.15,
  Active: 0.40,
  OG: 1.0,
};

export const TIER_COLORS: Record<ConvictionTier, string> = {
  Champion: '#FFD700',
  Catalyst: '#C084FC',
  Loyal: '#00E676',
  Active: '#60A5FA',
  OG: '#A1A1A1',
};

export const TIER_ORDER: ConvictionTier[] = ['Champion', 'Catalyst', 'Loyal', 'Active', 'OG'];

export const CAMPAIGN_TYPES = [
  { value: 'airdrop', label: 'Airdrop' },
  { value: 'allowlist', label: 'Allowlist' },
  { value: 'nft_mint', label: 'NFT Mint' },
  { value: 'custom', label: 'Custom' },
] as const;

// Bags API endpoint paths (based on official docs)
export const BAGS_ENDPOINTS = {
  TOKEN_CREATORS: '/token-launch/creator/v3',
  TOKEN_CLAIM_STATS: '/token-launch/claim-stats',
  TOKEN_LIFETIME_FEES: '/token-launch/lifetime-fees',
  CLAIM_EVENTS: '/fee-share/token/claim-events',
  ADMIN_LIST: '/fee-share/admin/list',
  POOL_BY_MINT: '/solana/bags/pools/token-mint',
} as const;

// Engagement constants
export const HOLD_POINTS_BY_TIER: Record<ConvictionTier, number> = {
  Champion: 20,
  Catalyst: 10,
  Loyal: 5,
  Active: 2,
  OG: 1,
};

export const POINTS_PER_CLAIM = 10;
export const POINTS_REFERRER = 50;
export const POINTS_REFERRED = 25;
export const STREAK_BONUS_POINTS = 5;
export const DECAY_RATE = 0.9; // 10% per month
export const REFERRAL_CODE_LENGTH = 8;

export const QUEST_TYPES = [
  { value: 'hold_duration', label: 'Hold Duration' },
  { value: 'claim_count', label: 'Claim Count' },
  { value: 'referral_count', label: 'Referral Count' },
  { value: 'social_share', label: 'Social Share' },
  { value: 'custom', label: 'Custom' },
] as const;

export const FEED_EVENT_LABELS: Record<string, string> = {
  quest_complete: 'Quest Completed',
  referral_verified: 'Referral Verified',
  streak_milestone: 'Streak Milestone',
  tier_up: 'Tier Upgrade',
  reward_claimed: 'Reward Claimed',
};

// Bags API endpoints for wrapper features
export const BAGS_WRAPPER_ENDPOINTS = {
  CREATE_TOKEN_INFO: '/token-launch/create-token-info',
  CREATE_TOKEN_LAUNCH_TX: '/token-launch/create-token-launch-transaction',
  FEE_SHARE_CONFIG: '/fee-share/config',
  TRADE_QUOTE: '/trade/quote',
  TRADE_SWAP: '/trade/swap',
  CLAIMABLE_POSITIONS: '/token-launch/claimable-positions',
  CLAIM_TXS: '/token-launch/claim-txs/v3',
} as const;
