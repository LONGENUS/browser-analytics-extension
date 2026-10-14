-- ==============================================================================
-- Migration: 20261014000003_resume_change_records.sql
-- Description: Creates resume_change_records table with RLS for AI Change Tracking
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.resume_change_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    source_resume_id UUID NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
    tailored_resume_id UUID NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
    section VARCHAR(100) NOT NULL,
    paragraph_id VARCHAR(100) NOT NULL,
    section_title VARCHAR(255) NOT NULL,
    item_title VARCHAR(255),
    change_type VARCHAR(50) NOT NULL, -- 'added', 'modified', 'removed', 'unchanged'
    original_text TEXT,
    proposed_text TEXT,
    diff_segments JSONB NOT NULL DEFAULT '[]'::jsonb,
    explanation TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'accepted', -- 'pending', 'accepted', 'rejected'
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_change_records_user ON public.resume_change_records(user_id);
CREATE INDEX IF NOT EXISTS idx_change_records_tailored ON public.resume_change_records(tailored_resume_id);
CREATE INDEX IF NOT EXISTS idx_change_records_source ON public.resume_change_records(source_resume_id);

-- Enable RLS
ALTER TABLE public.resume_change_records ENABLE ROW LEVEL SECURITY;

-- Policies: Multi-tenant user isolation
CREATE POLICY "Users can view their own change records"
    ON public.resume_change_records FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own change records"
    ON public.resume_change_records FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own change records"
    ON public.resume_change_records FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own change records"
    ON public.resume_change_records FOR DELETE
    USING (auth.uid() = user_id);
