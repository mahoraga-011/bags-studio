-- Quest System Expansion: new quest types + trade logging
-- Run against Supabase via Dashboard SQL editor or supabase db push

-- 1. Expand quest_type CHECK constraint
ALTER TABLE quests DROP CONSTRAINT IF EXISTS quests_quest_type_check;
ALTER TABLE quests ADD CONSTRAINT quests_quest_type_check
  CHECK (quest_type IN (
    'hold_duration', 'claim_count', 'referral_count', 'social_share', 'custom',
    'token_balance', 'trade_volume', 'streak', 'tier_reached', 'meta'
  ));

-- 2. Create trade_logs table
CREATE TABLE IF NOT EXISTS trade_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  mint_address text NOT NULL,
  wallet text NOT NULL,
  input_mint text NOT NULL,
  output_mint text NOT NULL,
  amount_in numeric NOT NULL,
  amount_out numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trade_logs_mint_wallet ON trade_logs (mint_address, wallet);
CREATE INDEX IF NOT EXISTS idx_trade_logs_wallet ON trade_logs (wallet);
