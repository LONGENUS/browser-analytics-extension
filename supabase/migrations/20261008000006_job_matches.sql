-- ==============================================================================
-- Migration: 20261008000006_job_matches.sql
-- Description: Module 5 — Job ↔ Resume Matching
-- Creates the job_matches table with Row Level Security (RLS)
-- and deterministic matching analysis records.
-- ==============================================================================

-- 1. Create job_matches table
CREATE TABLE IF NOT EXISTS public.job_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    resume_id UUID NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
    overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
    category_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
    matched_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    missing_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    responsibilities_analysis JSONB NOT NULL DEFAULT '[]'::jsonb,
    experience_assessment JSONB NOT NULL DEFAULT '{}'::jsonb,
    qualification_assessment JSONB NOT NULL DEFAULT '{}'::jsonb,
    keyword_coverage JSONB NOT NULL DEFAULT '{}'::jsonb,
    evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
    algorithm_version VARCHAR(20) NOT NULL DEFAULT 'v1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 2. Indexes for efficient querying, user lookup, and re-calculation checks
CREATE INDEX IF NOT EXISTS idx_job_matches_user_id ON public.job_matches(user_id);
CREATE INDEX IF NOT EXISTS idx_job_matches_job_resume ON public.job_matches(user_id, job_id, resume_id);
CREATE INDEX IF NOT EXISTS idx_job_matches_created_at ON public.job_matches(created_at DESC);

-- 3. Trigger for updated_at
CREATE OR REPLACE FUNCTION update_job_matches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_job_matches_updated_at ON public.job_matches;
CREATE TRIGGER trigger_job_matches_updated_at
    BEFORE UPDATE ON public.job_matches
    FOR EACH ROW
    EXECUTE FUNCTION update_job_matches_updated_at();

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.job_matches ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies (strictly isolated by auth.uid())
CREATE POLICY "Users can view own job matches"
    ON public.job_matches FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own job matches"
    ON public.job_matches FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own job matches"
    ON public.job_matches FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own job matches"
    ON public.job_matches FOR DELETE
    USING (auth.uid() = user_id);
