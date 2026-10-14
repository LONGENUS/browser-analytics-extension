-- ==============================================================================
-- Migration: 20261008000009_tailored_resumes_preservation.sql
-- Description: Module 10 & 11 — Hardening Tailored Resume Historical Preservation
-- Preserves historical tailored resumes and audit trails when master resumes or
-- saved jobs are removed, setting foreign keys to NULL instead of cascading deletion.
-- ==============================================================================

DO $$
BEGIN
    -- 1. Ensure columns are nullable
    ALTER TABLE public.tailored_resumes 
        ALTER COLUMN source_resume_id DROP NOT NULL,
        ALTER COLUMN target_job_id DROP NOT NULL;

    -- 2. Drop existing CASCADE foreign keys if present
    ALTER TABLE public.tailored_resumes 
        DROP CONSTRAINT IF EXISTS tailored_resumes_source_resume_id_fkey,
        DROP CONSTRAINT IF EXISTS tailored_resumes_target_job_id_fkey;

    -- 3. Re-create foreign keys with ON DELETE SET NULL
    ALTER TABLE public.tailored_resumes
        ADD CONSTRAINT tailored_resumes_source_resume_id_fkey
        FOREIGN KEY (source_resume_id) REFERENCES public.resumes(id) ON DELETE SET NULL;

    ALTER TABLE public.tailored_resumes
        ADD CONSTRAINT tailored_resumes_target_job_id_fkey
        FOREIGN KEY (target_job_id) REFERENCES public.jobs(id) ON DELETE SET NULL;

    -- 4. Verify RLS policy for tailored resumes
    ALTER TABLE public.tailored_resumes ENABLE ROW LEVEL SECURITY;

END $$;
