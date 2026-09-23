"""
Unit & Integration Tests for Module 4 — Technology Detection
"""

import sys
import os
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.techstack import techstack_service
from models.tech import TechStackResponse


def test_tech_detection_multi_category():
    sample_html = """
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="generator" content="WordPress 6.4.2">
        <link rel="stylesheet" href="https://example.com/wp-content/themes/store/style.css">
        <script src="https://www.googletagmanager.com/gtag/js?id=G-ABC1234567"></script>
        <script>
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('config', 'G-ABC1234567');
        </script>
        <script src="https://js.stripe.com/v3/"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js"></script>
    </head>
    <body class="bg-gray-100 flex items-center justify-between px-4 py-2">
        <div id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{}}}</div>
        <div class="woocommerce">
            <h1>Ecommerce Store</h1>
        </div>
    </body>
    </html>
    """

    crawl_result = {
        "url": "https://example.com/shop",
        "domain": "example.com",
        "html": sample_html
    }

    result = techstack_service.analyze(crawl_result)
    assert result["domain"] == "example.com"
    techs = {t["name"]: t for t in result["technologies"]}

    # Verify detection across various categories:
    assert "WordPress" in techs
    assert techs["WordPress"]["category"] == "CMS"
    assert techs["WordPress"]["confidence"] >= 95

    assert "Google Analytics 4" in techs
    assert techs["Google Analytics 4"]["category"] == "Analytics"

    assert "Next.js" in techs
    assert techs["Next.js"]["category"] == "Frontend Framework"

    assert "Stripe" in techs
    assert techs["Stripe"]["category"] == "Payment"

    assert "jQuery" in techs
    assert techs["jQuery"]["category"] == "Javascript Libraries"

    assert "TailwindCSS" in techs
    assert techs["TailwindCSS"]["category"] == "UI Libraries"

    print("Multi-category Technology Detection test: PASSED")


def test_tech_export_formats():
    data = {
        "technologies": [
            {"name": "React", "category": "Frontend Framework", "confidence": 98, "version": None},
            {"name": "Stripe", "category": "Payment", "confidence": 95, "version": "v3"}
        ]
    }

    # CSV
    csv_out = techstack_service.export(data, "csv")
    assert "Technology,Category,Confidence,Version" in csv_out
    assert "React" in csv_out
    assert "Stripe" in csv_out

    # JSON
    json_out = techstack_service.export(data, "json")
    assert '"name": "React"' in json_out

    # XLSX
    xlsx_out = techstack_service.export(data, "xlsx")
    assert isinstance(xlsx_out, (bytes, bytearray))
    assert len(xlsx_out) > 0

    print("Tech Stack Export formats test: PASSED")


def test_tech_error_isolation():
    err = techstack_service.analyze(None)
    assert err["status"] == "failed"
    assert err["module"] == "techstack"
    print("Tech Stack Error isolation test: PASSED")


if __name__ == "__main__":
    test_tech_detection_multi_category()
    test_tech_export_formats()
    test_tech_error_isolation()
    print("\nALL MODULE 4 TECHNOLOGY DETECTION TESTS PASSED!")
