-- ============================================
-- R2D Telegram Refinement — Database Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Add refined notification status columns to reminders
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS telegram_notified_30m_at TIMESTAMPTZ;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS telegram_notified_3m_at TIMESTAMPTZ;

-- 2. Add last daily preview tracking date to telegram_chats
ALTER TABLE telegram_chats ADD COLUMN IF NOT EXISTS last_daily_preview_date TEXT;
