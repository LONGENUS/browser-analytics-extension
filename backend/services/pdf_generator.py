"""
TailorResume — Module 8: Resume PDF Generation Service
Pure-Python, ATS-compliant vector PDF generator using ReportLab.

Key Architecture:
- Consumes normalized structured resume data + template config from Module 7.
- Zero external browser or Node.js dependencies (100% Vercel Serverless compatible).
- Generates selectable, searchable vector text nodes (highest ATS parseability).
- Standard International A4 dimensions with template-specific margins and typography.
- Respects page break rules (keepWithNext) to prevent orphaned section headers.
- Completely omits empty sections (zero trailing commas or empty headings).
- Sanitizes all URLs and escapes text to prevent injection or formatting errors.
"""

import io
import re
from typing import Dict, Any, List, Optional
from xml.sax.saxutils import escape

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm, inch

pt = 1  # 1 point in ReportLab

from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
    KeepTogether,
)


def sanitize_text(text: Optional[str]) -> str:
    """Escapes XML entities for ReportLab Paragraph markup."""
    if not text:
        return ""
    return escape(str(text).strip())


def sanitize_url(url: Optional[str]) -> Optional[str]:
    """Sanitizes URL schemes to allow strictly http, https, mailto, tel."""
    if not url:
        return None
    cleaned = str(url).strip()
    lower = cleaned.lower()
    if (
        lower.startswith("javascript:")
        or lower.startswith("data:")
        or lower.startswith("vbscript:")
        or lower.startswith("file:")
    ):
        return None
    if lower.startswith(("http://", "https://", "mailto:", "tel:")):
        return cleaned
    return f"https://{cleaned}"


def format_date_range(start_date: Optional[str], end_date: Optional[str], is_current: bool = False) -> str:
    """Formats start and end dates into a clean range string."""
    start = (start_date or "").strip()
    if is_current:
        end = "Present"
    else:
        end = (end_date or "").strip()

    if start and end:
        return f"{start} – {end}"
    if start:
        return start
    if end:
        return end
    return ""


class PDFResumeGenerator:
    """Generates ATS-compliant, template-styled PDFs from structured resume data."""

    def __init__(self, resume_data: Dict[str, Any], template_id: str = "ats-classic", template_version: str = "v1.0.0"):
        self.data = resume_data
        self.template_id = (template_id or "ats-classic").lower().strip()
        if self.template_id not in ("ats-classic", "professional", "compact"):
            self.template_id = "ats-classic"
        self.template_version = template_version or "v1.0.0"

        # Configure template tokens
        self._init_template_tokens()

    def _init_template_tokens(self):
        """Initializes typography, colors, and margin tokens matching Module 7."""
        if self.template_id == "professional":
            self.margin = 16 * mm
            self.color_primary = colors.HexColor("#0F172A")
            self.color_secondary = colors.HexColor("#334155")
            self.color_muted = colors.HexColor("#64748B")
            self.color_accent = colors.HexColor("#2563EB")
            self.color_divider = colors.HexColor("#2563EB")
            self.divider_thickness = 1.5
            self.name_font_size = 22
            self.name_leading = 26
            self.section_space_before = 10 * pt
            self.section_space_after = 4 * pt
            self.item_spacing = 6 * pt
            self.bullet_spacing = 2 * pt
            self.body_font_size = 9.5
            self.body_leading = 13.5
        elif self.template_id == "compact":
            self.margin = 12 * mm
            self.color_primary = colors.HexColor("#0F172A")
            self.color_secondary = colors.HexColor("#1E293B")
            self.color_muted = colors.HexColor("#475569")
            self.color_accent = colors.HexColor("#0F172A")
            self.color_divider = colors.HexColor("#94A3B8")
            self.divider_thickness = 0.75
            self.name_font_size = 18
            self.name_leading = 21
            self.section_space_before = 6 * pt
            self.section_space_after = 2.5 * pt
            self.item_spacing = 4 * pt
            self.bullet_spacing = 1.5 * pt
            self.body_font_size = 8.5
            self.body_leading = 11.5
        else:  # ats-classic (default)
            self.margin = 18 * mm
            self.color_primary = colors.HexColor("#0F172A")
            self.color_secondary = colors.HexColor("#334155")
            self.color_muted = colors.HexColor("#475569")
            self.color_accent = colors.HexColor("#0F172A")
            self.color_divider = colors.HexColor("#CBD5E1")
            self.divider_thickness = 1.0
            self.name_font_size = 20
            self.name_leading = 24
            self.section_space_before = 9 * pt
            self.section_space_after = 3.5 * pt
            self.item_spacing = 5.5 * pt
            self.bullet_spacing = 2 * pt
            self.body_font_size = 9.0
            self.body_leading = 13.0

        # Printable width
        self.printable_width = A4[0] - (2 * self.margin)

    def _build_styles(self):
        """Creates ReportLab paragraph styles tailored for the template."""
        styles = getSampleStyleSheet()

        styles.add(
            ParagraphStyle(
                name="ResumeName",
                fontName="Helvetica-Bold",
                fontSize=self.name_font_size,
                leading=self.name_leading,
                textColor=self.color_primary,
                spaceAfter=2 * pt,
                alignment=0,  # Left aligned
            )
        )

        styles.add(
            ParagraphStyle(
                name="ResumeHeadline",
                fontName="Helvetica",
                fontSize=self.body_font_size + 1.5,
                leading=self.body_leading + 1.5,
                textColor=self.color_accent,
                spaceAfter=3 * pt,
            )
        )

        styles.add(
            ParagraphStyle(
                name="ResumeContact",
                fontName="Helvetica",
                fontSize=self.body_font_size - 0.5,
                leading=self.body_leading - 0.5,
                textColor=self.color_muted,
                spaceAfter=4 * pt,
            )
        )

        styles.add(
            ParagraphStyle(
                name="ResumeSectionHeading",
                fontName="Helvetica-Bold",
                fontSize=self.body_font_size + 0.5,
                leading=self.body_leading + 0.5,
                textColor=self.color_accent,
                textTransform="uppercase",
                spaceBefore=self.section_space_before,
                spaceAfter=self.section_space_after,
                keepWithNext=True,
            )
        )

        styles.add(
            ParagraphStyle(
                name="ResumeItemTitle",
                fontName="Helvetica-Bold",
                fontSize=self.body_font_size,
                leading=self.body_leading,
                textColor=self.color_primary,
                spaceAfter=1 * pt,
                keepWithNext=True,
            )
        )

        styles.add(
            ParagraphStyle(
                name="ResumeItemDate",
                fontName="Helvetica",
                fontSize=self.body_font_size - 0.5,
                leading=self.body_leading - 0.5,
                textColor=self.color_muted,
                alignment=2,  # Right aligned
            )
        )

        styles.add(
            ParagraphStyle(
                name="ResumeBody",
                fontName="Helvetica",
                fontSize=self.body_font_size,
                leading=self.body_leading,
                textColor=self.color_secondary,
                spaceAfter=2 * pt,
            )
        )

        styles.add(
            ParagraphStyle(
                name="ResumeBullet",
                fontName="Helvetica",
                fontSize=self.body_font_size,
                leading=self.body_leading,
                textColor=self.color_secondary,
                leftIndent=12 * pt,
                firstLineIndent=-8 * pt,
                spaceAfter=self.bullet_spacing,
            )
        )

        return styles

    def generate(self) -> bytes:
        """Assembles the PDF flowables and outputs binary bytes."""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=self.margin,
            rightMargin=self.margin,
            topMargin=self.margin,
            bottomMargin=self.margin,
        )

        styles = self._build_styles()
        story = []

        # 1. Header (Personal Info)
        self._build_header(story, styles)

        # 2. Professional Summary
        self._build_summary(story, styles)

        # 3. Work Experience
        self._build_experience(story, styles)

        # 4. Skills
        self._build_skills(story, styles)

        # 5. Projects
        self._build_projects(story, styles)

        # 6. Education
        self._build_education(story, styles)

        # 7. Certifications
        self._build_certifications(story, styles)

        # 8. Links
        self._build_links(story, styles)

        # Build document into buffer
        doc.build(story)
        return buffer.getvalue()

    def _add_section_header(self, story: List[Any], title: str, styles: Any):
        """Adds standard semantic section heading with divider line."""
        story.append(Paragraph(title, styles["ResumeSectionHeading"]))
        story.append(
            HRFlowable(
                width="100%",
                thickness=self.divider_thickness,
                color=self.color_divider,
                spaceBefore=1 * pt,
                spaceAfter=4 * pt,
            )
        )

    def _build_header(self, story: List[Any], styles: Any):
        p_info = self.data.get("personal_info") or {}
        full_name = sanitize_text(p_info.get("full_name"))
        headline = sanitize_text(p_info.get("headline"))

        if full_name:
            story.append(Paragraph(full_name, styles["ResumeName"]))

        if headline:
            story.append(Paragraph(headline, styles["ResumeHeadline"]))

        contact_parts = []
        email = p_info.get("email")
        if email:
            contact_parts.append(f'<a href="mailto:{escape(email)}">{escape(email)}</a>')

        phone = p_info.get("phone")
        if phone:
            contact_parts.append(sanitize_text(phone))

        location = p_info.get("location")
        if location:
            contact_parts.append(sanitize_text(location))

        website = sanitize_url(p_info.get("website"))
        if website:
            contact_parts.append(f'<a href="{escape(website)}">Website</a>')

        linkedin = sanitize_url(p_info.get("linkedin_url"))
        if linkedin:
            contact_parts.append(f'<a href="{escape(linkedin)}">LinkedIn</a>')

        github = sanitize_url(p_info.get("github_url"))
        if github:
            contact_parts.append(f'<a href="{escape(github)}">GitHub</a>')

        portfolio = sanitize_url(p_info.get("portfolio_url"))
        if portfolio:
            contact_parts.append(f'<a href="{escape(portfolio)}">Portfolio</a>')

        if contact_parts:
            contact_line = "  •  ".join(contact_parts)
            story.append(Paragraph(contact_line, styles["ResumeContact"]))

        story.append(Spacer(1, 3 * pt))

    def _build_summary(self, story: List[Any], styles: Any):
        summary_obj = self.data.get("summary") or {}
        summary_text = (summary_obj.get("summary") or "").strip()
        if not summary_text:
            return

        self._add_section_header(story, "PROFESSIONAL SUMMARY", styles)
        story.append(Paragraph(sanitize_text(summary_text), styles["ResumeBody"]))
        story.append(Spacer(1, 4 * pt))

    def _build_experience(self, story: List[Any], styles: Any):
        experiences = self.data.get("experiences") or []
        valid_exp = [e for e in experiences if e.get("company") or e.get("job_title")]
        if not valid_exp:
            return

        self._add_section_header(story, "WORK EXPERIENCE", styles)

        for exp in valid_exp:
            item_flowables = []
            title_text = sanitize_text(exp.get("job_title"))
            company_text = sanitize_text(exp.get("company"))

            title_combined = title_text
            if company_text:
                title_combined += f" — <i>{company_text}</i>"

            date_str = format_date_range(
                exp.get("start_date"),
                exp.get("end_date"),
                exp.get("is_current", False)
            )

            # Two-column header row (Left: Title & Company, Right: Date)
            left_p = Paragraph(title_combined, styles["ResumeItemTitle"])
            right_p = Paragraph(sanitize_text(date_str), styles["ResumeItemDate"]) if date_str else Paragraph("", styles["ResumeItemDate"])

            col_w1 = self.printable_width * 0.72
            col_w2 = self.printable_width * 0.28
            header_table = Table([[left_p, right_p]], colWidths=[col_w1, col_w2])
            header_table.setStyle(
                TableStyle([
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 1 * pt),
                ])
            )
            item_flowables.append(header_table)

            # Location / employment type subtitle
            meta_items = [exp.get("location"), exp.get("employment_type")]
            meta_clean = [sanitize_text(m) for m in meta_items if m]
            if meta_clean:
                meta_str = " • ".join(meta_clean)
                item_flowables.append(Paragraph(f'<font color="#64748B">{meta_str}</font>', styles["ResumeBody"]))

            # Optional description
            if exp.get("description"):
                item_flowables.append(Paragraph(sanitize_text(exp["description"]), styles["ResumeBody"]))

            # Bullets
            bullets = exp.get("bullets") or []
            for b in bullets:
                content = b.get("content") if isinstance(b, dict) else str(b)
                if content and content.strip():
                    bullet_text = f"&bull;&nbsp;&nbsp;{sanitize_text(content)}"
                    item_flowables.append(Paragraph(bullet_text, styles["ResumeBullet"]))

            item_flowables.append(Spacer(1, self.item_spacing))
            story.append(KeepTogether(item_flowables))

    def _build_skills(self, story: List[Any], styles: Any):
        skills = self.data.get("skills") or []
        valid_skills = [s for s in skills if s.get("skill_name") and s.get("skill_name").strip()]
        if not valid_skills:
            return

        self._add_section_header(story, "SKILLS", styles)

        # Categorized skills
        has_categories = any(s.get("category") and s.get("category").strip() for s in valid_skills)
        if has_categories:
            categorized = {}
            for s in valid_skills:
                cat = (s.get("category") or "General").strip()
                categorized.setdefault(cat, []).append(s["skill_name"].strip())

            for cat, s_list in categorized.items():
                cat_escaped = sanitize_text(cat)
                skills_escaped = ", ".join(sanitize_text(x) for x in s_list)
                story.append(Paragraph(f"<b>{cat_escaped}:</b> {skills_escaped}", styles["ResumeBody"]))
        else:
            skills_flat = ", ".join(sanitize_text(s["skill_name"]) for s in valid_skills)
            story.append(Paragraph(skills_flat, styles["ResumeBody"]))

        story.append(Spacer(1, 4 * pt))

    def _build_projects(self, story: List[Any], styles: Any):
        projects = self.data.get("projects") or []
        valid_projects = [p for p in projects if p.get("name") and p.get("name").strip()]
        if not valid_projects:
            return

        self._add_section_header(story, "PROJECTS", styles)

        for proj in valid_projects:
            item_flowables = []
            name_text = f"<b>{sanitize_text(proj.get('name'))}</b>"
            safe_url = sanitize_url(proj.get("url"))
            if safe_url:
                name_text += f'  <a href="{escape(safe_url)}">[Link]</a>'

            tech_text = sanitize_text(proj.get("technologies"))
            left_p = Paragraph(name_text, styles["ResumeItemTitle"])
            right_p = Paragraph(f'<font color="#64748B">{tech_text}</font>', styles["ResumeItemDate"]) if tech_text else Paragraph("", styles["ResumeItemDate"])

            col_w1 = self.printable_width * 0.70
            col_w2 = self.printable_width * 0.30
            table = Table([[left_p, right_p]], colWidths=[col_w1, col_w2])
            table.setStyle(
                TableStyle([
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 1 * pt),
                ])
            )
            item_flowables.append(table)

            if proj.get("description"):
                item_flowables.append(Paragraph(sanitize_text(proj["description"]), styles["ResumeBody"]))

            bullets = proj.get("bullets") or []
            for b in bullets:
                content = b.get("content") if isinstance(b, dict) else str(b)
                if content and content.strip():
                    bullet_text = f"&bull;&nbsp;&nbsp;{sanitize_text(content)}"
                    item_flowables.append(Paragraph(bullet_text, styles["ResumeBullet"]))

            item_flowables.append(Spacer(1, self.item_spacing))
            story.append(KeepTogether(item_flowables))

    def _build_education(self, story: List[Any], styles: Any):
        educations = self.data.get("educations") or []
        valid_edu = [e for e in educations if e.get("institution") and e.get("institution").strip()]
        if not valid_edu:
            return

        self._add_section_header(story, "EDUCATION", styles)

        for edu in valid_edu:
            item_flowables = []
            inst_text = f"<b>{sanitize_text(edu.get('institution'))}</b>"
            if edu.get("location"):
                inst_text += f" — <i>{sanitize_text(edu.get('location'))}</i>"

            date_str = format_date_range(edu.get("start_date"), edu.get("end_date"), False)
            left_p = Paragraph(inst_text, styles["ResumeItemTitle"])
            right_p = Paragraph(sanitize_text(date_str), styles["ResumeItemDate"]) if date_str else Paragraph("", styles["ResumeItemDate"])

            col_w1 = self.printable_width * 0.75
            col_w2 = self.printable_width * 0.25
            table = Table([[left_p, right_p]], colWidths=[col_w1, col_w2])
            table.setStyle(
                TableStyle([
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 1 * pt),
                ])
            )
            item_flowables.append(table)

            # Degree + Field of Study
            deg_parts = [edu.get("degree"), edu.get("field_of_study")]
            deg_clean = [sanitize_text(d) for d in deg_parts if d and d.strip()]
            if deg_clean:
                degree_line = " in ".join(deg_clean)
                item_flowables.append(Paragraph(f'<font color="#334155">{degree_line}</font>', styles["ResumeBody"]))

            if edu.get("description"):
                item_flowables.append(Paragraph(sanitize_text(edu["description"]), styles["ResumeBody"]))

            item_flowables.append(Spacer(1, self.item_spacing))
            story.append(KeepTogether(item_flowables))

    def _build_certifications(self, story: List[Any], styles: Any):
        certs = self.data.get("certifications") or []
        valid_certs = [c for c in certs if c.get("name") and c.get("name").strip()]
        if not valid_certs:
            return

        self._add_section_header(story, "CERTIFICATIONS", styles)

        for cert in valid_certs:
            item_flowables = []
            name_text = f"<b>{sanitize_text(cert.get('name'))}</b>"
            if cert.get("issuer"):
                name_text += f" • <i>{sanitize_text(cert.get('issuer'))}</i>"

            safe_url = sanitize_url(cert.get("credential_url"))
            if safe_url:
                name_text += f'  <a href="{escape(safe_url)}">[Verify]</a>'

            date_str = format_date_range(cert.get("issue_date"), cert.get("expiration_date"), False)
            left_p = Paragraph(name_text, styles["ResumeItemTitle"])
            right_p = Paragraph(sanitize_text(date_str), styles["ResumeItemDate"]) if date_str else Paragraph("", styles["ResumeItemDate"])

            col_w1 = self.printable_width * 0.75
            col_w2 = self.printable_width * 0.25
            table = Table([[left_p, right_p]], colWidths=[col_w1, col_w2])
            table.setStyle(
                TableStyle([
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 1 * pt),
                ])
            )
            item_flowables.append(table)

            if cert.get("credential_id"):
                item_flowables.append(
                    Paragraph(f'<font color="#64748B">Credential ID: {sanitize_text(cert["credential_id"])}</font>', styles["ResumeBody"])
                )

            item_flowables.append(Spacer(1, self.item_spacing))
            story.append(KeepTogether(item_flowables))

    def _build_links(self, story: List[Any], styles: Any):
        links = self.data.get("links") or []
        valid_links = [l for l in links if l.get("label") and sanitize_url(l.get("url"))]
        if not valid_links:
            return

        self._add_section_header(story, "LINKS & PORTFOLIOS", styles)
        link_items = []
        for l in valid_links:
            safe_href = sanitize_url(l.get("url"))
            label = sanitize_text(l.get("label"))
            link_items.append(f'<a href="{escape(safe_href)}">{label}</a>')

        story.append(Paragraph("  •  ".join(link_items), styles["ResumeBody"]))
        story.append(Spacer(1, 4 * pt))


def generate_resume_pdf(resume_data: Dict[str, Any], template_id: str = "ats-classic", template_version: str = "v1.0.0") -> bytes:
    """Convenience helper to generate PDF bytes from structured resume data."""
    generator = PDFResumeGenerator(resume_data, template_id, template_version)
    return generator.generate()
