-- Supabase Migration: Add Notes Table
-- Execute this script in your Supabase SQL Editor

-- 1. Create notes table
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  type TEXT NOT NULL DEFAULT 'sticky', -- 'sticky' | 'checklist' | 'rich'
  color_theme TEXT DEFAULT 'indigo', -- 'amber' | 'indigo' | 'rose' | 'emerald' | 'cyan' | 'violet'
  is_pinned BOOLEAN DEFAULT FALSE,
  user_id UUID, -- For simplicity of auth context mapping
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_is_pinned ON notes(is_pinned DESC);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Permissive policy matching R2D schema
CREATE POLICY "Allow all on notes" ON notes FOR ALL USING (true) WITH CHECK (true);

-- 3. Add notes table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE notes;
