-- ==============================================================================
-- Migration: 20261008000007_resume_tailoring.sql
-- Description: Module 6 — Resume Tailoring Engine Foundation
-- Adds tailored resume relationships, metadata tracking, and RLS policies.
-- ==============================================================================

-- 1. Add source tracking columns to public.resumes if not present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'resumes' AND column_name = 'source_resume_id'
    ) THEN
        ALTER TABLE public.resumes ADD COLUMN source_resume_id UUID REFERENCES public.resumes(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'resumes' AND column_name = 'target_job_id'
    ) THEN
        ALTER TABLE public.resumes ADD COLUMN target_job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'resumes' AND column_name = 'is_tailored'
    ) THEN
        ALTER TABLE public.resumes ADD COLUMN is_tailored BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- Indexes for resumes tailoring lookup
CREATE INDEX IF NOT EXISTS idx_resumes_source_resume_id ON public.resumes(source_resume_id);
CREATE INDEX IF NOT EXISTS idx_resumes_target_job_id ON public.resumes(target_job_id);

-- 2. Create public.tailored_resumes metadata table
CREATE TABLE IF NOT EXISTS public.tailored_resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    source_resume_id UUID NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
    target_job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    tailored_resume_id UUID NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
    tailoring_mode VARCHAR(50) NOT NULL DEFAULT 'balanced',
    tailoring_plan JSONB NOT NULL DEFAULT '{}'::jsonb,
    change_log JSONB NOT NULL DEFAULT '[]'::jsonb,
    original_match_score INTEGER NULL,
    tailored_match_score INTEGER NULL,
    algorithm_version VARCHAR(20) NOT NULL DEFAULT 'v1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Indexes for tailored_resumes
CREATE INDEX IF NOT EXISTS idx_tailored_resumes_user_id ON public.tailored_resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_tailored_resumes_source_job ON public.tailored_resumes(user_id, source_resume_id, target_job_id);
CREATE INDEX IF NOT EXISTS idx_tailored_resumes_tailored_id ON public.tailored_resumes(tailored_resume_id);
CREATE INDEX IF NOT EXISTS idx_tailored_resumes_created_at ON public.tailored_resumes(created_at DESC);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_tailored_resumes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_tailored_resumes_updated_at ON public.tailored_resumes;
CREATE TRIGGER trigger_tailored_resumes_updated_at
    BEFORE UPDATE ON public.tailored_resumes
    FOR EACH ROW
    EXECUTE FUNCTION update_tailored_resumes_updated_at();

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.tailored_resumes ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies (strictly isolated by auth.uid())
CREATE POLICY "Users can view own tailored resumes"
    ON public.tailored_resumes FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tailored resumes"
    ON public.tailored_resumes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tailored resumes"
    ON public.tailored_resumes FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tailored resumes"
    ON public.tailored_resumes FOR DELETE
    USING (auth.uid() = user_id);
