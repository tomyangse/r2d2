-- ============================================
-- R2D Push Notifications Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Push subscriptions table (stores browser push endpoints)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- RLS: users can only manage their own subscriptions
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push_subscriptions"
  ON push_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Add notified_at to reminders (to track which reminders were already pushed)
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;

-- Index for fast lookup of upcoming un-notified reminders
CREATE INDEX IF NOT EXISTS idx_reminders_notify
  ON reminders(datetime, notified_at)
  WHERE completed = FALSE AND notified_at IS NULL;
