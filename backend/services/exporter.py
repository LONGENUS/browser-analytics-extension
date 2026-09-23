"""
WebIntel — Export Service
Generates CSV and multi-sheet XLSX files from analysis data.
"""

import io
import json
from typing import Any

import pandas as pd


class ExporterService:
    """Generates downloadable CSV and Excel files from analysis results."""

    def to_csv(self, analysis_data: dict) -> io.StringIO:
        """
        Export products to CSV.

        Returns:
            StringIO stream containing CSV data.
        """
        products = analysis_data.get("products", [])
        df = self._products_to_dataframe(products)

        stream = io.StringIO()
        df.to_csv(stream, index=False, encoding="utf-8")
        stream.seek(0)
        return stream

    def to_xlsx(self, analysis_data: dict) -> io.BytesIO:
        """
        Export to multi-sheet Excel workbook.

        Sheets:
        - Products: Raw product data
        - Summary: Key metrics
        - Brands: Brand frequency table
        - SEO: SEO audit results
        - Links: Extracted links

        Returns:
            BytesIO stream containing XLSX data.
        """
        stream = io.BytesIO()
        products = analysis_data.get("products", [])
        analytics = analysis_data.get("analytics", {})
        seo = analysis_data.get("seo", {})

        with pd.ExcelWriter(stream, engine="openpyxl") as writer:
            # Sheet 1: Products
            df_products = self._products_to_dataframe(products)
            df_products.to_excel(writer, sheet_name="Products", index=False)

            # Sheet 2: Summary
            df_summary = self._summary_to_dataframe(analytics, analysis_data)
            df_summary.to_excel(writer, sheet_name="Summary", index=False)

            # Sheet 3: Brands
            df_brands = self._brands_to_dataframe(analytics)
            df_brands.to_excel(writer, sheet_name="Brands", index=False)

            # Sheet 4: SEO
            df_seo = self._seo_to_dataframe(seo)
            df_seo.to_excel(writer, sheet_name="SEO", index=False)

            # Sheet 5: Price Distribution
            df_price_dist = self._price_distribution_to_dataframe(analytics)
            if not df_price_dist.empty:
                df_price_dist.to_excel(writer, sheet_name="Price Distribution", index=False)

        stream.seek(0)
        return stream

    def to_json(self, analysis_data: dict) -> io.BytesIO:
        """
        Export full analysis data to JSON.

        Returns:
            BytesIO stream containing JSON data.
        """
        stream = io.BytesIO()
        json_str = json.dumps(analysis_data, indent=2, ensure_ascii=False, default=str)
        stream.write(json_str.encode("utf-8"))
        stream.seek(0)
        return stream

    # --- DataFrame Builders ---

    def _products_to_dataframe(self, products: list) -> pd.DataFrame:
        """Convert product list to a clean DataFrame."""
        if not products:
            return pd.DataFrame(columns=[
                "Title", "Price", "Rating", "Reviews", "Brand", "URL", "Image URL", "ASIN"
            ])

        rows = []
        for p in products:
            rows.append({
                "Title": p.get("title", ""),
                "Price": p.get("price", ""),
                "Rating": p.get("rating", ""),
                "Reviews": p.get("reviews", ""),
                "Brand": p.get("brand", ""),
                "URL": p.get("url", ""),
                "Image URL": p.get("image_url", ""),
                "ASIN": p.get("asin", ""),
            })

        return pd.DataFrame(rows)

    def _summary_to_dataframe(self, analytics: dict, full_data: dict) -> pd.DataFrame:
        """Create a summary KPI table."""
        rows = [
            {"Metric": "URL", "Value": full_data.get("url", "")},
            {"Metric": "Domain", "Value": full_data.get("domain", "")},
            {"Metric": "Analysis Date", "Value": full_data.get("created_at", "")},
            {"Metric": "", "Value": ""},
            {"Metric": "Total Products", "Value": analytics.get("total_products", 0)},
            {"Metric": "Unique Products", "Value": analytics.get("unique_products", 0)},
            {"Metric": "Duplicates", "Value": analytics.get("duplicates", 0)},
            {"Metric": "", "Value": ""},
            {"Metric": "Average Price", "Value": analytics.get("avg_price", "")},
            {"Metric": "Median Price", "Value": analytics.get("median_price", "")},
            {"Metric": "Min Price", "Value": analytics.get("min_price", "")},
            {"Metric": "Max Price", "Value": analytics.get("max_price", "")},
            {"Metric": "Price Std Dev", "Value": analytics.get("std_price", "")},
            {"Metric": "", "Value": ""},
            {"Metric": "Unique Brands", "Value": analytics.get("unique_brands", 0)},
            {"Metric": "Average Rating", "Value": analytics.get("avg_rating", "")},
            {"Metric": "Products with Price", "Value": analytics.get("products_with_price", 0)},
            {"Metric": "Products with Rating", "Value": analytics.get("products_with_rating", 0)},
            {"Metric": "Products with Brand", "Value": analytics.get("products_with_brand", 0)},
        ]

        # Add AI summary if present
        summary = full_data.get("summary", "")
        if summary:
            rows.append({"Metric": "", "Value": ""})
            rows.append({"Metric": "AI Summary", "Value": summary})

        return pd.DataFrame(rows)

    def _brands_to_dataframe(self, analytics: dict) -> pd.DataFrame:
        """Create brand frequency table."""
        top_brands = analytics.get("top_brands", [])
        if not top_brands:
            return pd.DataFrame(columns=["Brand", "Count", "Percentage"])

        total = sum(b["count"] for b in top_brands)
        rows = []
        for b in top_brands:
            pct = round((b["count"] / total * 100), 1) if total > 0 else 0
            rows.append({
                "Brand": b["name"],
                "Count": b["count"],
                "Percentage": f"{pct}%",
            })

        return pd.DataFrame(rows)

    def _seo_to_dataframe(self, seo: dict) -> pd.DataFrame:
        """Create SEO audit table."""
        rows = [
            {"Check": "Meta Title", "Value": seo.get("meta_title", "—"), "Status": seo.get("title_score", "—")},
            {"Check": "Meta Title Length", "Value": seo.get("meta_title_length", 0), "Status": "Good" if 30 <= seo.get("meta_title_length", 0) <= 60 else "Needs Work"},
            {"Check": "Meta Description", "Value": str(seo.get("meta_description", "—"))[:100], "Status": seo.get("description_score", "—")},
            {"Check": "Meta Description Length", "Value": seo.get("meta_description_length", 0), "Status": "Good" if 70 <= seo.get("meta_description_length", 0) <= 160 else "Needs Work"},
            {"Check": "Total Links", "Value": seo.get("link_count", 0), "Status": "—"},
            {"Check": "Internal Links", "Value": seo.get("internal_links", 0), "Status": "—"},
            {"Check": "External Links", "Value": seo.get("external_links", 0), "Status": "—"},
            {"Check": "Images", "Value": seo.get("image_count", 0), "Status": "—"},
            {"Check": "OG Tags", "Value": "Present" if seo.get("og_tags_present") else "Missing", "Status": "Good" if seo.get("og_tags_present") else "Warning"},
        ]

        return pd.DataFrame(rows)

    def _price_distribution_to_dataframe(self, analytics: dict) -> pd.DataFrame:
        """Create price distribution table."""
        distribution = analytics.get("price_distribution", [])
        if not distribution:
            return pd.DataFrame()

        return pd.DataFrame(distribution)
