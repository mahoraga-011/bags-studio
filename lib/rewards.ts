import { getServiceSupabase, getSupabase } from './supabase';
import { RewardVault, RewardEpoch, RewardClaim } from './types';

/**
 * Get or create reward vault config for a mint.
 */
export async function getVault(mint: string): Promise<RewardVault | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data } = await supabase
    .from('reward_vaults')
    .select('*')
    .eq('mint_address', mint)
    .single();

  return data as RewardVault | null;
}

/**
 * Setup reward vault for a mint.
 */
export async function setupVault(
  mint: string,
  vaultWallet: string,
  feeShareBps: number,
  fundingSource: string,
): Promise<RewardVault | null> {
  const supabase = getServiceSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('reward_vaults')
    .upsert({
      mint_address: mint,
      vault_wallet: vaultWallet,
      fee_share_bps: feeShareBps,
      funding_source: fundingSource,
    }, { onConflict: 'mint_address' })
    .select()
    .single();

  if (error) {
    console.error('Failed to setup vault:', error);
    return null;
  }

  return data as RewardVault;
}

/**
 * Create a new reward epoch (weekly distribution).
 */
export async function createEpoch(
  mint: string,
  vaultBalanceLamports: number,
): Promise<RewardEpoch | null> {
  const supabase = getServiceSupabase();
  if (!supabase) return null;

  // Get last epoch number
  const { data: lastEpoch } = await supabase
    .from('reward_epochs')
    .select('epoch_number')
    .eq('mint_address', mint)
    .order('epoch_number', { ascending: false })
    .limit(1)
    .single();

  const epochNumber = (lastEpoch?.epoch_number || 0) + 1;

  // Get leaderboard for distribution
  const { data: leaderboard } = await supabase
    .from('engagement_leaderboard')
    .select('wallet, total_points')
    .eq('mint_address', mint)
    .gt('total_points', 0)
    .order('total_points', { ascending: false });

  if (!leaderboard || leaderboard.length === 0) return null;

  const totalPoints = leaderboard.reduce((sum, e) => sum + Number(e.total_points), 0);
  if (totalPoints === 0) return null;

  // Create epoch
  const { data: epoch, error } = await supabase
    .from('reward_epochs')
    .insert({
      mint_address: mint,
      epoch_number: epochNumber,
      vault_balance: vaultBalanceLamports,
      eligible_wallets: leaderboard.length,
    })
    .select()
    .single();

  if (error || !epoch) {
    console.error('Failed to create epoch:', error);
    return null;
  }

  // Create pro-rata claims for each eligible wallet
  const claims = leaderboard.map(entry => ({
    epoch_id: epoch.id,
    mint_address: mint,
    wallet: entry.wallet,
    points_at_snapshot: Number(entry.total_points),
    reward_lamports: Math.floor((Number(entry.total_points) / totalPoints) * vaultBalanceLamports),
  }));

  for (let i = 0; i < claims.length; i += 500) {
    await supabase.from('reward_claims').insert(claims.slice(i, i + 500));
  }

  return epoch as RewardEpoch;
}

/**
 * Get claimable rewards for a wallet.
 */
export async function getWalletRewards(
  mint: string,
  wallet: string,
): Promise<RewardClaim[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data } = await supabase
    .from('reward_claims')
    .select('*')
    .eq('mint_address', mint)
    .eq('wallet', wallet)
    .order('epoch_id', { ascending: false });

  return (data || []) as RewardClaim[];
}

/**
 * Mark a reward as claimed after tx confirmation.
 */
export async function markRewardClaimed(
  claimId: string,
  signature: string,
): Promise<boolean> {
  const supabase = getServiceSupabase();
  if (!supabase) return false;

  const { error } = await supabase
    .from('reward_claims')
    .update({
      claimed: true,
      signature,
      claimed_at: new Date().toISOString(),
    })
    .eq('id', claimId);

  if (error) return false;

  // Update vault total_claimed
  const { data: claim } = await supabase
    .from('reward_claims')
    .select('mint_address, reward_lamports')
    .eq('id', claimId)
    .single();

  if (claim) {
    // Update vault total_claimed manually
    const { data: vault } = await supabase
      .from('reward_vaults')
      .select('total_claimed')
      .eq('mint_address', claim.mint_address)
      .single();

    if (vault) {
      await supabase
        .from('reward_vaults')
        .update({ total_claimed: Number(vault.total_claimed) + Number(claim.reward_lamports) })
        .eq('mint_address', claim.mint_address);
    }
  }

  return true;
}

/**
 * Get epoch history for a mint.
 */
export async function getEpochHistory(mint: string): Promise<RewardEpoch[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data } = await supabase
    .from('reward_epochs')
    .select('*')
    .eq('mint_address', mint)
    .order('epoch_number', { ascending: false });

  return (data || []) as RewardEpoch[];
}
