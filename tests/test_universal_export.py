"""
Unit & Integration Tests for Module 6 — Universal Export Engine
"""

import sys
import os
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.universal_export import universal_export_service


def test_independent_module_exports():
    # 1. Overview
    overview_sample = {"url": "https://example.com", "domain": "example.com", "title": "Example Page"}
    csv_ov = universal_export_service.export_module("overview", overview_sample, "csv")
    assert "example.com" in csv_ov

    # 2. Products
    products_sample = [
        {"product_name": "Widget A", "brand": "BrandX", "price": 19.99, "position": 1}
    ]
    csv_prod = universal_export_service.export_module("products", products_sample, "csv")
    assert "Widget A" in csv_prod
    assert "BrandX" in csv_prod

    # 3. SEO
    seo_sample = {
        "seo_score": {"score": 90, "rating": "Excellent"},
        "metadata": {"title": "Test Title", "canonical": "https://example.com"}
    }
    csv_seo = universal_export_service.export_module("seo", seo_sample, "csv")
    assert "90/100" in csv_seo

    # 4. Tech
    tech_sample = {
        "technologies": [{"name": "React", "category": "Frontend Framework", "confidence": 99}]
    }
    csv_tech = universal_export_service.export_module("tech", tech_sample, "csv")
    assert "React" in csv_tech

    # 5. Traffic
    traffic_sample = {
        "domain": "example.com",
        "source": "Unavailable",
        "status": "unmetered"
    }
    csv_traf = universal_export_service.export_module("traffic", traffic_sample, "csv")
    assert "Unavailable" in csv_traf

    print("Independent module exports test: PASSED")


def test_export_all_multisheet_excel():
    dossier = {
        "url": "https://store.example.com",
        "domain": "store.example.com",
        "overview": {
            "pageType": "Ecommerce",
            "industry": "Retail & Ecommerce",
            "confidence": 0.95
        },
        "products": [
            {
                "product_name": "Premium Keyboard",
                "brand": "Keychron",
                "price": 89.99,
                "original_price": 99.99,
                "discount_percent": 10.0,
                "rating": 4.8,
                "review_count": 210,
                "asin_sku": "KEY-V1",
                "availability": "In Stock",
                "prime_shipping": "Prime",
                "position": 1
            }
        ],
        "seo_intelligence": {
            "seo_score": {"score": 92, "rating": "Excellent"},
            "metadata": {"title": "Keyboards Store", "description": "Best mechanical keyboards."}
        },
        "tech_stack": {
            "technologies": [
                {"name": "Shopify", "category": "CMS", "confidence": 99},
                {"name": "React", "category": "Frontend Framework", "confidence": 95}
            ]
        },
        "traffic": {
            "source": "Unavailable",
            "metrics": {"monthlyVisits": None}
        }
    }

    # 1. Test Excel
    excel_bytes = universal_export_service.export_all(dossier, format="xlsx")
    assert isinstance(excel_bytes, (bytes, bytearray))
    assert len(excel_bytes) > 1000

    # Read back sheets with pandas/openpyxl
    import pandas as pd
    import io
    excel_file = pd.ExcelFile(io.BytesIO(excel_bytes))
    sheet_names = excel_file.sheet_names
    assert "Overview" in sheet_names
    assert "Products" in sheet_names
    assert "SEO Audit" in sheet_names
    assert "Tech Stack" in sheet_names
    assert "Traffic" in sheet_names

    df_prods = pd.read_excel(excel_file, sheet_name="Products")
    assert "Premium Keyboard" in df_prods["Product Name"].values

    # 2. Test Consolidated CSV
    csv_consolidated = universal_export_service.export_all(dossier, format="csv")
    assert "WEBINTEL CONSOLIDATED INTELLIGENCE REPORT" in csv_consolidated
    assert "store.example.com" in csv_consolidated
    assert "Premium Keyboard" in csv_consolidated

    # 3. Test JSON
    json_all = universal_export_service.export_all(dossier, format="json")
    parsed = json.loads(json_all)
    assert parsed["domain"] == "store.example.com"

    print("Universal Dossier Export (Multi-sheet Excel, CSV, JSON): PASSED")


if __name__ == "__main__":
    test_independent_module_exports()
    test_export_all_multisheet_excel()
    print("\nALL MODULE 6 UNIVERSAL EXPORT TESTS PASSED!")
