"""
WebIntel — SEO Intelligence Service (Module 3)
Extracts comprehensive metadata, headings hierarchy, image ALT audits,
link structure, JSON-LD structured data, and computes a rule-based 0-100 score.
"""

import csv
import io
import json
import re
from typing import Any, Dict, List, Optional, Union
from urllib.parse import urlparse

from bs4 import BeautifulSoup

from models.seo import (
    SeoMetadata,
    HeadingItem,
    HeadingsAudit,
    ImageAuditItem,
    ImagesAudit,
    LinksAudit,
    StructuredDataItem,
    StructuredDataAudit,
    SeoScore,
    SeoIntelligenceResponse,
    SeoError,
)


class SeoService:
    """
    SEO Intelligence Engine.
    Exposes: analyze(), validate(), normalize(), export()
    """

    def analyze(self, crawl_result: dict) -> Dict[str, Any]:
        """
        Analyze page HTML and crawl metadata to compute a comprehensive SEO audit.
        """
        if not crawl_result or not isinstance(crawl_result, dict):
            return SeoError(reason="Invalid crawl result provided").serialize()

        try:
            url = crawl_result.get("url", "")
            domain = crawl_result.get("domain", "") or urlparse(url).netloc
            html = crawl_result.get("html", "") or ""
            metadata_in = crawl_result.get("metadata", {}) or {}

            soup = BeautifulSoup(html, "html.parser") if html else None

            # 1. Metadata Audit
            meta_audit = self._audit_metadata(soup, metadata_in, crawl_result)

            # 2. Headings Audit
            headings_audit = self._audit_headings(soup)

            # 3. Images Audit
            images_audit = self._audit_images(soup, crawl_result.get("images", []))

            # 4. Links Audit
            links_audit = self._audit_links(soup, crawl_result.get("links", []), url)

            # 5. Structured Data Audit
            schema_audit = self._audit_structured_data(soup)

            # 6. Rule-based SEO Score (0 - 100)
            score_data = self._calculate_seo_score(
                meta_audit, headings_audit, images_audit, links_audit, schema_audit
            )

            response = SeoIntelligenceResponse(
                url=url,
                domain=domain,
                seo_score=score_data,
                metadata=meta_audit,
                headings=headings_audit,
                images=images_audit,
                links=links_audit,
                structured_data=schema_audit,
            )

            return response.serialize()

        except Exception as e:
            return SeoError(
                reason=f"SEO analysis failed: {str(e)}",
                details={"error_type": type(e).__name__}
            ).serialize()

    def validate(self, data: dict) -> bool:
        """Validate SEO intelligence dictionary."""
        try:
            SeoIntelligenceResponse(**data)
            return True
        except Exception:
            return False

    def normalize(self, data: dict) -> Dict[str, Any]:
        """Serialize and validate SEO data."""
        return SeoIntelligenceResponse(**data).serialize()

    def export(self, data: dict, format: str = "json") -> Union[str, bytes]:
        """Export SEO audit into CSV, JSON, or XLSX."""
        fmt = (format or "json").lower().strip()

        if fmt == "json":
            return json.dumps(data, indent=2, ensure_ascii=False)

        # Build tabular summary rows
        score_info = data.get("seo_score", {})
        meta_info = data.get("metadata", {})
        head_info = data.get("headings", {})
        img_info = data.get("images", {})
        link_info = data.get("links", {})
        struct_info = data.get("structured_data", {})

        rows = [
            {"Category": "SEO Score", "Metric": "Overall Score", "Value": f"{score_info.get('score', 0)}/100 ({score_info.get('rating', 'N/A')})"},
            {"Category": "Metadata", "Metric": "Title", "Value": meta_info.get("title", "")},
            {"Category": "Metadata", "Metric": "Title Length", "Value": str(meta_info.get("title_length", 0))},
            {"Category": "Metadata", "Metric": "Meta Description", "Value": meta_info.get("description", "")},
            {"Category": "Metadata", "Metric": "Canonical URL", "Value": meta_info.get("canonical", "")},
            {"Category": "Metadata", "Metric": "Robots Directive", "Value": meta_info.get("robots", "")},
            {"Category": "Headings", "Metric": "H1 Count", "Value": str(head_info.get("h1_count", 0))},
            {"Category": "Headings", "Metric": "H2 Count", "Value": str(head_info.get("h2_count", 0))},
            {"Category": "Headings", "Metric": "H3 Count", "Value": str(head_info.get("h3_count", 0))},
            {"Category": "Images", "Metric": "Total Images", "Value": str(img_info.get("total_images", 0))},
            {"Category": "Images", "Metric": "Missing ALT Tags", "Value": str(img_info.get("missing_alt_count", 0))},
            {"Category": "Images", "Metric": "ALT Coverage", "Value": f"{img_info.get('alt_coverage_percent', 0.0):.1f}%"},
            {"Category": "Links", "Metric": "Total Links", "Value": str(link_info.get("total_links", 0))},
            {"Category": "Links", "Metric": "Internal Links", "Value": str(link_info.get("internal_links_count", 0))},
            {"Category": "Links", "Metric": "External Links", "Value": str(link_info.get("external_links_count", 0))},
            {"Category": "Structured Data", "Metric": "JSON-LD Present", "Value": "Yes" if struct_info.get("has_json_ld") else "No"},
            {"Category": "Structured Data", "Metric": "Schema Types", "Value": ", ".join(struct_info.get("detected_types", []))},
        ]

        if fmt == "csv":
            output = io.StringIO()
            writer = csv.DictWriter(output, fieldnames=["Category", "Metric", "Value"])
            writer.writeheader()
            writer.writerows(rows)
            return output.getvalue()

        elif fmt in ("xlsx", "excel"):
            stream = io.BytesIO()
            try:
                import pandas as pd
                df = pd.DataFrame(rows)
                with pd.ExcelWriter(stream, engine="openpyxl") as writer:
                    df.to_excel(writer, sheet_name="SEO Audit", index=False)
                stream.seek(0)
                return stream.getvalue()
            except Exception:
                return self.export(data, "csv").encode("utf-8")

        raise ValueError(f"Unsupported format '{format}'. Supported: json, csv, xlsx.")

    # --- Internal Auditing Routines ---

    def _audit_metadata(self, soup: Optional[BeautifulSoup], meta_in: dict, crawl_result: dict) -> SeoMetadata:
        title = ""
        description = ""
        canonical = ""
        robots = ""
        charset = "UTF-8"
        viewport = ""

        if soup:
            # Title
            title_tag = soup.find("title")
            if title_tag and title_tag.string:
                title = title_tag.string.strip()

            # Meta Description
            desc_el = soup.find("meta", attrs={"name": re.compile(r"^description$", re.I)}) or \
                      soup.find("meta", attrs={"property": re.compile(r"^og:description$", re.I)})
            if desc_el and desc_el.get("content"):
                description = desc_el["content"].strip()

            # Canonical
            canon_el = soup.find("link", rel=re.compile(r"^canonical$", re.I))
            if canon_el and canon_el.get("href"):
                canonical = canon_el["href"].strip()

            # Robots
            robots_el = soup.find("meta", attrs={"name": re.compile(r"^robots$", re.I)})
            if robots_el and robots_el.get("content"):
                robots = robots_el["content"].strip()

            # Charset
            charset_el = soup.find("meta", attrs={"charset": True})
            if charset_el:
                charset = charset_el.get("charset", "UTF-8")

            # Viewport
            vp_el = soup.find("meta", attrs={"name": re.compile(r"^viewport$", re.I)})
            if vp_el and vp_el.get("content"):
                viewport = vp_el["content"].strip()

        # Fallbacks from crawl_result / metadata_in
        if not title:
            title = meta_in.get("title") or crawl_result.get("title") or ""
        if not description:
            description = meta_in.get("description", "")
        if not canonical:
            canonical = meta_in.get("canonical") or crawl_result.get("url") or ""

        return SeoMetadata(
            title=title,
            title_length=len(title),
            description=description,
            description_length=len(description),
            canonical=canonical,
            robots=robots or "index, follow",
            charset=charset,
            viewport=viewport or "width=device-width, initial-scale=1",
        )

    def _audit_headings(self, soup: Optional[BeautifulSoup]) -> HeadingsAudit:
        if not soup:
            return HeadingsAudit()

        all_headings: List[HeadingItem] = []
        h1_tags: List[str] = []
        issues: List[str] = []

        headings_elements = soup.find_all(["h1", "h2", "h3"])
        h1_count = 0
        h2_count = 0
        h3_count = 0
        last_level = 0

        for el in headings_elements:
            tag = el.name.lower()
            text = re.sub(r"\s+", " ", el.get_text()).strip()
            if not text:
                continue

            level = int(tag[1])
            if tag == "h1":
                h1_count += 1
                h1_tags.append(text)
            elif tag == "h2":
                h2_count += 1
            elif tag == "h3":
                h3_count += 1

            # Check skipped levels (e.g., jump from h1 directly to h3 without h2)
            if last_level > 0 and level > last_level + 1:
                issues.append(f"Skipped heading level: jumped from <h{last_level}> directly to <h{level}>")
            last_level = level

            all_headings.append(HeadingItem(tag=tag, text=text[:120], level=level))

        # Core H1 checks
        if h1_count == 0:
            issues.append("Missing <H1> tag: Every page must have exactly one top-level H1 tag.")
        elif h1_count > 1:
            issues.append(f"Multiple <H1> tags found ({h1_count}): Best practice recommends a single distinct H1.")

        return HeadingsAudit(
            h1_count=h1_count,
            h2_count=h2_count,
            h3_count=h3_count,
            h1_tags=h1_tags,
            hierarchy_issues=issues,
            all_headings=all_headings[:40],
        )

    def _audit_images(self, soup: Optional[BeautifulSoup], fallback_images: list) -> ImagesAudit:
        img_elements = soup.find_all("img") if soup else []
        total = len(img_elements) if img_elements else len(fallback_images)
        if total == 0:
            return ImagesAudit(total_images=0, missing_alt_count=0, alt_coverage_percent=100.0)

        missing_alt = 0
        sample_missing: List[str] = []
        format_breakdown: Dict[str, int] = {}

        if img_elements:
            for img in img_elements:
                src = img.get("src") or img.get("data-src") or ""
                alt = img.get("alt")

                has_alt = alt is not None and len(alt.strip()) > 0
                if not has_alt:
                    missing_alt += 1
                    if len(sample_missing) < 5 and src:
                        sample_missing.append(src)

                # Format detection
                ext_match = re.search(r"\.(webp|png|jpe?g|svg|gif|avif)", src, re.I)
                fmt = ext_match.group(1).lower() if ext_match else "other"
                if fmt in ("jpeg", "jpg"):
                    fmt = "jpg"
                format_breakdown[fmt] = format_breakdown.get(fmt, 0) + 1
        else:
            # Fallback
            for src in fallback_images:
                ext_match = re.search(r"\.(webp|png|jpe?g|svg|gif|avif)", str(src), re.I)
                fmt = ext_match.group(1).lower() if ext_match else "other"
                format_breakdown[fmt] = format_breakdown.get(fmt, 0) + 1

        coverage = round(((total - missing_alt) / total) * 100, 1) if total > 0 else 100.0

        return ImagesAudit(
            total_images=total,
            missing_alt_count=missing_alt,
            alt_coverage_percent=coverage,
            format_breakdown=format_breakdown,
            sample_missing_alt=sample_missing,
        )

    def _audit_links(self, soup: Optional[BeautifulSoup], fallback_links: list, page_url: str) -> LinksAudit:
        links_els = soup.find_all("a", href=True) if soup else []
        total = len(links_els) if links_els else len(fallback_links)

        base_domain = urlparse(page_url).netloc.lower()
        internal_sample: List[str] = []
        external_sample: List[str] = []
        internal_count = 0
        external_count = 0
        nofollow_count = 0
        empty_anchor_count = 0

        if links_els:
            for a in links_els:
                href = a["href"].strip()
                if not href or href.startswith(("#", "javascript:", "mailto:", "tel:")):
                    continue

                text = a.get_text().strip()
                if not text and not a.find("img"):
                    empty_anchor_count += 1

                rel = a.get("rel") or []
                if isinstance(rel, list) and "nofollow" in rel:
                    nofollow_count += 1
                elif isinstance(rel, str) and "nofollow" in rel.lower():
                    nofollow_count += 1

                parsed = urlparse(href)
                is_internal = (not parsed.netloc) or (parsed.netloc.lower() == base_domain)
                if is_internal:
                    internal_count += 1
                    if len(internal_sample) < 5:
                        internal_sample.append(href)
                else:
                    external_count += 1
                    if len(external_sample) < 5:
                        external_sample.append(href)
        else:
            for l in fallback_links:
                parsed = urlparse(str(l))
                if parsed.netloc and parsed.netloc.lower() != base_domain:
                    external_count += 1
                    if len(external_sample) < 5:
                        external_sample.append(str(l))
                else:
                    internal_count += 1
                    if len(internal_sample) < 5:
                        internal_sample.append(str(l))

        return LinksAudit(
            total_links=total,
            internal_links_count=internal_count,
            external_links_count=external_count,
            nofollow_count=nofollow_count,
            empty_anchor_count=empty_anchor_count,
            internal_sample=internal_sample,
            external_sample=external_sample,
        )

    def _audit_structured_data(self, soup: Optional[BeautifulSoup]) -> StructuredDataAudit:
        if not soup:
            return StructuredDataAudit()

        script_tags = soup.find_all("script", type="application/ld+json")
        detected_types: List[str] = []
        items: List[StructuredDataItem] = []
        has_product = False
        has_breadcrumb = False
        has_faq = False

        for tag in script_tags:
            try:
                raw_text = tag.string or tag.get_text()
                if not raw_text:
                    continue
                data = json.loads(raw_text.strip())

                # Single dict or list of dicts
                elements = data if isinstance(data, list) else [data]
                for el in elements:
                    if not isinstance(el, dict):
                        continue
                    schema_type = str(el.get("@type", "Thing"))
                    detected_types.append(schema_type)

                    if "product" in schema_type.lower():
                        has_product = True
                    if "breadcrumb" in schema_type.lower():
                        has_breadcrumb = True
                    if "faq" in schema_type.lower():
                        has_faq = True

                    items.append(
                        StructuredDataItem(
                            schema_type=schema_type,
                            context=str(el.get("@context", "https://schema.org")),
                            name=el.get("name"),
                            raw_snippet={k: v for k, v in el.items() if k not in ("@context", "@type") and not isinstance(v, (dict, list))}
                        )
                    )
            except Exception:
                continue

        # Check Microdata / Schema.org itemscope
        if not detected_types:
            for item in soup.find_all(attrs={"itemtype": True})[:5]:
                itype = item["itemtype"].split("/")[-1]
                detected_types.append(itype)

        return StructuredDataAudit(
            has_json_ld=len(script_tags) > 0,
            detected_types=list(dict.fromkeys(detected_types)),
            has_product_schema=has_product,
            has_breadcrumb_schema=has_breadcrumb,
            has_faq_schema=has_faq,
            items=items[:15],
        )

    def _calculate_seo_score(
        self,
        meta: SeoMetadata,
        headings: HeadingsAudit,
        images: ImagesAudit,
        links: LinksAudit,
        schema: StructuredDataAudit,
    ) -> SeoScore:
        score = 0
        breakdown = {}
        recommendations = []

        # 1. Title (max 15)
        if meta.title:
            if 30 <= meta.title_length <= 65:
                score += 15
                breakdown["title"] = 15
            else:
                score += 10
                breakdown["title"] = 10
                recommendations.append(f"Optimize title length: Currently {meta.title_length} chars. Ideal length is 30-65 chars.")
        else:
            breakdown["title"] = 0
            recommendations.append("Missing <title> tag: Crucial for search ranking and click-through rates.")

        # 2. Meta Description (max 15)
        if meta.description:
            if 70 <= meta.description_length <= 160:
                score += 15
                breakdown["description"] = 15
            else:
                score += 10
                breakdown["description"] = 10
                recommendations.append(f"Optimize meta description: Currently {meta.description_length} chars. Ideal length is 70-160 chars.")
        else:
            breakdown["description"] = 0
            recommendations.append("Missing meta description: Add a compelling summary (70-160 characters).")

        # 3. Canonical (max 10)
        if meta.canonical:
            score += 10
            breakdown["canonical"] = 10
        else:
            breakdown["canonical"] = 0
            recommendations.append("Missing canonical tag: Add <link rel='canonical'> to prevent duplicate content indexing.")

        # 4. Viewport / Mobile (max 10)
        if meta.viewport:
            score += 10
            breakdown["viewport"] = 10
        else:
            breakdown["viewport"] = 0
            recommendations.append("Missing viewport tag: Add <meta name='viewport'> for mobile responsiveness.")

        # 5. Headings (max 20)
        h_score = 0
        if headings.h1_count == 1:
            h_score += 15
        elif headings.h1_count > 1:
            h_score += 8
            recommendations.append("Multiple H1 tags detected: Restructure to maintain a single authoritative H1.")
        else:
            recommendations.append("Missing H1 tag: Ensure the page has a single clear H1 heading.")

        if headings.h2_count >= 1:
            h_score += 5
        score += h_score
        breakdown["headings"] = h_score

        # 6. Images ALT coverage (max 15)
        img_score = round((images.alt_coverage_percent / 100.0) * 15)
        score += img_score
        breakdown["images"] = img_score
        if images.missing_alt_count > 0:
            recommendations.append(f"Missing ALT attributes: {images.missing_alt_count} image(s) lack ALT text for accessibility and SEO.")

        # 7. Structured Data (max 15)
        if schema.has_json_ld or schema.detected_types:
            score += 15
            breakdown["structured_data"] = 15
        else:
            breakdown["structured_data"] = 0
            recommendations.append("No structured data (JSON-LD) found: Add Schema.org markup (Product, Breadcrumbs, Organization).")

        # Rating
        if score >= 85:
            rating = "Excellent"
        elif score >= 70:
            rating = "Good"
        elif score >= 50:
            rating = "Fair"
        else:
            rating = "Poor"

        return SeoScore(
            score=min(100, max(0, score)),
            rating=rating,
            breakdown=breakdown,
            recommendations=recommendations,
        )


seo_service = SeoService()
