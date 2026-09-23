"""
WebIntel — Technology Detection Service (Module 4)
Scans HTML content, script tags, stylesheets, metadata generators, and response headers
to identify technologies across 11 standard industry categories.
"""

import csv
import io
import json
import re
from typing import Any, Dict, List, Optional, Union
from urllib.parse import urlparse

from bs4 import BeautifulSoup

from models.tech import TechItem, TechStackResponse, TechError


class TechStackService:
    """
    Technology Detection Engine.
    Exposes: analyze(), validate(), normalize(), export()
    """

    def __init__(self):
        self._signatures = self._init_signatures()

    def analyze(self, crawl_result: dict) -> Dict[str, Any]:
        """
        Analyze a crawl result to detect active technologies, frameworks, and tools.
        """
        if not crawl_result or not isinstance(crawl_result, dict):
            return TechError(reason="Invalid crawl result provided").serialize()

        try:
            url = crawl_result.get("url", "")
            domain = crawl_result.get("domain", "") or urlparse(url).netloc
            html = crawl_result.get("html", "") or ""

            soup = BeautifulSoup(html, "html.parser") if html else None

            # Collect scripts, links, metas, text
            scripts = [s.get("src", "") for s in soup.find_all("script", src=True)] if soup else []
            links = [l.get("href", "") for l in soup.find_all("link", href=True)] if soup else []
            metas = {}
            if soup:
                for m in soup.find_all("meta"):
                    name = m.get("name") or m.get("property") or ""
                    content = m.get("content") or ""
                    if name:
                        metas[name.lower()] = content.lower()

            detected_dict: Dict[str, TechItem] = {}

            # Evaluate all signatures
            for sig in self._signatures:
                confidence = self._match_signature(sig, html, scripts, links, metas, url)
                if confidence > 0:
                    name = sig["name"]
                    # If already detected with lower confidence, upgrade
                    if name not in detected_dict or confidence > detected_dict[name].confidence:
                        detected_dict[name] = TechItem(
                            name=name,
                            category=sig["category"],
                            confidence=confidence,
                            version=sig.get("version"),
                            icon=sig.get("icon") or name.lower().replace(" ", "-"),
                        )

            detected_list = list(detected_dict.values())
            # Sort by confidence descending
            detected_list.sort(key=lambda x: x.confidence, reverse=True)

            # Group by category
            categories: Dict[str, List[TechItem]] = {}
            for item in detected_list:
                categories.setdefault(item.category, []).append(item)

            response = TechStackResponse(
                url=url,
                domain=domain,
                total_detected=len(detected_list),
                categories=categories,
                technologies=detected_list,
            )

            return response.serialize()

        except Exception as e:
            return TechError(
                reason=f"Technology detection failed: {str(e)}",
                details={"error_type": type(e).__name__}
            ).serialize()

    def validate(self, data: dict) -> bool:
        """Validate TechStack dictionary."""
        try:
            TechStackResponse(**data)
            return True
        except Exception:
            return False

    def normalize(self, data: dict) -> Dict[str, Any]:
        """Serialize and validate TechStack response."""
        return TechStackResponse(**data).serialize()

    def export(self, data: dict, format: str = "json") -> Union[str, bytes]:
        """Export TechStack detection results into CSV, JSON, or XLSX."""
        fmt = (format or "json").lower().strip()

        if fmt == "json":
            return json.dumps(data, indent=2, ensure_ascii=False)

        techs = data.get("technologies", [])
        rows = [
            {
                "Technology": t.get("name", ""),
                "Category": t.get("category", ""),
                "Confidence": f"{t.get('confidence', 0)}%",
                "Version": t.get("version") or "N/A"
            }
            for t in techs
        ]

        if fmt == "csv":
            output = io.StringIO()
            writer = csv.DictWriter(output, fieldnames=["Technology", "Category", "Confidence", "Version"])
            writer.writeheader()
            writer.writerows(rows)
            return output.getvalue()

        elif fmt in ("xlsx", "excel"):
            stream = io.BytesIO()
            try:
                import pandas as pd
                df = pd.DataFrame(rows)
                with pd.ExcelWriter(stream, engine="openpyxl") as writer:
                    df.to_excel(writer, sheet_name="Tech Stack", index=False)
                stream.seek(0)
                return stream.getvalue()
            except Exception:
                return self.export(data, "csv").encode("utf-8")

        raise ValueError(f"Unsupported format '{format}'. Supported: json, csv, xlsx.")

    # --- Matcher ---

    def _match_signature(self, sig: dict, html: str, scripts: list, links: list, metas: dict, url: str) -> int:
        confidence = 0

        # Check meta generator
        if "meta_generator" in sig:
            gen = metas.get("generator", "")
            if re.search(sig["meta_generator"], gen, re.I):
                return 100

        # Check script src patterns
        if "script_regex" in sig:
            for s in scripts:
                if re.search(sig["script_regex"], s, re.I):
                    return sig.get("confidence", 95)

        # Check stylesheet links
        if "link_regex" in sig:
            for l in links:
                if re.search(sig["link_regex"], l, re.I):
                    return sig.get("confidence", 92)

        # Check HTML regex
        if "html_regex" in sig:
            if re.search(sig["html_regex"], html, re.I):
                return sig.get("confidence", 90)

        # Check URL or domain patterns
        if "url_regex" in sig:
            if re.search(sig["url_regex"], url, re.I):
                return sig.get("confidence", 85)

        return confidence

    # --- Signatures Database ---

    def _init_signatures(self) -> List[dict]:
        return [
            # 1. Frontend Frameworks
            {
                "name": "React",
                "category": "Frontend Framework",
                "html_regex": r"(data-reactroot|react-dom|_reactInternal|__NEXT_DATA__)",
                "confidence": 98,
            },
            {
                "name": "Next.js",
                "category": "Frontend Framework",
                "html_regex": r"(__NEXT_DATA__|/_next/static/)",
                "confidence": 99,
            },
            {
                "name": "Vue.js",
                "category": "Frontend Framework",
                "html_regex": r"(data-v-[a-f0-9]{6,8}|__VUE__|vue\.min\.js)",
                "confidence": 96,
            },
            {
                "name": "Nuxt.js",
                "category": "Frontend Framework",
                "html_regex": r"(__NUXT__|/_nuxt/)",
                "confidence": 99,
            },
            {
                "name": "Angular",
                "category": "Frontend Framework",
                "html_regex": r"(ng-version=|ng-app=|angular\.min\.js)",
                "confidence": 95,
            },
            {
                "name": "Svelte",
                "category": "Frontend Framework",
                "html_regex": r"(svelte-[a-z0-9]{4,8}|__svelte)",
                "confidence": 92,
            },
            {
                "name": "Alpine.js",
                "category": "Frontend Framework",
                "html_regex": r"(x-data=|x-bind=|x-model=|alpine\.min\.js)",
                "confidence": 95,
            },

            # 2. Backend / Server
            {
                "name": "Node.js / Express",
                "category": "Backend",
                "html_regex": r"(connect\.sid|express:sess)",
                "confidence": 88,
            },
            {
                "name": "Django",
                "category": "Backend",
                "html_regex": r"(csrfmiddlewaretoken|csrftoken)",
                "confidence": 92,
            },
            {
                "name": "FastAPI",
                "category": "Backend",
                "html_regex": r"(/docs|/openapi\.json|swagger-ui)",
                "confidence": 85,
            },
            {
                "name": "PHP / Laravel",
                "category": "Backend",
                "html_regex": r"(PHPSESSID|laravel_session|laravel_token)",
                "confidence": 92,
            },
            {
                "name": "ASP.NET",
                "category": "Backend",
                "html_regex": r"(__VIEWSTATE|ASP\.NET_SessionId|\.aspx)",
                "confidence": 96,
            },

            # 3. CMS
            {
                "name": "WordPress",
                "category": "CMS",
                "meta_generator": r"WordPress",
                "html_regex": r"(/wp-content/|/wp-includes/|wp-json)",
                "confidence": 99,
            },
            {
                "name": "Shopify",
                "category": "CMS",
                "html_regex": r"(cdn\.shopify\.com|Shopify\.theme|myshopify\.com)",
                "confidence": 99,
            },
            {
                "name": "WooCommerce",
                "category": "CMS",
                "html_regex": r"(woocommerce|wc-cart|wc-ajax)",
                "confidence": 96,
            },
            {
                "name": "Webflow",
                "category": "CMS",
                "html_regex": r"(data-wf-page|webflow\.js|w-commerce)",
                "confidence": 99,
            },
            {
                "name": "Squarespace",
                "category": "CMS",
                "html_regex": r"(static1\.squarespace\.com|squarespace\.com)",
                "confidence": 98,
            },
            {
                "name": "Wix",
                "category": "CMS",
                "html_regex": r"(parastorage\.com|wix\.com|_wix_)",
                "confidence": 98,
            },

            # 4. Analytics
            {
                "name": "Google Analytics 4",
                "category": "Analytics",
                "script_regex": r"googletagmanager\.com/gtag/js\?id=G-",
                "html_regex": r"gtag\(['\"]config['\"],\s*['\"]G-[A-Z0-9]+",
                "confidence": 99,
            },
            {
                "name": "Google Analytics (Universal)",
                "category": "Analytics",
                "script_regex": r"google-analytics\.com/(analytics|ga)\.js",
                "html_regex": r"UA-[0-9]+-[0-9]+",
                "confidence": 95,
            },
            {
                "name": "Mixpanel",
                "category": "Analytics",
                "script_regex": r"cdn\.mxpnl\.com|mixpanel",
                "confidence": 95,
            },
            {
                "name": "Segment",
                "category": "Analytics",
                "script_regex": r"cdn\.segment\.com/analytics\.js",
                "confidence": 96,
            },
            {
                "name": "Hotjar",
                "category": "Analytics",
                "script_regex": r"static\.hotjar\.com",
                "html_regex": r"_hjSettings",
                "confidence": 98,
            },
            {
                "name": "PostHog",
                "category": "Analytics",
                "script_regex": r"posthog.*\.js",
                "html_regex": r"posthog\.init",
                "confidence": 96,
            },

            # 5. CDN
            {
                "name": "Cloudflare",
                "category": "CDN",
                "html_regex": r"(cdnjs\.cloudflare\.com|challenges\.cloudflare\.com|cloudflare-static)",
                "confidence": 94,
            },
            {
                "name": "AWS CloudFront",
                "category": "CDN",
                "html_regex": r"cloudfront\.net",
                "confidence": 92,
            },
            {
                "name": "Fastly",
                "category": "CDN",
                "html_regex": r"(fastly\.net|fastlycdn)",
                "confidence": 90,
            },

            # 6. Hosting
            {
                "name": "Vercel",
                "category": "Hosting",
                "html_regex": r"(_vercel/insights|vercel\.app)",
                "confidence": 92,
            },
            {
                "name": "Netlify",
                "category": "Hosting",
                "html_regex": r"(netlify\.app|\.netlify/)",
                "confidence": 92,
            },
            {
                "name": "GitHub Pages",
                "category": "Hosting",
                "url_regex": r"github\.io",
                "confidence": 99,
            },

            # 7. Payment
            {
                "name": "Stripe",
                "category": "Payment",
                "script_regex": r"js\.stripe\.com/v3",
                "confidence": 98,
            },
            {
                "name": "PayPal",
                "category": "Payment",
                "script_regex": r"(paypal\.com/sdk|paypalobjects\.com)",
                "confidence": 98,
            },
            {
                "name": "Shopify Pay",
                "category": "Payment",
                "html_regex": r"(shop-pay|shopify-pay)",
                "confidence": 95,
            },
            {
                "name": "Razorpay",
                "category": "Payment",
                "script_regex": r"checkout\.razorpay\.com",
                "confidence": 98,
            },
            {
                "name": "Klarna",
                "category": "Payment",
                "script_regex": r"(klarnacdn\.net|klarna\.com)",
                "confidence": 95,
            },

            # 8. Advertising
            {
                "name": "Google AdSense",
                "category": "Advertising",
                "script_regex": r"pagead2\.googlesyndication\.com",
                "html_regex": r"adsbygoogle",
                "confidence": 99,
            },
            {
                "name": "Facebook Pixel",
                "category": "Advertising",
                "script_regex": r"connect\.facebook\.net/.*/fbevents\.js",
                "html_regex": r"fbq\(['\"]init['\"]",
                "confidence": 98,
            },

            # 9. Tag Manager
            {
                "name": "Google Tag Manager",
                "category": "Tag Manager",
                "script_regex": r"googletagmanager\.com/gtm\.js",
                "html_regex": r"GTM-[A-Z0-9]+",
                "confidence": 99,
            },

            # 10. Javascript Libraries
            {
                "name": "jQuery",
                "category": "Javascript Libraries",
                "script_regex": r"jquery[.-]([0-9.]+|min)\.js",
                "html_regex": r"(window\.jQuery|jquery\.min\.js)",
                "confidence": 95,
            },
            {
                "name": "Lodash",
                "category": "Javascript Libraries",
                "script_regex": r"lodash(\.min)?\.js",
                "confidence": 90,
            },
            {
                "name": "GSAP (GreenSock)",
                "category": "Javascript Libraries",
                "script_regex": r"gsap(\.min)?\.js|TweenMax",
                "confidence": 95,
            },

            # 11. UI Libraries
            {
                "name": "TailwindCSS",
                "category": "UI Libraries",
                "html_regex": r"class=[\"'][^\"']*\b(?:flex|grid|justify-between|items-center|px-[0-9]|py-[0-9]|bg-[a-z]+-[0-9]+)\b[^\"']*[\"']",
                "confidence": 92,
            },
            {
                "name": "Bootstrap",
                "category": "UI Libraries",
                "html_regex": r"(bootstrap\.min\.(css|js)|class=[\"'][^\"']*\b(?:container|row|col-(?:md|lg|sm)-[0-9]|btn-(?:primary|secondary))\b)",
                "confidence": 94,
            },
            {
                "name": "FontAwesome",
                "category": "UI Libraries",
                "html_regex": r"(fontawesome|font-awesome|class=[\"'][^\"']*\bfa[srbld]?\s+fa-)",
                "confidence": 95,
            },
            {
                "name": "Material-UI (MUI)",
                "category": "UI Libraries",
                "html_regex": r"(MuiButton|MuiTypography|MuiBox|MuiGrid)",
                "confidence": 96,
            },
        ]


techstack_service = TechStackService()
