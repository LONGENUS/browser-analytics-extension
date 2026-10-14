-- ==============================================================================
-- Migration: 20261014000002_original_file_data.sql
-- Description: Adds original_file_data column to resumes and resume_imports tables
-- to guarantee persistent byte-for-byte original PDF and DOCX storage.
-- ==============================================================================

ALTER TABLE public.resumes 
    ADD COLUMN IF NOT EXISTS original_file_data TEXT;

ALTER TABLE public.resume_imports
    ADD COLUMN IF NOT EXISTS original_file_data TEXT;
