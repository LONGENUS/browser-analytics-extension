-- ==============================================================================
-- Supabase Migration: Legacy Product Removal & Clean Slate (Module 0.5)
-- Safely drops legacy browser analytics, scraping, and tracking database objects.
-- Preserves:
--   - auth.users
--   - public.profiles
--   - public.resumes and all child resume tables
--   - public.resume_imports and storage
-- ==============================================================================

-- 1. Drop Legacy Analytics & Scraper Tables (with cascading constraints)
DROP TABLE IF EXISTS public.exports CASCADE;
DROP TABLE IF EXISTS public.analyses CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- 2. Drop any legacy indexes if orphaned
DROP INDEX IF EXISTS public.idx_analyses_user_id;
DROP INDEX IF EXISTS public.idx_analyses_domain;
DROP INDEX IF EXISTS public.idx_analyses_created_at;
DROP INDEX IF EXISTS public.idx_analyses_url;
DROP INDEX IF EXISTS public.idx_exports_analysis_id;
DROP INDEX IF EXISTS public.idx_exports_created_at;
