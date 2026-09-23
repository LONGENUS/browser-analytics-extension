"""
WebIntel — Website Overview Service (Module 1)
Generates comprehensive overview metrics including automatic PageType
and Industry classification with rule-based confidence scoring, favicon,
language, currency, and canonical resolution.
"""

import csv
import io
import json
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple, Union
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup
from models.overview import OverviewData, OverviewError


class OverviewService:
    """
    Website Overview Engine.
    Exposes: analyze(), validate(), normalize(), export()
    """

    # --- Industry Keyword Maps ---
    INDUSTRY_PATTERNS = {
        "Retail & Ecommerce": [
            r"\b(shop|store|cart|checkout|products?|catalog|deals?|discounts?|sales?|merchandise|apparel|shoes|fashion|retail)\b"
        ],
        "Tech & Software": [
            r"\b(software|saas|apis?|developer|code|coding|cloud|platform|database|security|automation|ai|machine learning|open source|sdk|framework|documentation|docs|library|libraries|programming)\b"
        ],
        "Finance & Fintech": [
            r"\b(bank|banking|finance|financial|investing|crypto|bitcoin|payments?|credit card|loans?|mortgage|wealth|stocks?|trading|fintech|insurance)\b"
        ],
        "Media & Publishing": [
            r"\b(news|magazine|editorial|journalism|articles?|broadcast|media|press|podcast|entertainment|publishing)\b"
        ],
        "Healthcare & Wellness": [
            r"\b(health|medical|clinic|doctor|pharmacy|medicine|hospital|wellness|therapy|patient|healthcare)\b"
        ],
        "Education & EdTech": [
            r"\b(university|college|course|tutorial|academy|education|school|learning|degree|training|student)\b"
        ],
        "Travel & Hospitality": [
            r"\b(hotel|flight|airline|booking|travel|vacation|resort|tourism|destination|cruise|rental car)\b"
        ],
        "Food & Beverage": [
            r"\b(restaurant|food|dining|cuisine|recipe|cafe|bakery|coffee|delivery|menu|catering)\b"
        ],
        "Professional Services": [
            r"\b(consulting|agency|legal|attorney|lawyer|accounting|audit|recruiting|staffing|advisory)\b"
        ],
    }

    # --- Known Marketplace Domains ---
    MARKETPLACE_DOMAINS = {
        "amazon.", "ebay.", "flipkart.", "etsy.", "walmart.", "aliexpress.",
        "target.", "shopee.", "lazada.", "rakuten.", "mercadolibre.", "wayfair."
    }

    # --- Currency Maps ---
    CURRENCY_SYMBOLS = {
        "$": "USD",
        "€": "EUR",
        "£": "GBP",
        "₹": "INR",
        "¥": "JPY",
        "A$": "AUD",
        "C$": "CAD",
        "₩": "KRW",
        "R$": "BRL",
        "CHF": "CHF",
        "AED": "AED",
    }

    def analyze(self, crawl_result: dict, status_code: int = 200) -> Dict[str, Any]:
        """
        Analyze a crawl result and generate the normalized Overview response.

        Args:
            crawl_result: Dict containing url, domain, title, html, products, metadata, etc.
            status_code: HTTP response status code

        Returns:
            Normalized overview dictionary or structured error dictionary.
        """
        try:
            url = crawl_result.get("url", "").strip()
            if not url:
                return OverviewError(
                    reason="Invalid crawl result: URL is missing",
                    details={"crawl_result_keys": list(crawl_result.keys())}
                ).serialize()

            domain = crawl_result.get("domain") or urlparse(url).netloc.lower()
            title = (crawl_result.get("title") or "").strip()
            html = crawl_result.get("html", "")
            metadata = crawl_result.get("metadata", {}) or {}
            products = crawl_result.get("products", []) or []
            links = crawl_result.get("links", []) or []

            # Parse soup once if HTML is available
            soup = BeautifulSoup(html, "html.parser") if html else None

            # 1. Canonical URL
            canonical_url = self._extract_canonical(soup, url, metadata)

            # 2. Favicon
            favicon = self._extract_favicon(soup, url, domain)

            # 3. Language
            language = self._extract_language(soup, metadata)

            # 4. Currency
            currency = self._extract_currency(soup, products, html)

            # 5. PageType & Confidence
            page_type, confidence = self._classify_page_type(
                url=url,
                domain=domain,
                title=title,
                soup=soup,
                products=products,
                links=links,
                html=html,
                metadata=metadata
            )

            # 6. Industry
            industry = self._classify_industry(
                domain=domain,
                title=title,
                metadata=metadata,
                page_type=page_type,
                html=html
            )

            raw_overview = {
                "url": url,
                "domain": domain,
                "title": title or domain,
                "favicon": favicon,
                "industry": industry,
                "pageType": page_type,
                "confidence": round(confidence, 2),
                "language": language,
                "currency": currency,
                "scrapedAt": datetime.now(timezone.utc).isoformat(),
                "statusCode": status_code,
                "canonicalUrl": canonical_url,
            }

            return self.normalize(raw_overview)

        except Exception as e:
            return OverviewError(
                reason=f"Failed to generate website overview: {str(e)}",
                details={"error_type": type(e).__name__}
            ).serialize()

    def validate(self, data: dict) -> bool:
        """Validate dictionary data against the OverviewData schema."""
        try:
            OverviewData(**data)
            return True
        except Exception:
            return False

    def normalize(self, raw_data: dict) -> Dict[str, Any]:
        """Normalize and validate raw dictionary into standard schema."""
        validated = OverviewData(**raw_data)
        return validated.serialize()

    def export(self, data: dict, format: str = "json") -> Union[str, bytes]:
        """
        Export overview data into supported formats: json, csv, dict.
        """
        fmt = (format or "json").lower().strip()

        if fmt == "json":
            return json.dumps(data, indent=2, ensure_ascii=False)

        elif fmt == "csv":
            output = io.StringIO()
            writer = csv.writer(output)

            # Convert data to export row if valid OverviewData
            if self.validate(data):
                row_dict = OverviewData(**data).to_export_row()
            else:
                row_dict = {k: str(v) for k, v in data.items()}

            writer.writerow(list(row_dict.keys()))
            writer.writerow(list(row_dict.values()))
            return output.getvalue()

        elif fmt == "dict":
            return data

        raise ValueError(f"Unsupported export format '{format}'. Supported formats: json, csv, dict.")

    # --- Feature Extraction Helpers ---

    def _extract_favicon(self, soup: Optional[BeautifulSoup], url: str, domain: str) -> Optional[str]:
        """Extract favicon from HTML or construct standard fallback."""
        if soup:
            icon_rel = soup.find("link", rel=lambda r: r and any(
                x in str(r).lower() for x in ("icon", "shortcut icon", "apple-touch-icon")
            ))
            if icon_rel and icon_rel.get("href"):
                raw_href = icon_rel["href"].strip()
                if raw_href:
                    return urljoin(url, raw_href)

        # Fallback to standard domain favicon URL
        parsed = urlparse(url)
        if parsed.scheme and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}/favicon.ico"
        return f"https://www.google.com/s2/favicons?domain={domain}&sz=64"

    def _extract_canonical(self, soup: Optional[BeautifulSoup], url: str, metadata: dict) -> Optional[str]:
        """Extract canonical URL from link tag or OpenGraph metadata."""
        if soup:
            link = soup.find("link", rel=lambda r: r and "canonical" in str(r).lower())
            if link and link.get("href"):
                return urljoin(url, link["href"].strip())

            og_url = soup.find("meta", property="og:url")
            if og_url and og_url.get("content"):
                return urljoin(url, og_url["content"].strip())

        if metadata.get("canonical"):
            return urljoin(url, metadata["canonical"])

        return url

    def _extract_language(self, soup: Optional[BeautifulSoup], metadata: dict) -> str:
        """Extract ISO language code from html tag or meta headers."""
        if soup and soup.html and soup.html.get("lang"):
            lang = soup.html["lang"].strip().lower()
            return lang.split("-")[0].split("_")[0] if lang else "en"

        if soup:
            meta_lang = soup.find("meta", attrs={"http-equiv": re.compile(r"content-language", re.I)})
            if meta_lang and meta_lang.get("content"):
                return meta_lang["content"].strip().lower().split("-")[0][:2]

            og_locale = soup.find("meta", property="og:locale")
            if og_locale and og_locale.get("content"):
                return og_locale["content"].strip().lower().split("_")[0][:2]

        return "en"

    def _extract_currency(self, soup: Optional[BeautifulSoup], products: list, html: str) -> Optional[str]:
        """Detect currency from structured data, meta tags, products, or page text."""
        # 1. From meta tag
        if soup:
            meta_curr = soup.find("meta", property=re.compile(r"price:currency", re.I)) or soup.find("meta", attrs={"itemprop": "priceCurrency"})
            if meta_curr and meta_curr.get("content"):
                return meta_curr["content"].strip().upper()

        # 2. From product data
        for p in products:
            price_str = str(p.get("price") or "")
            for sym, code in self.CURRENCY_SYMBOLS.items():
                if sym in price_str:
                    return code

        # 3. From text symbols
        if html:
            sample = html[:20000]
            for sym, code in self.CURRENCY_SYMBOLS.items():
                if sym in sample:
                    return code

        return None

    def _classify_page_type(
        self,
        url: str,
        domain: str,
        title: str,
        soup: Optional[BeautifulSoup],
        products: list,
        links: list,
        html: str,
        metadata: dict
    ) -> Tuple[str, float]:
        """
        Classifies page into one of:
        - Marketplace
        - Ecommerce
        - SaaS
        - Blog
        - Company
        - News
        - Documentation
        - Portfolio
        - Generic

        Returns: (pageType, confidence_score)
        """
        scores: Dict[str, float] = {
            "Marketplace": 0.0,
            "Ecommerce": 0.0,
            "SaaS": 0.0,
            "Blog": 0.0,
            "Company": 0.0,
            "News": 0.0,
            "Documentation": 0.0,
            "Portfolio": 0.0,
        }

        url_lower = url.lower()
        title_lower = title.lower()
        desc_lower = (metadata.get("description") or "").lower()
        text_sample = ""
        if soup:
            # Sample text from visible body
            body = soup.find("body")
            text_sample = (body.get_text(" ", strip=True) if body else "")[:15000].lower()
        elif html:
            text_sample = html[:15000].lower()

        # --- Rule 1: Marketplace ---
        for mp in self.MARKETPLACE_DOMAINS:
            if mp in domain:
                scores["Marketplace"] += 6.0

        if re.search(r"\b(ships from|sold by|seller information|seller rating|storefront|multi-vendor)\b", text_sample):
            scores["Marketplace"] += 3.5

        if len(products) >= 3 and any(p.get("brand") for p in products):
            scores["Marketplace"] += 2.0

        # --- Rule 2: Ecommerce ---
        if products and len(products) > 0:
            scores["Ecommerce"] += 2.5

        if re.search(r"\b(add to cart|add to bag|buy now|checkout|view cart|in stock|out of stock|order total)\b", text_sample):
            scores["Ecommerce"] += 3.0

        if soup and soup.find(attrs={"class": re.compile(r"cart|checkout|price|product", re.I)}):
            scores["Ecommerce"] += 1.5

        # --- Rule 3: SaaS ---
        if re.search(r"\b(pricing|sign up free|start free trial|request demo|get started|plans & pricing|book a demo|login|register)\b", text_sample):
            scores["SaaS"] += 3.0

        if re.search(r"\b(saas|platform|api|integrations|features|cloud software|dashboard|workflow)\b", title_lower + " " + desc_lower):
            scores["SaaS"] += 2.0

        if any(w in url_lower for w in ("/pricing", "/features", "/solutions", "/app")):
            scores["SaaS"] += 2.0

        # --- Rule 4: Documentation ---
        if any(w in url_lower for w in ("/docs", "/documentation", "/api-reference", "/guides", "/manual")):
            scores["Documentation"] += 4.0

        if re.search(r"\b(documentation|quickstart|api reference|getting started|table of contents|sdk installation)\b", title_lower + " " + text_sample[:2000]):
            scores["Documentation"] += 2.5

        if soup and (soup.find("pre") or soup.find("code")):
            scores["Documentation"] += 1.0

        # --- Rule 5: Blog ---
        if any(w in url_lower for w in ("/blog", "/post", "/posts", "/article", "/articles", "/entry")):
            scores["Blog"] += 3.5

        if re.search(r"\b(written by|by\s+[a-z]+|min read|published on|reading time|comments?|leave a reply)\b", text_sample):
            scores["Blog"] += 2.5

        if soup and soup.find("meta", property=re.compile(r"article:published_time|article:author", re.I)):
            scores["Blog"] += 3.0

        # --- Rule 6: News ---
        if any(w in domain for w in ("news", "times", "tribune", "gazette", "post", "herald", "daily")):
            scores["News"] += 2.5

        if re.search(r"\b(breaking news|reuters|associated press|editorial|headline|politics|world news|journalism)\b", title_lower + " " + text_sample[:3000]):
            scores["News"] += 3.0

        if soup and soup.find("script", type="application/ld+json"):
            for s in soup.find_all("script", type="application/ld+json"):
                if "NewsArticle" in (s.string or ""):
                    scores["News"] += 4.0

        # --- Rule 7: Portfolio ---
        if any(w in url_lower for w in ("/portfolio", "/projects", "/works", "/about-me", "/case-studies")):
            scores["Portfolio"] += 3.5

        if re.search(r"\b(my work|selected projects|portfolio|case studies|resume|cv|designer & developer|creative director)\b", title_lower + " " + text_sample[:2000]):
            scores["Portfolio"] += 3.0

        # --- Rule 8: Company ---
        if re.search(r"\b(about us|our team|leadership|careers|investor relations|contact us|our mission|headquarters)\b", text_sample):
            scores["Company"] += 2.0

        if any(w in url_lower for w in ("/about", "/company", "/contact", "/team")):
            scores["Company"] += 2.0

        # Determine winner
        sorted_scores = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        top_type, top_score = sorted_scores[0]
        second_score = sorted_scores[1][1] if len(sorted_scores) > 1 else 0.0

        if top_score < 1.5:
            return "Company" if top_score > 0 else "Generic", 0.65

        # Compute confidence based on margin over second place
        margin = top_score - second_score
        confidence = min(0.98, max(0.70, 0.70 + (margin * 0.06) + (top_score * 0.03)))
        return top_type, round(confidence, 2)

    def _classify_industry(
        self,
        domain: str,
        title: str,
        metadata: dict,
        page_type: str,
        html: str
    ) -> str:
        """Classify website into an industry vertical."""
        combined_text = f"{domain} {title} {metadata.get('description', '')} {html[:10000]}".lower()

        matched_counts = {}
        for industry, patterns in self.INDUSTRY_PATTERNS.items():
            count = 0
            for pattern in patterns:
                count += len(re.findall(pattern, combined_text))
            if count > 0:
                matched_counts[industry] = count

        if matched_counts:
            best_industry = max(matched_counts.items(), key=lambda x: x[1])[0]
            return best_industry

        if page_type in ("Marketplace", "Ecommerce"):
            return "Retail & Ecommerce"
        elif page_type in ("SaaS", "Documentation"):
            return "Tech & Software"
        elif page_type == "News":
            return "Media & Publishing"

        return "General"


# Singleton
overview_service = OverviewService()
