"""
TailorResume — Database Models
SQLAlchemy 2.0 async models for PostgreSQL.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, List

from sqlalchemy import (
    Column, String, Float, Integer, Text, DateTime, ForeignKey, JSON, Boolean,
)
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase, relationship, Mapped, mapped_column

from config import settings


# --- Engine & Session ---
# Detect if using SQLite (no pool_size/max_overflow needed)
_db_url = settings.async_database_url
_is_sqlite = _db_url.startswith("sqlite")

_engine_kwargs = {
    "echo": settings.DEBUG,
}
if not _is_sqlite:
    _engine_kwargs.update({
        "pool_size": 20,
        "max_overflow": 10,
        "pool_pre_ping": True,
    })

engine = create_async_engine(
    _db_url,
    **_engine_kwargs,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# --- Base ---
class Base(DeclarativeBase):
    pass


# --- Models ---

class UserProfile(Base):
    """User profile model mirroring public.profiles and auth.users."""
    __tablename__ = "profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    full_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    plan: Mapped[str] = mapped_column(String(50), default="free", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    last_login: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "full_name": self.full_name,
            "avatar_url": self.avatar_url,
            "plan": self.plan,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "last_login": self.last_login.isoformat() if self.last_login else None,
        }



# --- Resume Domain Models (Module 2) ---

class Resume(Base):
    """Core resume entity owned by an authenticated user."""
    __tablename__ = "resumes"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), default="Untitled Resume", nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="draft", nullable=False)
    source_resume_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("resumes.id", ondelete="SET NULL"), nullable=True, index=True
    )
    target_job_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("jobs.id", ondelete="SET NULL"), nullable=True, index=True
    )
    is_tailored: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    template_id: Mapped[str] = mapped_column(String(50), default="ats-classic", nullable=False)
    template_version: Mapped[str] = mapped_column(String(20), default="v1.0.0", nullable=False)
    
    # Master Resume File Preservation (Immutable source file metadata)
    file_sha256: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    original_filename: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    original_file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    file_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    file_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    original_file_data: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relational Children
    personal_info: Mapped[Optional["ResumePersonalInfo"]] = relationship(
        "ResumePersonalInfo", back_populates="resume", uselist=False, cascade="all, delete-orphan", lazy="selectin"
    )
    summary: Mapped[Optional["ResumeSummary"]] = relationship(
        "ResumeSummary", back_populates="resume", uselist=False, cascade="all, delete-orphan", lazy="selectin"
    )
    experiences: Mapped[List["ResumeExperience"]] = relationship(
        "ResumeExperience", back_populates="resume", cascade="all, delete-orphan", order_by="ResumeExperience.display_order", lazy="selectin"
    )
    educations: Mapped[List["ResumeEducation"]] = relationship(
        "ResumeEducation", back_populates="resume", cascade="all, delete-orphan", order_by="ResumeEducation.display_order", lazy="selectin"
    )
    skills: Mapped[List["ResumeSkill"]] = relationship(
        "ResumeSkill", back_populates="resume", cascade="all, delete-orphan", order_by="ResumeSkill.display_order", lazy="selectin"
    )
    projects: Mapped[List["ResumeProject"]] = relationship(
        "ResumeProject", back_populates="resume", cascade="all, delete-orphan", order_by="ResumeProject.display_order", lazy="selectin"
    )
    certifications: Mapped[List["ResumeCertification"]] = relationship(
        "ResumeCertification", back_populates="resume", cascade="all, delete-orphan", order_by="ResumeCertification.display_order", lazy="selectin"
    )
    links: Mapped[List["ResumeLink"]] = relationship(
        "ResumeLink", back_populates="resume", cascade="all, delete-orphan", order_by="ResumeLink.display_order", lazy="selectin"
    )

    def to_summary_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "is_default": self.is_default,
            "status": self.status,
            "source_resume_id": self.source_resume_id,
            "target_job_id": self.target_job_id,
            "is_tailored": self.is_tailored,
            "template_id": self.template_id or "ats-classic",
            "template_version": self.template_version or "v1.0.0",
            "file_sha256": self.file_sha256,
            "original_filename": self.original_filename,
            "original_file_path": self.original_file_path,
            "file_type": self.file_type,
            "file_size": self.file_size,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def to_full_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "is_default": self.is_default,
            "status": self.status,
            "source_resume_id": self.source_resume_id,
            "target_job_id": self.target_job_id,
            "is_tailored": self.is_tailored,
            "template_id": self.template_id or "ats-classic",
            "template_version": self.template_version or "v1.0.0",
            "file_sha256": self.file_sha256,
            "original_filename": self.original_filename,
            "original_file_path": self.original_file_path,
            "file_type": self.file_type,
            "file_size": self.file_size,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "personal_info": self.personal_info.to_dict() if self.personal_info else None,
            "summary": self.summary.to_dict() if self.summary else None,
            "experiences": [exp.to_dict() for exp in self.experiences] if self.experiences else [],
            "educations": [edu.to_dict() for edu in self.educations] if self.educations else [],
            "skills": [skill.to_dict() for skill in self.skills] if self.skills else [],
            "projects": [proj.to_dict() for proj in self.projects] if self.projects else [],
            "certifications": [cert.to_dict() for cert in self.certifications] if self.certifications else [],
            "links": [link.to_dict() for link in self.links] if self.links else [],
        }


class ResumePersonalInfo(Base):
    __tablename__ = "resume_personal_information"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    resume_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("resumes.id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )
    full_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    headline: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    linkedin_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    github_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    portfolio_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    resume: Mapped["Resume"] = relationship("Resume", back_populates="personal_info")

    def to_dict(self):
        return {
            "id": self.id,
            "resume_id": self.resume_id,
            "full_name": self.full_name,
            "headline": self.headline,
            "email": self.email,
            "phone": self.phone,
            "location": self.location,
            "website": self.website,
            "linkedin_url": self.linkedin_url,
            "github_url": self.github_url,
            "portfolio_url": self.portfolio_url,
        }


class ResumeSummary(Base):
    __tablename__ = "resume_summaries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    resume_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("resumes.id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    resume: Mapped["Resume"] = relationship("Resume", back_populates="summary")

    def to_dict(self):
        return {
            "id": self.id,
            "resume_id": self.resume_id,
            "summary": self.summary,
        }


class ResumeExperience(Base):
    __tablename__ = "resume_experiences"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    resume_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    company: Mapped[str] = mapped_column(String(255), nullable=False)
    job_title: Mapped[str] = mapped_column(String(255), nullable=False)
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    employment_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    start_date: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    end_date: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    is_current: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    resume: Mapped["Resume"] = relationship("Resume", back_populates="experiences")
    bullets: Mapped[List["ResumeExperienceBullet"]] = relationship(
        "ResumeExperienceBullet", back_populates="experience", cascade="all, delete-orphan", order_by="ResumeExperienceBullet.display_order", lazy="selectin"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "resume_id": self.resume_id,
            "company": self.company,
            "job_title": self.job_title,
            "location": self.location,
            "employment_type": self.employment_type,
            "start_date": self.start_date,
            "end_date": self.end_date,
            "is_current": self.is_current,
            "description": self.description,
            "display_order": self.display_order,
            "bullets": [b.to_dict() for b in self.bullets] if self.bullets else [],
        }


class ResumeExperienceBullet(Base):
    __tablename__ = "resume_experience_bullets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    experience_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("resume_experiences.id", ondelete="CASCADE"), nullable=False, index=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    experience: Mapped["ResumeExperience"] = relationship("ResumeExperience", back_populates="bullets")

    def to_dict(self):
        return {
            "id": self.id,
            "experience_id": self.experience_id,
            "content": self.content,
            "display_order": self.display_order,
        }


class ResumeEducation(Base):
    __tablename__ = "resume_educations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    resume_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    institution: Mapped[str] = mapped_column(String(255), nullable=False)
    degree: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    field_of_study: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    start_date: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    end_date: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    resume: Mapped["Resume"] = relationship("Resume", back_populates="educations")

    def to_dict(self):
        return {
            "id": self.id,
            "resume_id": self.resume_id,
            "institution": self.institution,
            "degree": self.degree,
            "field_of_study": self.field_of_study,
            "location": self.location,
            "start_date": self.start_date,
            "end_date": self.end_date,
            "description": self.description,
            "display_order": self.display_order,
        }


class ResumeSkill(Base):
    __tablename__ = "resume_skills"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    resume_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    skill_name: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    resume: Mapped["Resume"] = relationship("Resume", back_populates="skills")

    def to_dict(self):
        return {
            "id": self.id,
            "resume_id": self.resume_id,
            "skill_name": self.skill_name,
            "category": self.category,
            "display_order": self.display_order,
        }


class ResumeProject(Base):
    __tablename__ = "resume_projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    resume_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    technologies: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    resume: Mapped["Resume"] = relationship("Resume", back_populates="projects")
    bullets: Mapped[List["ResumeProjectBullet"]] = relationship(
        "ResumeProjectBullet", back_populates="project", cascade="all, delete-orphan", order_by="ResumeProjectBullet.display_order", lazy="selectin"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "resume_id": self.resume_id,
            "name": self.name,
            "description": self.description,
            "url": self.url,
            "technologies": self.technologies,
            "display_order": self.display_order,
            "bullets": [b.to_dict() for b in self.bullets] if self.bullets else [],
        }


class ResumeProjectBullet(Base):
    __tablename__ = "resume_project_bullets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("resume_projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    project: Mapped["ResumeProject"] = relationship("ResumeProject", back_populates="bullets")

    def to_dict(self):
        return {
            "id": self.id,
            "project_id": self.project_id,
            "content": self.content,
            "display_order": self.display_order,
        }


class ResumeCertification(Base):
    __tablename__ = "resume_certifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    resume_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    issuer: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    issue_date: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    expiration_date: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    credential_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    credential_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    resume: Mapped["Resume"] = relationship("Resume", back_populates="certifications")

    def to_dict(self):
        return {
            "id": self.id,
            "resume_id": self.resume_id,
            "name": self.name,
            "issuer": self.issuer,
            "issue_date": self.issue_date,
            "expiration_date": self.expiration_date,
            "credential_id": self.credential_id,
            "credential_url": self.credential_url,
            "display_order": self.display_order,
        }


class ResumeLink(Base):
    __tablename__ = "resume_links"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    resume_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    resume: Mapped["Resume"] = relationship("Resume", back_populates="links")

    def to_dict(self):
        return {
            "id": self.id,
            "resume_id": self.resume_id,
            "label": self.label,
            "url": self.url,
            "display_order": self.display_order,
        }


class ResumeImport(Base):
    """Tracks an uploaded resume file import session."""
    __tablename__ = "resume_imports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    storage_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    file_sha256: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    original_file_data: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="uploaded", nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "original_filename": self.original_filename,
            "file_type": self.file_type,
            "file_size": self.file_size,
            "storage_path": self.storage_path,
            "file_sha256": self.file_sha256,
            "status": self.status,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class Job(Base):
    """Tracks a user-saved job opportunity (Module 4)."""
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source: Mapped[str] = mapped_column(String(50), default="other", nullable=False)
    source_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True, index=True)
    job_title: Mapped[str] = mapped_column(String(255), nullable=False)
    company_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    company_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    employment_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    work_mode: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    department: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    job_description: Mapped[str] = mapped_column(Text, nullable=False)
    requirements: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    responsibilities: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    qualifications: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    salary_text: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    job_posted_at: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    extracted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "source": self.source,
            "source_url": self.source_url,
            "job_title": self.job_title,
            "company_name": self.company_name,
            "company_url": self.company_url,
            "location": self.location,
            "employment_type": self.employment_type,
            "work_mode": self.work_mode,
            "department": self.department,
            "job_description": self.job_description,
            "requirements": self.requirements,
            "responsibilities": self.responsibilities,
            "qualifications": self.qualifications,
            "salary_text": self.salary_text,
            "job_posted_at": self.job_posted_at,
            "extracted_at": self.extracted_at.isoformat() if self.extracted_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class JobMatch(Base):
    """Tracks a deterministic Job-Resume Match analysis record (Module 5)."""
    __tablename__ = "job_matches"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    job_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    resume_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    overall_score: Mapped[int] = mapped_column(Integer, nullable=False)
    category_scores: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    matched_skills: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    missing_skills: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    responsibilities_analysis: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    experience_assessment: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    qualification_assessment: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    keyword_coverage: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    evidence: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    algorithm_version: Mapped[str] = mapped_column(String(20), default="v1", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "job_id": self.job_id,
            "resume_id": self.resume_id,
            "overall_score": self.overall_score,
            "category_scores": self.category_scores,
            "matched_skills": self.matched_skills,
            "missing_skills": self.missing_skills,
            "responsibilities_analysis": self.responsibilities_analysis,
            "experience_assessment": self.experience_assessment,
            "qualification_assessment": self.qualification_assessment,
            "keyword_coverage": self.keyword_coverage,
            "evidence": self.evidence,
            "algorithm_version": self.algorithm_version,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class TailoredResume(Base):
    """Tracks tailoring metadata, plans, and change logs (Module 6)."""
    __tablename__ = "tailored_resumes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source_resume_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("resumes.id", ondelete="SET NULL"), nullable=True, index=True
    )
    target_job_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("jobs.id", ondelete="SET NULL"), nullable=True, index=True
    )
    tailored_resume_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tailoring_mode: Mapped[str] = mapped_column(String(50), default="balanced", nullable=False)
    tailoring_plan: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    change_log: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    original_match_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    tailored_match_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    algorithm_version: Mapped[str] = mapped_column(String(20), default="v1", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "source_resume_id": self.source_resume_id,
            "target_job_id": self.target_job_id,
            "job_id": self.target_job_id,
            "tailored_resume_id": self.tailored_resume_id,
            "resume_id": self.tailored_resume_id,
            "tailoring_mode": self.tailoring_mode,
            "tailoring_plan": self.tailoring_plan,
            "change_log": self.change_log,
            "original_match_score": self.original_match_score,
            "tailored_match_score": self.tailored_match_score,
            "algorithm_version": self.algorithm_version,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }



class ResumeChangeRecord(Base):
    """Tracks structured change records associated with tailored resume generation (Module: Change Tracking)."""
    __tablename__ = "resume_change_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source_resume_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tailored_resume_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    section: Mapped[str] = mapped_column(String(100), nullable=False)
    paragraph_id: Mapped[str] = mapped_column(String(100), nullable=False)
    section_title: Mapped[str] = mapped_column(String(255), nullable=False)
    item_title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    change_type: Mapped[str] = mapped_column(String(50), nullable=False)  # 'added', 'modified', 'removed', 'unchanged'
    original_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    proposed_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    diff_segments: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="accepted", nullable=False)  # 'pending', 'accepted', 'rejected'
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "source_resume_id": self.source_resume_id,
            "tailored_resume_id": self.tailored_resume_id,
            "section": self.section,
            "paragraph_id": self.paragraph_id,
            "section_title": self.section_title,
            "item_title": self.item_title,
            "change_type": self.change_type,
            "original_text": self.original_text,
            "proposed_text": self.proposed_text,
            "diff_segments": self.diff_segments,
            "explanation": self.explanation,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


# --- Database Init ---
async def init_db():
    """Create all tables if they don't exist and ensure columns exist."""
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            if _is_sqlite:
                for col, col_type in [
                    ("source_resume_id", "VARCHAR(36)"),
                    ("target_job_id", "VARCHAR(36)"),
                    ("is_tailored", "BOOLEAN DEFAULT 0"),
                    ("template_id", "VARCHAR(50) DEFAULT 'ats-classic'"),
                    ("template_version", "VARCHAR(20) DEFAULT 'v1.0.0'"),
                    ("file_sha256", "VARCHAR(64)"),
                    ("original_filename", "VARCHAR(255)"),
                    ("original_file_path", "VARCHAR(500)"),
                    ("file_type", "VARCHAR(50)"),
                    ("file_size", "INTEGER"),
                    ("original_file_data", "TEXT"),
                ]:
                    try:
                        await conn.exec_driver_sql(f"ALTER TABLE resumes ADD COLUMN {col} {col_type};")
                    except Exception:
                        pass

                # Also add file_sha256 and original_file_data to resume_imports if missing
                try:
                    await conn.exec_driver_sql("ALTER TABLE resume_imports ADD COLUMN file_sha256 VARCHAR(64);")
                except Exception:
                    pass
                try:
                    await conn.exec_driver_sql("ALTER TABLE resume_imports ADD COLUMN original_file_data TEXT;")
                except Exception:
                    pass

                # Check if tailored_resumes has NOT NULL constraint on source_resume_id or target_job_id
                try:
                    table_info = await conn.exec_driver_sql("PRAGMA table_info(tailored_resumes);")
                    cols = table_info.fetchall()
                    needs_migration = any(
                        (c[1] in ("source_resume_id", "target_job_id") and c[3] == 1)
                        for c in cols
                    )
                    if needs_migration:
                        await conn.exec_driver_sql("ALTER TABLE tailored_resumes RENAME TO _tailored_resumes_old;")
                        await conn.run_sync(Base.metadata.create_all)
                        await conn.exec_driver_sql("""
                            INSERT INTO tailored_resumes (id, user_id, source_resume_id, target_job_id, tailored_resume_id, tailoring_mode, tailoring_plan, change_log, original_match_score, tailored_match_score, algorithm_version, created_at, updated_at)
                            SELECT id, user_id, source_resume_id, target_job_id, tailored_resume_id, tailoring_mode, tailoring_plan, change_log, original_match_score, tailored_match_score, algorithm_version, created_at, updated_at FROM _tailored_resumes_old;
                        """)
                        await conn.exec_driver_sql("DROP TABLE _tailored_resumes_old;")
                except Exception:
                    pass
        print("[OK] Database tables initialized")
    except Exception as e:
        print(f"[WARN] Database initialization deferred: {e}")


_db_initialized = False


async def ensure_db_initialized():
    """Lazily ensures database tables exist on cold-start (critical for serverless)."""
    global _db_initialized
    if not _db_initialized:
        try:
            await init_db()
            _db_initialized = True
        except Exception as e:
            print(f"[WARN] Lazy database initialization failed: {e}")


# --- Dependency ---
async def get_db():
    """FastAPI dependency that yields a database session."""
    if not _db_initialized:
        await ensure_db_initialized()
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
