"""
WebIntel — Universal Export Engine (Module 6)
Provides unified multi-format export capabilities (CSV, JSON, XLSX) across all
platform modules, including multi-sheet Excel dossier generation.
"""

import csv
import io
import json
from typing import Any, Dict, List, Optional, Union

from services.overview import overview_service
from services.product import product_service
from services.seo import seo_service
from services.techstack import techstack_service
from services.traffic import traffic_service


class UniversalExportService:
    """
    Universal Exporter Interface.
    Supports individual module exports and consolidated multi-sheet all-in-one dossier.
    """

    SUPPORTED_FORMATS = ("csv", "json", "xlsx", "excel")

    def export_module(self, module: str, data: Any, format: str = "json") -> Union[str, bytes]:
        """
        Export an individual module dataset independently.
        """
        mod = (module or "").lower().strip()
        fmt = (format or "json").lower().strip()

        if fmt not in self.SUPPORTED_FORMATS:
            raise ValueError(f"Unsupported format '{format}'. Supported: {', '.join(self.SUPPORTED_FORMATS)}")

        if mod in ("overview", "website_overview"):
            return overview_service.export(data, format=fmt)

        elif mod in ("products", "product", "product_intelligence"):
            items = data.get("products", data) if isinstance(data, dict) else data
            return product_service.export(items, format=fmt)

        elif mod in ("seo", "seo_intelligence"):
            return seo_service.export(data, format=fmt)

        elif mod in ("tech", "techstack", "technologies"):
            return techstack_service.export(data, format=fmt)

        elif mod in ("traffic", "analytics_traffic"):
            return traffic_service.export(data, format=fmt)

        elif mod in ("analytics", "product_analytics"):
            return self._export_generic_dict(data, fmt, sheet_name="Analytics")

        raise ValueError(f"Unknown module '{module}'. Supported: overview, products, seo, tech, traffic, analytics, all.")

    def export_all(self, dossier: Dict[str, Any], format: str = "json") -> Union[str, bytes]:
        """
        Export complete intelligence dossier across all modules.
        - JSON: Complete structured JSON.
        - XLSX: Multi-sheet Excel workbook (Overview, Products, SEO, Tech Stack, Traffic).
        - CSV: Multi-section unified tabular report.
        """
        fmt = (format or "json").lower().strip()

        if fmt == "json":
            return json.dumps(dossier, indent=2, ensure_ascii=False)

        elif fmt in ("xlsx", "excel"):
            return self._build_multisheet_excel(dossier)

        elif fmt == "csv":
            return self._build_consolidated_csv(dossier)

        raise ValueError(f"Unsupported format '{format}'. Supported: json, csv, xlsx.")

    # --- Builders ---

    def _build_multisheet_excel(self, dossier: Dict[str, Any]) -> bytes:
        """Create a multi-tab Excel workbook containing each module on its own sheet."""
        import pandas as pd
        stream = io.BytesIO()

        with pd.ExcelWriter(stream, engine="openpyxl") as writer:
            # 1. Sheet: Overview
            ov_data = dossier.get("overview") or {}
            ov_rows = [{"Field": k, "Value": str(v)} for k, v in ov_data.items() if not isinstance(v, (dict, list))]
            pd.DataFrame(ov_rows or [{"Status": "No Overview Data"}]).to_excel(writer, sheet_name="Overview", index=False)

            # 2. Sheet: Products
            prods = dossier.get("products") or []
            if isinstance(prods, list) and prods:
                clean_prods = []
                for p in prods:
                    if isinstance(p, dict):
                        clean_prods.append({
                            "Position": p.get("position", ""),
                            "Product Name": p.get("product_name") or p.get("title", ""),
                            "Brand": p.get("brand", ""),
                            "Price": p.get("price", ""),
                            "Original Price": p.get("original_price", ""),
                            "Discount %": p.get("discount_percent", 0.0),
                            "Rating": p.get("rating", ""),
                            "Reviews": p.get("review_count") or p.get("reviews", ""),
                            "ASIN / SKU": p.get("asin_sku") or p.get("asin", ""),
                            "Availability": p.get("availability", ""),
                            "Shipping": p.get("prime_shipping") or p.get("shipping", ""),
                            "URL": p.get("product_url") or p.get("url", ""),
                        })
                pd.DataFrame(clean_prods).to_excel(writer, sheet_name="Products", index=False)
            else:
                pd.DataFrame([{"Message": "No products extracted"}]).to_excel(writer, sheet_name="Products", index=False)

            # 3. Sheet: SEO Audit
            seo_data = dossier.get("seo_intelligence") or dossier.get("seo") or {}
            seo_score = seo_data.get("seo_score", {})
            seo_meta = seo_data.get("metadata", {})
            seo_rows = [
                {"Metric": "Overall Score", "Value": f"{seo_score.get('score', 0)}/100 ({seo_score.get('rating', '')})"},
                {"Metric": "Title", "Value": seo_meta.get("title", "")},
                {"Metric": "Description", "Value": seo_meta.get("description", "")},
                {"Metric": "Canonical", "Value": seo_meta.get("canonical", "")},
                {"Metric": "Robots", "Value": seo_meta.get("robots", "")},
            ]
            pd.DataFrame(seo_rows).to_excel(writer, sheet_name="SEO Audit", index=False)

            # 4. Sheet: Tech Stack
            tech_data = dossier.get("tech_stack") or {}
            techs = tech_data.get("technologies", [])
            tech_rows = [
                {"Technology": t.get("name"), "Category": t.get("category"), "Confidence": f"{t.get('confidence')}%"}
                for t in techs
            ] if techs else [{"Message": "No technologies detected"}]
            pd.DataFrame(tech_rows).to_excel(writer, sheet_name="Tech Stack", index=False)

            # 5. Sheet: Traffic
            traffic_data = dossier.get("traffic") or {}
            t_metrics = traffic_data.get("metrics", {})
            traffic_rows = [
                {"Metric": "Source", "Value": traffic_data.get("source", "Unavailable")},
                {"Metric": "Monthly Visits", "Value": str(t_metrics.get("monthlyVisits", "Unavailable"))},
                {"Metric": "Avg Duration", "Value": str(t_metrics.get("avgVisitDuration", "Unavailable"))},
                {"Metric": "Bounce Rate", "Value": str(t_metrics.get("bounceRate", "Unavailable"))},
            ]
            pd.DataFrame(traffic_rows).to_excel(writer, sheet_name="Traffic", index=False)

        stream.seek(0)
        return stream.getvalue()

    def _build_consolidated_csv(self, dossier: Dict[str, Any]) -> str:
        """Create a multi-section CSV report string."""
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow(["=== WEBINTEL CONSOLIDATED INTELLIGENCE REPORT ==="])
        writer.writerow(["URL", dossier.get("url", "")])
        writer.writerow(["Domain", dossier.get("domain", "")])
        writer.writerow([])

        # Overview
        writer.writerow(["--- 1. WEBSITE OVERVIEW ---"])
        ov = dossier.get("overview") or {}
        for k, v in ov.items():
            if not isinstance(v, (dict, list)):
                writer.writerow([k, str(v)])
        writer.writerow([])

        # SEO
        writer.writerow(["--- 2. SEO AUDIT ---"])
        seo = dossier.get("seo_intelligence") or {}
        score = seo.get("seo_score", {})
        writer.writerow(["SEO Score", f"{score.get('score', 0)}/100 ({score.get('rating', '')})"])
        writer.writerow([])

        # Tech Stack
        writer.writerow(["--- 3. TECH STACK ---"])
        writer.writerow(["Technology", "Category", "Confidence"])
        for t in (dossier.get("tech_stack", {}).get("technologies", [])):
            writer.writerow([t.get("name"), t.get("category"), f"{t.get('confidence')}%"])
        writer.writerow([])

        # Products count
        prods = dossier.get("products") or []
        writer.writerow(["--- 4. PRODUCTS EXTRACTED ---", f"Total: {len(prods)}"])
        if prods:
            writer.writerow(["Product Name", "Brand", "Price", "Original Price", "Discount %", "Rating"])
            for p in prods[:50]:
                writer.writerow([
                    p.get("product_name") or p.get("title", ""),
                    p.get("brand", ""),
                    p.get("price", ""),
                    p.get("original_price", ""),
                    p.get("discount_percent", 0.0),
                    p.get("rating", "")
                ])

        return output.getvalue()

    def _export_generic_dict(self, data: dict, format: str, sheet_name: str = "Sheet1") -> Union[str, bytes]:
        rows = [{"Key": k, "Value": str(v)} for k, v in data.items() if not isinstance(v, (dict, list))]
        if format == "csv":
            out = io.StringIO()
            w = csv.DictWriter(out, fieldnames=["Key", "Value"])
            w.writeheader()
            w.writerows(rows)
            return out.getvalue()
        elif format in ("xlsx", "excel"):
            import pandas as pd
            s = io.BytesIO()
            pd.DataFrame(rows).to_excel(s, sheet_name=sheet_name, index=False)
            s.seek(0)
            return s.getvalue()
        return json.dumps(data, indent=2)


universal_export_service = UniversalExportService()
