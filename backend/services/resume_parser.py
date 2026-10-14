"""
TailorResume — AI Resume Tailoring Assistant — Resume Parser Service (Module 3)
Deterministic, rule-based text extraction and structure parsing for PDF and DOCX files.
Guarantees:
- Zero AI / LLM dependency.
- Preserves verbatim user content without hallucination or rewriting.
- Detects empty/scanned PDFs gracefully (OCR unsupported in V1).
- Outputs normalized structured dictionary matching Module 2's FullStructuredResume.
"""

import io
import re
from typing import Dict, Any, List, Optional, Tuple

import pypdf
import docx


# --- Regex Patterns ---

EMAIL_REGEX = re.compile(r'\b[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+\b')
PHONE_REGEX = re.compile(r'(?:(?:\+|00)\d{1,3}[\s.-]?)?(?:\(?\d{2,5}\)?[\s.-]?)?\d{3,5}[\s.-]?\d{3,5}\b')
LINKEDIN_REGEX = re.compile(r'https?://(?:www\.)?linkedin\.com/in/[a-zA-Z0-9_-]+/?', re.IGNORECASE)
GITHUB_REGEX = re.compile(r'https?://(?:www\.)?github\.com/[a-zA-Z0-9_-]+/?', re.IGNORECASE)
GENERAL_URL_REGEX = re.compile(r'https?://[^\s/$.?#].[^\s]*', re.IGNORECASE)

# Standard Section Headings
SECTION_PATTERNS = {
    'summary': re.compile(r'^(?:professional\s+summary|executive\s+summary|summary|profile|about\s+me|career\s+objective|objective)\s*$', re.IGNORECASE),
    'experience': re.compile(r'^(?:work\s+experience|professional\s+experience|employment\s+history|experience|work\s+history|employment)\s*$', re.IGNORECASE),
    'education': re.compile(r'^(?:education|academic\s+background|academics|qualifications|educational\s+qualifications)\s*$', re.IGNORECASE),
    'skills': re.compile(r'^(?:technical\s+skills|core\s+competencies|skills\s+&\s+technologies|skills\s+and\s+technologies|skills|technologies|tools\s+&\s+technologies|core\s+skills)\s*$', re.IGNORECASE),
    'projects': re.compile(r'^(?:key\s+projects|personal\s+projects|technical\s+projects|academic\s+projects|projects)\s*$', re.IGNORECASE),
    'certifications': re.compile(r'^(?:certifications|certificates|licenses|accreditations|certifications\s+&\s+licenses)\s*$', re.IGNORECASE),
    'links': re.compile(r'^(?:links|social\s+links|online\s+presence|websites)\s*$', re.IGNORECASE),
}

UNSUPPORTED_SECTION_PATTERNS = {
    'awards': re.compile(r'^(?:honors\s+&\s+awards|awards|achievements|honors)\s*$', re.IGNORECASE),
    'publications': re.compile(r'^(?:publications|research|papers)\s*$', re.IGNORECASE),
    'volunteer': re.compile(r'^(?:volunteer\s+experience|volunteering|community\s+service)\s*$', re.IGNORECASE),
    'languages': re.compile(r'^(?:languages|language\s+proficiency)\s*$', re.IGNORECASE),
    'interests': re.compile(r'^(?:interests|hobbies|activities)\s*$', re.IGNORECASE),
}

# Date detection regex for experiences / education
DATE_RANGE_REGEX = re.compile(
    r'(?:((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*|\d{1,2}[\/\-])?\s*(\d{4}))\s*(?:[-–—to]+|\s+to\s+)\s*(Present|Current|(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*|\d{1,2}[\/\-])?\s*(\d{4}))',
    re.IGNORECASE
)
SINGLE_YEAR_REGEX = re.compile(r'\b(19\d{2}|20\d{2})\b')

BULLET_PREFIX_REGEX = re.compile(r'^\s*[\u2022\u25cf\u25cb\u25aa\u25fe\-\*\–\—\>]\s*')


# --- Text Extraction Functions ---

def extract_text_from_pdf(content: bytes) -> str:
    """Extract raw text from PDF bytes using pypdf."""
    try:
        reader = pypdf.PdfReader(io.BytesIO(content))
    except Exception as e:
        raise ValueError("We couldn't read this PDF. The file may be corrupt or encrypted.")

    if len(reader.pages) == 0:
        raise ValueError("We couldn't find readable text in this file. The PDF has 0 pages.")

    text_pages = []
    for page in reader.pages:
        try:
            page_text = page.extract_text() or ""
            text_pages.append(page_text)
        except Exception:
            continue

    full_text = "\n".join(text_pages).strip()

    # Detect Scanned / Image-only PDF
    alphanumeric_count = sum(c.isalnum() for c in full_text)
    if alphanumeric_count < 30:
        raise ValueError(
            "We couldn't find enough readable text in this file. "
            "Note: Image-only/scanned PDFs and OCR are not supported in V1. "
            "Please upload a PDF with selectable text or a DOCX file."
        )

    return full_text


def extract_text_from_docx(content: bytes) -> str:
    """Extract raw text from Word .docx bytes using python-docx."""
    try:
        doc = docx.Document(io.BytesIO(content))
    except Exception as e:
        raise ValueError("We couldn't read this Word document. The file may be corrupt or encrypted.")

    lines = []
    for para in doc.paragraphs:
        t = para.text.strip()
        if t:
            lines.append(t)

    # Also extract any table content
    for table in doc.tables:
        for row in table.rows:
            row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
            if row_text:
                lines.append(row_text)

    full_text = "\n".join(lines).strip()
    alphanumeric_count = sum(c.isalnum() for c in full_text)
    if alphanumeric_count < 30:
        raise ValueError(
            "We couldn't find enough readable text in this document. Please check the file contents."
        )

    return full_text


# --- Section Detection & Segmentation ---

def detect_sections(text: str) -> Dict[str, str]:
    """
    Splits resume text into semantic section blocks based on recognized headings.
    Returns mapping of section_name -> section_body_text.
    """
    lines = [line.strip() for line in text.splitlines()]
    sections: Dict[str, List[str]] = {'contact': []}
    current_section = 'contact'

    for line in lines:
        if not line:
            continue

        # If line contains colon and text after it, it is content (e.g. "Languages: Python, Go"), NOT a header
        is_heading_candidate = True
        if ":" in line and line.split(":", 1)[1].strip():
            is_heading_candidate = False

        # Check if line matches a known heading (usually short and starts a section)
        matched_section = None
        if is_heading_candidate and len(line.split()) <= 6:
            clean_heading = re.sub(r'[^a-zA-Z\s]', '', line.split(':')[0]).strip()
            for sec_key, pattern in SECTION_PATTERNS.items():
                if pattern.match(clean_heading):
                    matched_section = sec_key
                    break
            if not matched_section:
                for sec_key, pattern in UNSUPPORTED_SECTION_PATTERNS.items():
                    if pattern.match(clean_heading):
                        matched_section = sec_key
                        break

        if matched_section:
            current_section = matched_section
            if current_section not in sections:
                sections[current_section] = []
        else:
            sections[current_section].append(line)

    return {k: "\n".join(v).strip() for k, v in sections.items()}


# --- Section Parsers ---

def parse_contact_info(contact_text: str, full_text: str) -> Dict[str, Optional[str]]:
    """Extracts contact fields (name, email, phone, location, links)."""
    # 1. Email
    email_match = EMAIL_REGEX.search(full_text)
    email = email_match.group(0) if email_match else None

    # 2. Phone
    phone = None
    for line in contact_text.splitlines()[:6]:
        p_match = PHONE_REGEX.search(line)
        if p_match:
            candidate = p_match.group(0).strip()
            # Clean up length
            digits = re.sub(r'\D', '', candidate)
            if 7 <= len(digits) <= 15:
                phone = candidate
                break

    # 3. URLs
    linkedin = None
    li_match = LINKEDIN_REGEX.search(full_text)
    if li_match:
        linkedin = li_match.group(0).rstrip('/')

    github = None
    gh_match = GITHUB_REGEX.search(full_text)
    if gh_match:
        github = gh_match.group(0).rstrip('/')

    website = None
    for url_match in GENERAL_URL_REGEX.finditer(full_text):
        url = url_match.group(0).rstrip('/')
        if not LINKEDIN_REGEX.match(url) and not GITHUB_REGEX.match(url):
            website = url
            break

    # 4. Full Name (from the top line of contact or document)
    full_name = None
    headline = None
    contact_lines = [l.strip() for l in contact_text.splitlines() if l.strip()]

    if contact_lines:
        first_line = contact_lines[0]
        # Ignore if first line looks like an email or phone or URL
        if not EMAIL_REGEX.search(first_line) and not PHONE_REGEX.search(first_line) and len(first_line.split()) <= 5:
            full_name = re.sub(r'[^a-zA-Z\s\.\'-]', '', first_line).strip()

        if len(contact_lines) > 1 and not full_name:
            cand = contact_lines[1]
            if not EMAIL_REGEX.search(cand) and not PHONE_REGEX.search(cand):
                full_name = re.sub(r'[^a-zA-Z\s\.\'-]', '', cand).strip()

        # Headline heuristic
        if full_name and len(contact_lines) > 1:
            for l in contact_lines[1:4]:
                if l != full_name and not EMAIL_REGEX.search(l) and not PHONE_REGEX.search(l) and not GENERAL_URL_REGEX.search(l):
                    if len(l.split()) <= 8:
                        headline = l
                        break

    # 5. Location heuristic
    location = None
    location_regex = re.compile(r'\b([A-Z][a-zA-Z\s]+,\s*(?:[A-Z]{2}|[A-Z][a-zA-Z]+))\b')
    for line in contact_lines[:5]:
        loc_match = location_regex.search(line)
        if loc_match:
            location = loc_match.group(1).strip()
            break

    return {
        "full_name": full_name or "Imported Resume Candidate",
        "headline": headline,
        "email": email,
        "phone": phone,
        "location": location,
        "website": website,
        "linkedin_url": linkedin,
        "github_url": github,
        "portfolio_url": website if website and "portfolio" in website.lower() else None,
    }


def parse_summary(summary_text: str) -> Optional[str]:
    """Cleans and returns professional summary text."""
    clean = summary_text.strip()
    return clean if clean else None


def parse_experiences(exp_text: str) -> List[Dict[str, Any]]:
    """Extracts job entries, dates, company names, titles, and achievement bullets."""
    if not exp_text:
        return []

    lines = [l.strip() for l in exp_text.splitlines() if l.strip()]
    experiences: List[Dict[str, Any]] = []

    current_exp: Optional[Dict[str, Any]] = None

    for line in lines:
        date_match = DATE_RANGE_REGEX.search(line)

        # If a line contains a date range, it likely represents a job header
        if date_match:
            if current_exp:
                experiences.append(current_exp)

            start_part = f"{date_match.group(1) or ''} {date_match.group(2) or ''}".strip()
            end_raw = date_match.group(3) or date_match.group(4) or ''
            is_current = bool(re.search(r'present|current', end_raw, re.IGNORECASE))
            end_date = None if is_current else end_raw.strip()

            # Remainder of line without the date
            header_text = line[:date_match.start()] + line[date_match.end():]
            header_text = header_text.strip(' -–—|,')

            # Extract title and company if formatted with separator
            parts = re.split(r'\s*[-–—|@,]\s*', header_text)
            if len(parts) >= 2:
                job_title = parts[0].strip()
                company = parts[1].strip()
            elif len(parts) == 1 and parts[0]:
                job_title = parts[0].strip()
                company = "Company"
            else:
                job_title = "Software Engineer"
                company = "Company"

            current_exp = {
                "company": company or "Company",
                "job_title": job_title or "Position",
                "location": None,
                "employment_type": "Full-time",
                "start_date": start_part,
                "end_date": end_date,
                "is_current": is_current,
                "description": "",
                "display_order": len(experiences),
                "bullets": [],
            }
        elif current_exp:
            # Bullet point or description
            is_bullet = bool(BULLET_PREFIX_REGEX.match(line))
            clean_content = BULLET_PREFIX_REGEX.sub('', line).strip()

            if is_bullet or len(line.split()) > 4:
                current_exp["bullets"].append({
                    "content": clean_content,
                    "display_order": len(current_exp["bullets"]),
                })
            elif not current_exp["company"] or current_exp["company"] == "Company":
                current_exp["company"] = line
        else:
            # First position header if date was on subsequent line
            parts = re.split(r'\s*[-–—|@,]\s*', line)
            if len(parts) >= 2:
                current_exp = {
                    "company": parts[1].strip(),
                    "job_title": parts[0].strip(),
                    "location": None,
                    "employment_type": "Full-time",
                    "start_date": "",
                    "end_date": None,
                    "is_current": False,
                    "description": "",
                    "display_order": len(experiences),
                    "bullets": [],
                }

    if current_exp:
        experiences.append(current_exp)

    return experiences


def parse_educations(edu_text: str) -> List[Dict[str, Any]]:
    """Extracts degrees, institutions, and graduation years."""
    if not edu_text:
        return []

    lines = [l.strip() for l in edu_text.splitlines() if l.strip()]
    educations: List[Dict[str, Any]] = []
    current_edu: Optional[Dict[str, Any]] = None

    degree_regex = re.compile(
        r'\b(Bachelor|Master|B\.?S\.?|B\.?A\.?|B\.?Tech|B\.?E\.?|M\.?S\.?|M\.?Tech|MBA|Ph\.?D|Associate|Diploma)\b',
        re.IGNORECASE
    )
    institution_keywords = ('university', 'college', 'institute', 'school', 'academy', 'polytechnic')

    for line in lines:
        is_inst_line = any(kw in line.lower() for kw in institution_keywords)
        is_deg_line = bool(degree_regex.search(line))
        year_match = SINGLE_YEAR_REGEX.search(line)
        year = year_match.group(0) if year_match else None

        date_range = DATE_RANGE_REGEX.search(line)
        start_date = None
        end_date = None
        if date_range:
            g1_prefix, g1_year, g2_end, g2_year = date_range.groups()
            start_date = f"{g1_prefix.strip()} {g1_year}".strip() if g1_prefix else g1_year
            if g2_end and g2_end.lower() in ("present", "current"):
                end_date = "Present"
            elif g2_year:
                end_date = f"{g2_end.strip()} {g2_year}".strip() if g2_end else g2_year
        elif year:
            end_date = year

        if is_inst_line:
            if current_edu and current_edu.get("institution"):
                educations.append(current_edu)
                current_edu = None

            inst_text = line
            deg_text = None
            if "|" in line:
                parts = [p.strip() for p in line.split("|")]
                inst_text = parts[0]
                if len(parts) > 1 and degree_regex.search(parts[1]):
                    deg_text = parts[1]
            elif " - " in line and degree_regex.search(line):
                parts = [p.strip() for p in line.split(" - ")]
                inst_text = parts[0]
                if len(parts) > 1 and degree_regex.search(parts[1]):
                    deg_text = parts[1]

            current_edu = {
                "institution": SINGLE_YEAR_REGEX.sub('', inst_text).strip(' -–—|, '),
                "degree": deg_text,
                "field_of_study": None,
                "location": None,
                "start_date": start_date,
                "end_date": end_date,
                "description": "",
                "display_order": len(educations),
            }
        elif is_deg_line:
            deg_text = line
            if "|" in line:
                parts = [p.strip() for p in line.split("|")]
                deg_text = parts[0]
            elif " - " in line and (date_range or year):
                parts = [p.strip() for p in line.split(" - ")]
                deg_text = parts[0]

            clean_deg = SINGLE_YEAR_REGEX.sub('', deg_text).strip(' -–—|, ')

            if current_edu and not current_edu.get("degree"):
                current_edu["degree"] = clean_deg
                if start_date and not current_edu.get("start_date"):
                    current_edu["start_date"] = start_date
                if end_date and not current_edu.get("end_date"):
                    current_edu["end_date"] = end_date
            else:
                if current_edu:
                    educations.append(current_edu)
                current_edu = {
                    "institution": "University / Institution",
                    "degree": clean_deg,
                    "field_of_study": None,
                    "location": None,
                    "start_date": start_date,
                    "end_date": end_date,
                    "description": "",
                    "display_order": len(educations),
                }
        elif current_edu:
            if year and not current_edu.get("end_date"):
                current_edu["end_date"] = year
            elif not current_edu.get("description"):
                current_edu["description"] = line

    if current_edu:
        educations.append(current_edu)

    return educations


def parse_skills(skills_text: str) -> List[Dict[str, Any]]:
    """Extracts skill chips, supporting categorized headings."""
    if not skills_text:
        return []

    lines = [l.strip() for l in skills_text.splitlines() if l.strip()]
    skills: List[Dict[str, Any]] = []
    seen = set()

    for line in lines:
        # Check if line has a category prefix, e.g. "Languages: Python, Go"
        category = None
        content = line
        if ":" in line:
            parts = line.split(":", 1)
            if len(parts[0].split()) <= 4:
                category = parts[0].strip()
                content = parts[1].strip()

        # Split skills by comma, bullet, or pipe
        raw_items = re.split(r'[,|•●;]+', content)
        for item in raw_items:
            clean = item.strip(' -*•●')
            if clean and len(clean) <= 60 and clean.lower() not in seen:
                seen.add(clean.lower())
                skills.append({
                    "skill_name": clean,
                    "category": category,
                    "display_order": len(skills),
                })

    return skills


def parse_projects(proj_text: str) -> List[Dict[str, Any]]:
    """Extracts project entries and project bullet points."""
    if not proj_text:
        return []

    lines = [l.strip() for l in proj_text.splitlines() if l.strip()]
    projects: List[Dict[str, Any]] = []
    current_proj: Optional[Dict[str, Any]] = None

    for line in lines:
        is_bullet = bool(BULLET_PREFIX_REGEX.match(line))
        clean = BULLET_PREFIX_REGEX.sub('', line).strip()

        # If line contains a URL or short title without bullet, likely a project header
        url_match = GENERAL_URL_REGEX.search(line)
        if not is_bullet and len(line.split()) <= 8:
            if current_proj:
                projects.append(current_proj)

            url = url_match.group(0) if url_match else None
            title = GENERAL_URL_REGEX.sub('', line).strip(' -–—|:,')

            current_proj = {
                "name": title or "Project",
                "description": "",
                "url": url,
                "technologies": None,
                "display_order": len(projects),
                "bullets": [],
            }
        elif current_proj:
            if is_bullet or len(line.split()) > 5:
                current_proj["bullets"].append({
                    "content": clean,
                    "display_order": len(current_proj["bullets"]),
                })
            elif not current_proj["description"]:
                current_proj["description"] = clean

    if current_proj:
        projects.append(current_proj)

    return projects


def parse_certifications(cert_text: str) -> List[Dict[str, Any]]:
    """Extracts certification entries."""
    if not cert_text:
        return []

    lines = [l.strip() for l in cert_text.splitlines() if l.strip()]
    certs: List[Dict[str, Any]] = []

    for line in lines:
        clean = BULLET_PREFIX_REGEX.sub('', line).strip()
        if not clean:
            continue

        year_match = SINGLE_YEAR_REGEX.search(clean)
        year = year_match.group(0) if year_match else None
        name_only = SINGLE_YEAR_REGEX.sub('', clean).strip(' -–—|,')

        parts = re.split(r'\s*[-–—|,]\s*', name_only)
        cert_name = parts[0].strip() if parts else clean
        issuer = parts[1].strip() if len(parts) > 1 else None

        certs.append({
            "name": cert_name,
            "issuer": issuer,
            "issue_date": year,
            "expiration_date": None,
            "credential_id": None,
            "credential_url": None,
            "display_order": len(certs),
        })

    return certs


def parse_links(links_text: str, full_text: str) -> List[Dict[str, Any]]:
    """Extracts professional links with labels."""
    links: List[Dict[str, Any]] = []
    seen_urls = set()

    for m in GENERAL_URL_REGEX.finditer(full_text):
        url = m.group(0).rstrip('.,;)')
        if url in seen_urls:
            continue
        seen_urls.add(url)

        label = "Website"
        if "linkedin.com" in url.lower():
            label = "LinkedIn"
        elif "github.com" in url.lower():
            label = "GitHub"
        elif "portfolio" in url.lower():
            label = "Portfolio"

        links.append({
            "label": label,
            "url": url,
            "display_order": len(links),
        })

    return links


# --- Main Pipeline Orchestrator ---

def parse_resume_document(content: bytes, filename: str) -> Dict[str, Any]:
    """
    Main entry point for document parsing.
    Extracts text, identifies sections, and formats normalized structured resume dictionary.
    """
    filename_lower = filename.lower()
    if filename_lower.endswith('.pdf'):
        raw_text = extract_text_from_pdf(content)
    elif filename_lower.endswith('.docx'):
        raw_text = extract_text_from_docx(content)
    else:
        raise ValueError("Unsupported file type. Please upload a PDF or DOCX file.")

    sections = detect_sections(raw_text)

    contact_data = parse_contact_info(sections.get('contact', ''), raw_text)
    summary_data = parse_summary(sections.get('summary', ''))
    experiences = parse_experiences(sections.get('experience', ''))
    educations = parse_educations(sections.get('education', ''))
    skills = parse_skills(sections.get('skills', ''))
    projects = parse_projects(sections.get('projects', ''))
    certifications = parse_certifications(sections.get('certifications', ''))
    links = parse_links(sections.get('links', ''), raw_text)

    # Collect any unsupported sections (awards, publications, volunteer, etc.)
    unsupported_sections = []
    for key in UNSUPPORTED_SECTION_PATTERNS:
        content_block = sections.get(key, '').strip()
        if content_block:
            unsupported_sections.append({
                "title": key.capitalize(),
                "content": content_block,
            })

    # Detection of incomplete extraction or complex formatting warnings
    warnings: List[str] = []
    if not experiences:
        warnings.append("No work experience sections could be identified from this document layout.")
    if not skills:
        warnings.append("No explicit skills section found. Skills may need to be added manually.")
    if unsupported_sections:
        unsupported_names = [s['title'] for s in unsupported_sections]
        warnings.append(f"Additional sections detected ({', '.join(unsupported_names)}) that require manual review.")

    # Human-readable default title from filename without extension
    clean_title = re.sub(r'\.(pdf|docx)$', '', filename, flags=re.IGNORECASE).strip()
    if clean_title:
        clean_title = f"{clean_title} (Imported)"
    else:
        clean_title = "Imported Resume"

    return {
        "name": clean_title,
        "is_default": False,
        "status": "draft",
        "personal_info": contact_data,
        "summary": {"summary": summary_data} if summary_data else None,
        "experiences": experiences,
        "educations": educations,
        "skills": skills,
        "projects": projects,
        "certifications": certifications,
        "links": links,
        "unsupported_sections": unsupported_sections,
        "warnings": warnings,
    }
