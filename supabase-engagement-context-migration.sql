-- Engagement context migration
-- Run this in the Supabase SQL editor

alter table projects add column if not exists engagement_context text;
