"""
Unit & Integration Tests for Module 3 — SEO Intelligence
"""

import sys
import os
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.seo import seo_service
from models.seo import SeoIntelligenceResponse, SeoScore


def test_complete_seo_analysis():
    sample_html = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Best Noise Cancelling Headphones of 2026 - AudioTech</title>
        <meta name="description" content="Discover the best wireless noise cancelling headphones of 2026. Detailed comparisons, audio fidelity analysis, and battery benchmark reviews.">
        <link rel="canonical" href="https://audiotech.example.com/best-headphones">
        <meta name="robots" content="index, follow">
        <script type="application/ld+json">
        {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "AudioTech Pro 500",
            "description": "Premium wireless headphones"
        }
        </script>
    </head>
    <body>
        <h1>Top Noise Cancelling Headphones 2026</h1>
        <p>Introduction to the best headphones...</p>
        
        <h2>Sony WH-1000XM5</h2>
        <img src="https://audiotech.example.com/images/sony-xm5.webp" alt="Sony WH-1000XM5 wireless headphones on desk">
        <a href="https://audiotech.example.com/reviews/sony-xm5">Read Sony Review</a>
        
        <h2>Bose QuietComfort Ultra</h2>
        <img src="https://audiotech.example.com/images/bose-ultra.png" alt="Bose QuietComfort Ultra black edition">
        <a href="https://bose.com/ultra" rel="nofollow">Buy on Bose</a>
        
        <h3>Battery Life Comparison</h3>
        <img src="https://audiotech.example.com/images/battery-chart.jpg"> <!-- Missing ALT -->
        
        <footer>
            <a href="https://audiotech.example.com/privacy">Privacy Policy</a>
        </footer>
    </body>
    </html>
    """

    crawl_result = {
        "url": "https://audiotech.example.com/best-headphones",
        "domain": "audiotech.example.com",
        "html": sample_html,
        "title": "Best Noise Cancelling Headphones of 2026 - AudioTech",
        "links": ["https://audiotech.example.com/reviews/sony-xm5", "https://bose.com/ultra"],
        "images": ["https://audiotech.example.com/images/sony-xm5.webp"],
        "metadata": {
            "title": "Best Noise Cancelling Headphones of 2026 - AudioTech",
            "description": "Discover the best wireless noise cancelling headphones of 2026.",
        }
    }

    result = seo_service.analyze(crawl_result)
    assert result["domain"] == "audiotech.example.com"

    # 1. Metadata check
    meta = result["metadata"]
    assert "Best Noise Cancelling Headphones" in meta["title"]
    assert 30 <= meta["title_length"] <= 65
    assert meta["canonical"] == "https://audiotech.example.com/best-headphones"
    assert "index, follow" in meta["robots"]
    assert meta["viewport"] != ""

    # 2. Headings audit
    head = result["headings"]
    assert head["h1_count"] == 1
    assert head["h2_count"] == 2
    assert head["h3_count"] == 1
    assert head["h1_tags"][0] == "Top Noise Cancelling Headphones 2026"
    assert len(head["hierarchy_issues"]) == 0  # Perfect hierarchy H1 -> H2 -> H3

    # 3. Images audit
    imgs = result["images"]
    assert imgs["total_images"] == 3
    assert imgs["missing_alt_count"] == 1  # battery-chart.jpg
    assert imgs["alt_coverage_percent"] == 66.7
    assert "webp" in imgs["format_breakdown"]
    assert "png" in imgs["format_breakdown"]
    assert "jpg" in imgs["format_breakdown"]

    # 4. Links audit
    links = result["links"]
    assert links["internal_links_count"] >= 2
    assert links["external_links_count"] >= 1
    assert links["nofollow_count"] == 1  # rel="nofollow" on bose.com

    # 5. Structured Data
    sdata = result["structured_data"]
    assert sdata["has_json_ld"] is True
    assert sdata["has_product_schema"] is True
    assert "Product" in sdata["detected_types"]

    # 6. SEO Score
    score = result["seo_score"]
    assert 80 <= score["score"] <= 100
    assert score["rating"] in ("Good", "Excellent")
    assert "title" in score["breakdown"]
    assert "headings" in score["breakdown"]
    assert "images" in score["breakdown"]

    print("Complete SEO Analysis test: PASSED")


def test_seo_exports():
    data = {
        "seo_score": {"score": 88, "rating": "Good"},
        "metadata": {"title": "Test Page", "title_length": 9, "description": "Desc", "canonical": "https://example.com", "robots": "index"},
        "headings": {"h1_count": 1, "h2_count": 2, "h3_count": 0},
        "images": {"total_images": 2, "missing_alt_count": 0, "alt_coverage_percent": 100.0},
        "links": {"total_links": 5, "internal_links_count": 4, "external_links_count": 1},
        "structured_data": {"has_json_ld": True, "detected_types": ["Organization"]}
    }

    # CSV
    csv_out = seo_service.export(data, "csv")
    assert "Category,Metric,Value" in csv_out
    assert "SEO Score" in csv_out
    assert "88/100" in csv_out

    # JSON
    json_out = seo_service.export(data, "json")
    assert '"score": 88' in json_out

    # XLSX
    xlsx_out = seo_service.export(data, "xlsx")
    assert isinstance(xlsx_out, (bytes, bytearray))
    assert len(xlsx_out) > 0

    print("SEO Export formats test: PASSED")


def test_seo_error_isolation():
    err = seo_service.analyze(None)
    assert err["status"] == "failed"
    assert err["module"] == "seo"
    print("SEO Error isolation test: PASSED")


if __name__ == "__main__":
    test_complete_seo_analysis()
    test_seo_exports()
    test_seo_error_isolation()
    print("\nALL MODULE 3 SEO INTELLIGENCE TESTS PASSED!")
