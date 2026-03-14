/**
 * Solana RPC helpers for on-chain verification.
 */

export function getRpcUrl(): string {
  return process.env.HELIUS_API_KEY
    ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
    : 'https://api.mainnet-beta.solana.com';
}

/**
 * Get SPL token balance for a wallet.
 * Returns human-readable amount (decimals applied).
 */
export async function getSplTokenBalance(wallet: string, mint: string): Promise<number> {
  const rpcUrl = getRpcUrl();

  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTokenAccountsByOwner',
      params: [
        wallet,
        { mint },
        { encoding: 'jsonParsed' },
      ],
    }),
  });

  const json = await res.json();
  const accounts = json.result?.value;

  if (!accounts || accounts.length === 0) return 0;

  // Sum across all token accounts for this mint (usually just 1)
  let total = 0;
  for (const account of accounts) {
    const tokenAmount = account.account?.data?.parsed?.info?.tokenAmount;
    if (tokenAmount) {
      total += tokenAmount.uiAmount || 0;
    }
  }

  return total;
}

/**
 * Get SOL balance for a wallet (in lamports).
 */
export async function getSolBalance(wallet: string): Promise<number> {
  const rpcUrl = getRpcUrl();

  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getBalance',
      params: [wallet],
    }),
  });

  const json = await res.json();
  return json.result?.value || 0;
}
