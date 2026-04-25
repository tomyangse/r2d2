-- ============================================
-- R2D Auth Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Add user_id column to all tables
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE shopping_items ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Create indexes on user_id
CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_shopping_items_user_id ON shopping_items(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);

-- 3. Drop old permissive RLS policies
DROP POLICY IF EXISTS "Allow all on reminders" ON reminders;
DROP POLICY IF EXISTS "Allow all on shopping_items" ON shopping_items;
DROP POLICY IF EXISTS "Allow all on messages" ON messages;

-- 4. Create user-scoped RLS policies

-- Reminders: users can only see/modify their own
CREATE POLICY "Users manage own reminders"
  ON reminders FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Shopping Items: users can only see/modify their own
CREATE POLICY "Users manage own shopping_items"
  ON shopping_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Messages: users can only see/modify their own
CREATE POLICY "Users manage own messages"
  ON messages FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Edge Function uses service_role key, so it bypasses RLS.
-- No additional policy needed for the Edge Function.

-- 5. Update the trigger function to pass user_id
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
  RAISE WARNING 'Edge function trigger failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
