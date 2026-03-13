// Bags API types

export interface TokenMetadata {
  mint: string;
  name: string;
  symbol: string;
  image: string;
  creator?: string;
  description?: string;
}

export interface FeeShareInfo {
  tokenMint: string;
  totalFeesEarned: number;
  totalClaimed: number;
  totalUnclaimed: number;
  claimCount: number;
  uniqueClaimers: number;
}

export interface PoolInfo {
  tokenMint: string;
  liquidity: number;
  volume24h: number;
  price: number;
  marketCap: number;
}

export interface ClaimEvent {
  wallet: string;
  amount: number;
  timestamp: string;
  tokenMint: string;
  signature?: string;
}

export interface ClaimEventsResponse {
  claimEvents: ClaimEvent[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminToken {
  mint: string;
  name: string;
  symbol: string;
  image: string;
}

// Conviction scoring types

export interface WalletScore {
  wallet: string;
  score: number;
  tier: ConvictionTier;
  earlyScore: number;
  volumeScore: number;
  consistencyScore: number;
  recencyScore: number;
  claimCount: number;
  totalClaimed: number;
  firstClaimAt: string;
  lastClaimAt: string;
  distinctDays: number;
}

export type ConvictionTier = 'Champion' | 'Catalyst' | 'Loyal' | 'Active' | 'OG';

// Campaign types

export interface Campaign {
  id: string;
  mint_address: string;
  creator_wallet: string;
  name: string;
  type: CampaignType;
  tier_threshold: ConvictionTier;
  max_wallets: number | null;
  status: CampaignStatus;
  created_at: string;
  description?: string;
}

export type CampaignType = 'airdrop' | 'allowlist' | 'nft_mint' | 'custom';
export type CampaignStatus = 'draft' | 'active' | 'completed' | 'cancelled';

export interface CampaignEligibility {
  id: string;
  campaign_id: string;
  wallet: string;
  score: number;
  tier: ConvictionTier;
  eligible: boolean;
  claimed: boolean;
}

// Coin record

export interface CoinRecord {
  id: string;
  mint_address: string;
  creator_wallet: string;
  name: string;
  symbol: string;
  image_url: string;
  connected_at: string;
}
