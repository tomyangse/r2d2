-- R2D Database Schema
-- Run this in the Supabase SQL Editor

-- ============================================
-- 1. Core Tables
-- ============================================

-- Reminders / Schedule / Appointments
CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  datetime TIMESTAMPTZ,
  notes TEXT,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shopping List Items
CREATE TABLE IF NOT EXISTS shopping_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  checked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. Message Queue (async AI processing)
-- ============================================

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  input TEXT NOT NULL,
  source TEXT DEFAULT 'text',       -- 'text' | 'voice'
  status TEXT DEFAULT 'pending',    -- pending | processing | done | error
  result JSONB,                     -- AI parsed result
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- ============================================
-- 3. Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_reminders_datetime ON reminders(datetime);
CREATE INDEX IF NOT EXISTS idx_reminders_completed ON reminders(completed);
CREATE INDEX IF NOT EXISTS idx_shopping_items_checked ON shopping_items(checked);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);

-- ============================================
-- 4. Row Level Security (permissive for now)
-- ============================================

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on reminders" ON reminders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on shopping_items" ON shopping_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on messages" ON messages FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 5. Enable Realtime for live updates
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE reminders;
ALTER PUBLICATION supabase_realtime ADD TABLE shopping_items;

-- ============================================
-- 6. pg_net trigger → Edge Function
-- ============================================
-- NOTE: Enable the pg_net extension in Supabase Dashboard first:
--   Database → Extensions → search "pg_net" → Enable
--
-- Then replace <YOUR_SUPABASE_URL> and <YOUR_SERVICE_ROLE_KEY> below.
-- The service role key is found in: Settings → API → service_role key
-- ============================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM extensions.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/process-message',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object('message_id', NEW.id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Don't block the INSERT if trigger fails
  RAISE WARNING 'Edge function trigger failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_new_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_message();

-- ============================================
-- 7. Set app.settings for the trigger
-- ============================================
-- Run these with your actual values:
--
-- ALTER DATABASE postgres SET app.settings.supabase_url = 'https://xxx.supabase.co';
-- ALTER DATABASE postgres SET app.settings.service_role_key = 'eyJ...';
