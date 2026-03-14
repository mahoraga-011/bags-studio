import { getServiceSupabase, getSupabase } from './supabase';

const SOL_MINT = 'So11111111111111111111111111111111111111112';

/**
 * Log a trade for volume tracking.
 */
export async function logTrade(data: {
  mint_address: string;
  wallet: string;
  input_mint: string;
  output_mint: string;
  amount_in: number;
  amount_out: number;
}): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) return;

  const { error } = await supabase.from('trade_logs').insert({
    mint_address: data.mint_address,
    wallet: data.wallet,
    input_mint: data.input_mint,
    output_mint: data.output_mint,
    amount_in: data.amount_in,
    amount_out: data.amount_out,
  });

  if (error) {
    console.error('Failed to log trade:', error);
  }
}

/**
 * Get total trade volume for a wallet on a specific token.
 * Sums amount_in for all trades involving this mint.
 */
export async function getTradeVolume(mint: string, wallet: string): Promise<number> {
  const supabase = getSupabase();
  if (!supabase) return 0;

  const { data } = await supabase
    .from('trade_logs')
    .select('amount_in')
    .eq('mint_address', mint)
    .eq('wallet', wallet);

  if (!data || data.length === 0) return 0;

  return data.reduce((sum, row) => sum + Number(row.amount_in), 0);
}

/**
 * Determine the token mint from a swap pair (the non-SOL side).
 */
export function resolveTokenMint(inputMint: string, outputMint: string): string {
  if (inputMint === SOL_MINT) return outputMint;
  if (outputMint === SOL_MINT) return inputMint;
  // Both are tokens — use inputMint as the "traded" token
  return inputMint;
}
