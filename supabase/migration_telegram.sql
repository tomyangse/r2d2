-- ============================================
-- R2D Telegram Integration — Database Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. Telegram Chat Binding Table
-- Links a Telegram chat_id to a R2D user account
-- ============================================

CREATE TABLE IF NOT EXISTS telegram_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  chat_id BIGINT NOT NULL UNIQUE,
  username TEXT,
  first_name TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX idx_telegram_chats_user ON telegram_chats(user_id);
CREATE INDEX idx_telegram_chats_chat ON telegram_chats(chat_id);

ALTER TABLE telegram_chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own telegram" ON telegram_chats
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 2. Verification Codes for Linking
-- Temporary codes generated via /start in Telegram,
-- entered on the R2D web app to bind the account
-- ============================================

CREATE TABLE IF NOT EXISTS telegram_link_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  chat_id BIGINT NOT NULL,
  username TEXT,
  first_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '10 minutes'),
  used BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_link_codes_code ON telegram_link_codes(code);

-- ============================================
-- 3. Add Telegram notification tracking to reminders
-- Separate from notified_at (used by Web Push) so
-- both channels can fire independently
-- ============================================

ALTER TABLE reminders ADD COLUMN IF NOT EXISTS telegram_notified_at TIMESTAMPTZ;
