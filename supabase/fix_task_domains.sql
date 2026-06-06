-- Run this in your Supabase SQL Editor to fix existing mismatched task domains
UPDATE tasks t
SET domain = p.domain
FROM projects p
WHERE t.project_id = p.id AND t.domain != p.domain;
