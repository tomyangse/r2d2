-- Add recurrence support to reminders
-- Run this in Supabase SQL Editor

ALTER TABLE reminders ADD COLUMN IF NOT EXISTS recurrence text DEFAULT null;

-- recurrence values:
-- null = one-time reminder
-- "daily" = every day
-- "weekly:0" = every Sunday (0=Sun, 1=Mon, ..., 6=Sat)
-- "weekly:1" = every Monday
-- "monthly:15" = every month on the 15th
-- "weekdays" = Monday to Friday
-- "biweekly:3" = every other Wednesday

COMMENT ON COLUMN reminders.recurrence IS 'Recurrence pattern: null=once, daily, weekly:0-6, monthly:1-31, weekdays, biweekly:0-6';
