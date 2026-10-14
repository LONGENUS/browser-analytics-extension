-- ==============================================================================
-- Migration: 20261008000008_resume_templates.sql
-- Description: Module 7 — Resume Templates & Presentation Foundation
-- Adds template selection and version persistence to resumes.
-- ==============================================================================

-- 1. Add template columns to public.resumes if not present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'resumes' AND column_name = 'template_id'
    ) THEN
        ALTER TABLE public.resumes ADD COLUMN template_id VARCHAR(50) NOT NULL DEFAULT 'ats-classic';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'resumes' AND column_name = 'template_version'
    ) THEN
        ALTER TABLE public.resumes ADD COLUMN template_version VARCHAR(20) NOT NULL DEFAULT 'v1.0.0';
    END IF;
END $$;

-- 2. Backward compatibility: ensure any existing null values default to 'ats-classic'
UPDATE public.resumes 
SET template_id = 'ats-classic' 
WHERE template_id IS NULL;

UPDATE public.resumes 
SET template_version = 'v1.0.0' 
WHERE template_version IS NULL;

-- 3. Indexes for template querying
CREATE INDEX IF NOT EXISTS idx_resumes_template_id ON public.resumes(template_id);
