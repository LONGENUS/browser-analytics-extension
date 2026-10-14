-- ==============================================================================
-- Migration: 20261008000005_jobs_foundation.sql
-- Description: Module 4 — Job Detection & Job Description Extraction
-- Creates the structured jobs table with Row Level Security (RLS)
-- and user isolation enforced by auth.uid().
-- ==============================================================================

-- 1. Create jobs table
CREATE TABLE IF NOT EXISTS public.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    source VARCHAR(50) NOT NULL DEFAULT 'other',
    source_url TEXT,
    job_title VARCHAR(255) NOT NULL,
    company_name VARCHAR(255),
    company_url VARCHAR(500),
    location VARCHAR(255),
    employment_type VARCHAR(100),
    work_mode VARCHAR(50),
    department VARCHAR(100),
    job_description TEXT NOT NULL,
    requirements TEXT,
    responsibilities TEXT,
    qualifications TEXT,
    salary_text VARCHAR(255),
    job_posted_at VARCHAR(100),
    extracted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 2. Indexes for efficient querying & deduplication
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON public.jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_user_source_url ON public.jobs(user_id, source_url);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON public.jobs(created_at DESC);

-- 3. Trigger for updated_at
CREATE OR REPLACE FUNCTION update_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_jobs_updated_at ON public.jobs;
CREATE TRIGGER trigger_jobs_updated_at
    BEFORE UPDATE ON public.jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_jobs_updated_at();

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies (strictly isolated by auth.uid())
CREATE POLICY "Users can view own jobs"
    ON public.jobs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own jobs"
    ON public.jobs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own jobs"
    ON public.jobs FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own jobs"
    ON public.jobs FOR DELETE
    USING (auth.uid() = user_id);
