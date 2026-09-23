-- ==============================================================================
-- Supabase Migration: Initial Production Schema for Browser Analytics Extension
-- Tables: users, analyses, exports
-- Features: Foreign keys, cascade rules, JSONB storage, indexes, RLS policies
-- ==============================================================================

-- 1. Enable UUID Extension (standard for Supabase / PostgreSQL)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create Users Table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Analyses Table
CREATE TABLE IF NOT EXISTS public.analyses (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    url TEXT NOT NULL,
    title TEXT,
    metrics JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create Exports Table
CREATE TABLE IF NOT EXISTS public.exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id TEXT REFERENCES public.analyses(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    format VARCHAR(10) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Create Indexes for High-Performance Queries
CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON public.analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_url ON public.analyses(url);
CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON public.analyses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_metrics_gin ON public.analyses USING gin (metrics);
CREATE INDEX IF NOT EXISTS idx_exports_analysis_id ON public.exports(analysis_id);
CREATE INDEX IF NOT EXISTS idx_exports_created_at ON public.exports(created_at DESC);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exports ENABLE ROW LEVEL SECURITY;

-- 7. Row Level Security Policies

-- USERS: Authenticated users can view their own profile; service role has full access
CREATE POLICY "Users can view own profile"
    ON public.users
    FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Service role full access on users"
    ON public.users
    FOR ALL
    USING (auth.role() = 'service_role');

-- ANALYSES: Authenticated users can manage their own analyses; service role has full access
CREATE POLICY "Users can view own analyses"
    ON public.analyses
    FOR SELECT
    USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert own analyses"
    ON public.analyses
    FOR INSERT
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can delete own analyses"
    ON public.analyses
    FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on analyses"
    ON public.analyses
    FOR ALL
    USING (auth.role() = 'service_role');

-- EXPORTS: Users can access exports tied to their analyses
CREATE POLICY "Users can view own exports"
    ON public.exports
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.analyses a
            WHERE a.id = exports.analysis_id
            AND (a.user_id = auth.uid() OR a.user_id IS NULL)
        )
    );

CREATE POLICY "Service role full access on exports"
    ON public.exports
    FOR ALL
    USING (auth.role() = 'service_role');
