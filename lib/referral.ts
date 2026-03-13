import { getServiceSupabase, getSupabase } from './supabase';
import { ReferralCode, Referral } from './types';
import { REFERRAL_CODE_LENGTH, POINTS_REFERRER, POINTS_REFERRED } from './constants';
import { awardPoints } from './points';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Get or create a referral code for a wallet+mint pair.
 */
export async function getOrCreateReferralCode(
  mint: string,
  wallet: string,
): Promise<ReferralCode | null> {
  const supabase = getServiceSupabase();
  if (!supabase) return null;

  // Check if code already exists
  const { data: existing } = await supabase
    .from('referral_codes')
    .select('*')
    .eq('mint_address', mint)
    .eq('wallet', wallet)
    .single();

  if (existing) return existing as ReferralCode;

  // Generate unique code
  let code = generateCode();
  let attempts = 0;
  while (attempts < 5) {
    const { error } = await supabase.from('referral_codes').insert({
      code,
      mint_address: mint,
      wallet,
    });
    if (!error) break;
    code = generateCode();
    attempts++;
  }

  const { data } = await supabase
    .from('referral_codes')
    .select('*')
    .eq('code', code)
    .single();

  return data as ReferralCode | null;
}

/**
 * Look up a referral code.
 */
export async function getReferralCode(code: string): Promise<ReferralCode | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data } = await supabase
    .from('referral_codes')
    .select('*')
    .eq('code', code)
    .single();

  return data as ReferralCode | null;
}

/**
 * Record a referral (pending verification).
 */
export async function createReferral(
  mint: string,
  referrerWallet: string,
  referredWallet: string,
  code: string,
): Promise<Referral | null> {
  const supabase = getServiceSupabase();
  if (!supabase) return null;

  // Can't refer yourself
  if (referrerWallet === referredWallet) return null;

  // Check if already referred
  const { data: existing } = await supabase
    .from('referrals')
    .select('*')
    .eq('mint_address', mint)
    .eq('referred_wallet', referredWallet)
    .single();

  if (existing) return existing as Referral;

  const { data, error } = await supabase
    .from('referrals')
    .insert({
      mint_address: mint,
      referrer_wallet: referrerWallet,
      referred_wallet: referredWallet,
      referral_code: code,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create referral:', error);
    return null;
  }

  return data as Referral;
}

/**
 * Verify a pending referral (called when referred wallet is confirmed as holder).
 */
export async function verifyReferral(
  mint: string,
  referredWallet: string,
): Promise<boolean> {
  const supabase = getServiceSupabase();
  if (!supabase) return false;

  const { data: referral } = await supabase
    .from('referrals')
    .select('*')
    .eq('mint_address', mint)
    .eq('referred_wallet', referredWallet)
    .eq('status', 'pending')
    .single();

  if (!referral) return false;

  const { error } = await supabase
    .from('referrals')
    .update({ status: 'verified', verified_at: new Date().toISOString() })
    .eq('id', referral.id);

  if (error) return false;

  // Award points to both parties
  await Promise.all([
    awardPoints(mint, referral.referrer_wallet, POINTS_REFERRER, 'referral', referral.id),
    awardPoints(mint, referral.referred_wallet, POINTS_REFERRED, 'referral', referral.id),
  ]);

  // Add to activity feed
  await supabase.from('activity_feed').insert([
    {
      mint_address: mint,
      wallet: referral.referrer_wallet,
      event_type: 'referral_verified',
      title: `Referred ${referredWallet.slice(0, 6)}...${referredWallet.slice(-4)}`,
      metadata: { referred_wallet: referredWallet, points: POINTS_REFERRER },
    },
  ]);

  return true;
}

/**
 * Get referral stats for a wallet.
 */
export async function getReferralStats(
  mint: string,
  wallet: string,
): Promise<{ code: string | null; total: number; verified: number; pending: number }> {
  const supabase = getSupabase();
  if (!supabase) return { code: null, total: 0, verified: 0, pending: 0 };

  const { data: codeData } = await supabase
    .from('referral_codes')
    .select('code')
    .eq('mint_address', mint)
    .eq('wallet', wallet)
    .single();

  const { data: referrals } = await supabase
    .from('referrals')
    .select('status')
    .eq('mint_address', mint)
    .eq('referrer_wallet', wallet);

  const total = referrals?.length || 0;
  const verified = referrals?.filter(r => r.status === 'verified').length || 0;

  return {
    code: codeData?.code || null,
    total,
    verified,
    pending: total - verified,
  };
}
