-- ==============================================================================
-- Migration: 20261014000001_master_resume_preservation.sql
-- Description: Adds master resume preservation fields (SHA-256 hash, original filename,
-- original file path, file type, file size) to resumes and resume_imports tables.
-- Guarantees byte-for-byte master resume immutability across tailoring operations.
-- ==============================================================================

ALTER TABLE public.resumes 
    ADD COLUMN IF NOT EXISTS file_sha256 VARCHAR(64),
    ADD COLUMN IF NOT EXISTS original_filename VARCHAR(255),
    ADD COLUMN IF NOT EXISTS original_file_path VARCHAR(500),
    ADD COLUMN IF NOT EXISTS file_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS file_size INTEGER;

CREATE INDEX IF NOT EXISTS idx_resumes_file_sha256 ON public.resumes(file_sha256);

ALTER TABLE public.resume_imports
    ADD COLUMN IF NOT EXISTS file_sha256 VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_resume_imports_file_sha256 ON public.resume_imports(file_sha256);
