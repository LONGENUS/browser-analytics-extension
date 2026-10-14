-- ==============================================================================
-- Migration: 20261008000002_resume_data_foundation.sql
-- Description: Module 2 — User Profile & Resume Data Foundation
-- Creates structured relational resume entities with Row Level Security (RLS)
-- and user isolation enforced by auth.uid().
-- ==============================================================================

-- 1. Main Resumes Table
CREATE TABLE IF NOT EXISTS public.resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL DEFAULT 'Untitled Resume',
    is_default BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(50) NOT NULL DEFAULT 'draft', -- 'draft' or 'ready'
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Index for fast user queries
CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON public.resumes(user_id);

-- Enforce at most ONE default resume per user
CREATE UNIQUE INDEX IF NOT EXISTS unique_user_default_resume 
ON public.resumes (user_id) 
WHERE is_default = true;


-- 2. Resume Personal Information (1:1 with Resume)
CREATE TABLE IF NOT EXISTS public.resume_personal_information (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id UUID NOT NULL UNIQUE REFERENCES public.resumes(id) ON DELETE CASCADE,
    full_name VARCHAR(255),
    headline VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    location VARCHAR(255),
    website VARCHAR(500),
    linkedin_url VARCHAR(500),
    github_url VARCHAR(500),
    portfolio_url VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_resume_personal_info_resume_id ON public.resume_personal_information(resume_id);


-- 3. Professional Summary (1:1 with Resume)
CREATE TABLE IF NOT EXISTS public.resume_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id UUID NOT NULL UNIQUE REFERENCES public.resumes(id) ON DELETE CASCADE,
    summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_resume_summaries_resume_id ON public.resume_summaries(resume_id);


-- 4. Work Experience (1:N with Resume)
CREATE TABLE IF NOT EXISTS public.resume_experiences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id UUID NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
    company VARCHAR(255) NOT NULL,
    job_title VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    employment_type VARCHAR(100),
    start_date VARCHAR(50),
    end_date VARCHAR(50),
    is_current BOOLEAN NOT NULL DEFAULT false,
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_resume_experiences_resume_id ON public.resume_experiences(resume_id);


-- 5. Experience Bullet Points (1:N with Experience for future Module 6 tailoring)
CREATE TABLE IF NOT EXISTS public.resume_experience_bullets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experience_id UUID NOT NULL REFERENCES public.resume_experiences(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_exp_bullets_experience_id ON public.resume_experience_bullets(experience_id);


-- 6. Education (1:N with Resume)
CREATE TABLE IF NOT EXISTS public.resume_educations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id UUID NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
    institution VARCHAR(255) NOT NULL,
    degree VARCHAR(255),
    field_of_study VARCHAR(255),
    location VARCHAR(255),
    start_date VARCHAR(50),
    end_date VARCHAR(50),
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_resume_educations_resume_id ON public.resume_educations(resume_id);


-- 7. Skills (1:N with Resume)
CREATE TABLE IF NOT EXISTS public.resume_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id UUID NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
    skill_name VARCHAR(100) NOT NULL,
    category VARCHAR(100), -- 'Languages', 'Frameworks', 'Databases', 'Cloud', 'Tools', 'Soft Skills'
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_resume_skills_resume_id ON public.resume_skills(resume_id);


-- 8. Projects (1:N with Resume)
CREATE TABLE IF NOT EXISTS public.resume_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id UUID NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    url VARCHAR(500),
    technologies VARCHAR(500),
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_resume_projects_resume_id ON public.resume_projects(resume_id);


-- 9. Project Bullet Points (1:N with Project)
CREATE TABLE IF NOT EXISTS public.resume_project_bullets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.resume_projects(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_proj_bullets_project_id ON public.resume_project_bullets(project_id);


-- 10. Certifications (1:N with Resume)
CREATE TABLE IF NOT EXISTS public.resume_certifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id UUID NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    issuer VARCHAR(255),
    issue_date VARCHAR(50),
    expiration_date VARCHAR(50),
    credential_id VARCHAR(255),
    credential_url VARCHAR(500),
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_resume_certifications_resume_id ON public.resume_certifications(resume_id);


-- 11. Links (1:N with Resume)
CREATE TABLE IF NOT EXISTS public.resume_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id UUID NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
    label VARCHAR(100) NOT NULL,
    url VARCHAR(500) NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_resume_links_resume_id ON public.resume_links(resume_id);


-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Strict user isolation: auth.uid() controls ownership on all resume tables.
-- ==============================================================================

ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_personal_information ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_experience_bullets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_educations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_project_bullets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_links ENABLE ROW LEVEL SECURITY;

-- 1. Resumes Policies
CREATE POLICY resumes_select_own ON public.resumes
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY resumes_insert_own ON public.resumes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY resumes_update_own ON public.resumes
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY resumes_delete_own ON public.resumes
    FOR DELETE USING (auth.uid() = user_id);

-- 2. Personal Information Policies
CREATE POLICY personal_info_select_own ON public.resume_personal_information
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.resumes WHERE resumes.id = resume_personal_information.resume_id AND resumes.user_id = auth.uid())
    );

CREATE POLICY personal_info_insert_own ON public.resume_personal_information
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.resumes WHERE resumes.id = resume_personal_information.resume_id AND resumes.user_id = auth.uid())
    );

CREATE POLICY personal_info_update_own ON public.resume_personal_information
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.resumes WHERE resumes.id = resume_personal_information.resume_id AND resumes.user_id = auth.uid())
    );

CREATE POLICY personal_info_delete_own ON public.resume_personal_information
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.resumes WHERE resumes.id = resume_personal_information.resume_id AND resumes.user_id = auth.uid())
    );

-- 3. Summary Policies
CREATE POLICY summaries_select_own ON public.resume_summaries
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.resumes WHERE resumes.id = resume_summaries.resume_id AND resumes.user_id = auth.uid())
    );

CREATE POLICY summaries_insert_own ON public.resume_summaries
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.resumes WHERE resumes.id = resume_summaries.resume_id AND resumes.user_id = auth.uid())
    );

CREATE POLICY summaries_update_own ON public.resume_summaries
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.resumes WHERE resumes.id = resume_summaries.resume_id AND resumes.user_id = auth.uid())
    );

CREATE POLICY summaries_delete_own ON public.resume_summaries
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.resumes WHERE resumes.id = resume_summaries.resume_id AND resumes.user_id = auth.uid())
    );

-- 4. Experience Policies
CREATE POLICY experiences_select_own ON public.resume_experiences
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.resumes WHERE resumes.id = resume_experiences.resume_id AND resumes.user_id = auth.uid())
    );

CREATE POLICY experiences_insert_own ON public.resume_experiences
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.resumes WHERE resumes.id = resume_experiences.resume_id AND resumes.user_id = auth.uid())
    );

CREATE POLICY experiences_update_own ON public.resume_experiences
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.resumes WHERE resumes.id = resume_experiences.resume_id AND resumes.user_id = auth.uid())
    );

CREATE POLICY experiences_delete_own ON public.resume_experiences
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.resumes WHERE resumes.id = resume_experiences.resume_id AND resumes.user_id = auth.uid())
    );

-- 5. Experience Bullets Policies
CREATE POLICY exp_bullets_select_own ON public.resume_experience_bullets
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.resume_experiences e
            JOIN public.resumes r ON r.id = e.resume_id
            WHERE e.id = resume_experience_bullets.experience_id AND r.user_id = auth.uid()
        )
    );

CREATE POLICY exp_bullets_insert_own ON public.resume_experience_bullets
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.resume_experiences e
            JOIN public.resumes r ON r.id = e.resume_id
            WHERE e.id = resume_experience_bullets.experience_id AND r.user_id = auth.uid()
        )
    );

CREATE POLICY exp_bullets_update_own ON public.resume_experience_bullets
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.resume_experiences e
            JOIN public.resumes r ON r.id = e.resume_id
            WHERE e.id = resume_experience_bullets.experience_id AND r.user_id = auth.uid()
        )
    );

CREATE POLICY exp_bullets_delete_own ON public.resume_experience_bullets
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.resume_experiences e
            JOIN public.resumes r ON r.id = e.resume_id
            WHERE e.id = resume_experience_bullets.experience_id AND r.user_id = auth.uid()
        )
    );

-- 6. Education Policies
CREATE POLICY educations_select_own ON public.resume_educations
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.resumes WHERE resumes.id = resume_educations.resume_id AND resumes.user_id = auth.uid())
    );

CREATE POLICY educations_insert_own ON public.resume_educations
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.resumes WHERE resumes.id = resume_educations.resume_id AND resumes.user_id = auth.uid())
    );

CREATE POLICY educations_update_own ON public.resume_educations
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.resumes WHERE resumes.id = resume_educations.resume_id AND resumes.user_id = auth.uid())
    );

CREATE POLICY educations_delete_own ON public.resume_educations
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.resumes WHERE resumes.id = resume_educations.resume_id AND resumes.user_id = auth.uid())
    );

-- 7. Skills Policies
CREATE POLICY skills_select_own ON public.resume_skills
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.resumes WHERE resumes.id = resume_skills.resume_id AND resumes.user_id = auth.uid())
    );

CREATE POLICY skills_insert_own ON public.resume_skills
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.resumes WHERE resumes.id = resume_skills.resume_id AND resumes.user_id = auth.uid())
    );

CREATE POLICY skills_update_own ON public.resume_skills
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.resumes WHERE resumes.id = resume_skills.resume_id AND resumes.user_id = auth.uid())
    );

CREATE POLICY skills_delete_own ON public.resume_skills
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.resumes WHERE resumes.id = resume_skills.resume_id AND resumes.user_id = auth.uid())
    );

-- 8. Projects Policies
CREATE POLICY projects_select_own ON public.resume_projects
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.resumes WHERE resumes.id = resume_projects.resume_id AND resumes.user_id = auth.uid())
    );

CREATE POLICY projects_insert_own ON public.resume_projects
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.resumes WHERE resumes.id = resume_projects.resume_id AND resumes.user_id = auth.uid())
    );

CREATE POLICY projects_update_own ON public.resume_projects
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.resumes WHERE resumes.id = resume_projects.resume_id AND resumes.user_id = auth.uid())
    );

CREATE POLICY projects_delete_own ON public.resume_projects
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.resumes WHERE resumes.id = resume_projects.resume_id AND resumes.user_id = auth.uid())
    );

-- 9. Project Bullets Policies
CREATE POLICY proj_bullets_select_own ON public.resume_project_bullets
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.resume_projects p
            JOIN public.resumes r ON r.id = p.resume_id
            WHERE p.id = resume_project_bullets.project_id AND r.user_id = auth.uid()
        )
    );

CREATE POLICY proj_bullets_insert_own ON public.resume_project_bullets
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.resume_projects p
            JOIN public.resumes r ON r.id = p.resume_id
            WHERE p.id = resume_project_bullets.project_id AND r.user_id = auth.uid()
        )
    );

CREATE POLICY proj_bullets_update_own ON public.resume_project_bullets
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.resume_projects p
            JOIN public.resumes r ON r.id = p.resume_id
            WHERE p.id = resume_project_bullets.project_id AND r.user_id = auth.uid()
        )
    );

CREATE POLICY proj_bullets_delete_own ON public.resume_project_bullets
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.resume_projects p
            JOIN public.resumes r ON r.id = p.resume_id
            WHERE p.id = resume_project_bullets.project_id AND r.user_id = auth.uid()
        )
    );

-- 10. Certifications Policies
CREATE POLICY certifications_select_own ON public.resume_certifications
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.resumes WHERE resumes.id = resume_certifications.resume_id AND resumes.user_id = auth.uid())
    );

CREATE POLICY certifications_insert_own ON public.resume_certifications
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.resumes WHERE resumes.id = resume_certifications.resume_id AND resumes.user_id = auth.uid())
    );

CREATE POLICY certifications_update_own ON public.resume_certifications
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.resumes WHERE resumes.id = resume_certifications.resume_id AND resumes.user_id = auth.uid())
    );

CREATE POLICY certifications_delete_own ON public.resume_certifications
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.resumes WHERE resumes.id = resume_certifications.resume_id AND resumes.user_id = auth.uid())
    );

-- 11. Links Policies
CREATE POLICY links_select_own ON public.resume_links
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.resumes WHERE resumes.id = resume_links.resume_id AND resumes.user_id = auth.uid())
    );

CREATE POLICY links_insert_own ON public.resume_links
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.resumes WHERE resumes.id = resume_links.resume_id AND resumes.user_id = auth.uid())
    );

CREATE POLICY links_update_own ON public.resume_links
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.resumes WHERE resumes.id = resume_links.resume_id AND resumes.user_id = auth.uid())
    );

CREATE POLICY links_delete_own ON public.resume_links
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.resumes WHERE resumes.id = resume_links.resume_id AND resumes.user_id = auth.uid())
    );

-- Service role bypass on all tables
CREATE POLICY resumes_service_role ON public.resumes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY personal_info_service_role ON public.resume_personal_information FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY summaries_service_role ON public.resume_summaries FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY experiences_service_role ON public.resume_experiences FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY exp_bullets_service_role ON public.resume_experience_bullets FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY educations_service_role ON public.resume_educations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY skills_service_role ON public.resume_skills FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY projects_service_role ON public.resume_projects FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY proj_bullets_service_role ON public.resume_project_bullets FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY certifications_service_role ON public.resume_certifications FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY links_service_role ON public.resume_links FOR ALL TO service_role USING (true) WITH CHECK (true);
