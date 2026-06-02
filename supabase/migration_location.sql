-- Add location field to reminders table
-- Run this in the Supabase SQL Editor

ALTER TABLE reminders ADD COLUMN IF NOT EXISTS location TEXT;
