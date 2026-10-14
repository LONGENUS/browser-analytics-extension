-- ==============================================================================
-- Migration: 20261008000003_resume_upload_and_parsing.sql
-- Description: Module 3 — Resume Upload & Parsing Tracking & Storage Foundation
-- Tracks resume import sessions and enforces strict user isolation via RLS.
-- ==============================================================================

-- 1. Resume Imports Tracking Table
CREATE TABLE IF NOT EXISTS public.resume_imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    original_filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL, -- 'pdf' or 'docx'
    file_size INTEGER NOT NULL,      -- size in bytes
    storage_path VARCHAR(500),       -- path in private Supabase Storage bucket
    status VARCHAR(50) NOT NULL DEFAULT 'uploaded', -- 'uploaded', 'processing', 'parsed', 'review_required', 'completed', 'failed'
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Index for user query performance
CREATE INDEX IF NOT EXISTS idx_resume_imports_user_id ON public.resume_imports(user_id);
CREATE INDEX IF NOT EXISTS idx_resume_imports_status ON public.resume_imports(status);

-- 2. Row Level Security (RLS) on resume_imports
ALTER TABLE public.resume_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY resume_imports_select_own ON public.resume_imports
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY resume_imports_insert_own ON public.resume_imports
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY resume_imports_update_own ON public.resume_imports
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY resume_imports_delete_own ON public.resume_imports
    FOR DELETE USING (auth.uid() = user_id);

-- Service role bypass for backend background workers / maintenance
CREATE POLICY resume_imports_service_role ON public.resume_imports
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. Storage Bucket Configuration (Private)
-- Inserts the private 'resume-imports' bucket if storage schema is available
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'resume-imports',
    'resume-imports',
    false, -- STRICTLY PRIVATE
    10485760, -- 10 MB limit
    ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

-- Storage RLS Policies: User isolation within private bucket
-- Users can only read/upload/delete within their own {user_id}/ folder
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'objects') THEN
        -- Allow authenticated user to read only files in their folder: {user_id}/*
        CREATE POLICY "Users can read own resume files"
        ON storage.objects FOR SELECT
        TO authenticated
        USING (bucket_id = 'resume-imports' AND (storage.foldername(name))[1] = auth.uid()::text);

        -- Allow authenticated user to upload only to their folder: {user_id}/*
        CREATE POLICY "Users can upload own resume files"
        ON storage.objects FOR INSERT
        TO authenticated
        WITH CHECK (
            bucket_id = 'resume-imports' 
            AND (storage.foldername(name))[1] = auth.uid()::text
            AND octet_length(file) <= 10485760
        );

        -- Allow authenticated user to delete only from their folder
        CREATE POLICY "Users can delete own resume files"
        ON storage.objects FOR DELETE
        TO authenticated
        USING (bucket_id = 'resume-imports' AND (storage.foldername(name))[1] = auth.uid()::text);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;
