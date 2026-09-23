"""
Unit & Integration Tests for Module 1 — Website Overview Engine
"""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.overview import overview_service
from models.overview import OverviewData, OverviewError


def test_marketplace_classification():
    sample = {
        "url": "https://www.amazon.com/dp/B08N5WRWNW",
        "domain": "amazon.com",
        "title": "Apple MacBook Pro (16-inch) - Amazon.com",
        "html": """
        <html>
            <head>
                <link rel="canonical" href="https://www.amazon.com/dp/B08N5WRWNW">
                <link rel="icon" href="/favicon.ico">
                <meta property="og:locale" content="en_US">
            </head>
            <body>
                <h1>Apple MacBook Pro</h1>
                <span class="price">$1,299.00</span>
                <button>Add to Cart</button>
                <div>Ships from Amazon, Sold by Apple</div>
            </body>
        </html>
        """,
        "products": [{"title": "Apple MacBook Pro", "price": 1299.0, "brand": "Apple"}],
        "metadata": {"description": "Buy Apple MacBook Pro online on Amazon"}
    }
    res = overview_service.analyze(sample)
    assert res["pageType"] == "Marketplace"
    assert res["confidence"] >= 0.80
    assert res["industry"] == "Retail & Ecommerce"
    assert res["currency"] == "USD"
    assert res["language"] == "en"
    assert res["favicon"] == "https://www.amazon.com/favicon.ico"
    assert res["canonicalUrl"] == "https://www.amazon.com/dp/B08N5WRWNW"
    print("Marketplace test: PASSED")


def test_saas_classification():
    sample = {
        "url": "https://stripe.com/pricing",
        "domain": "stripe.com",
        "title": "Stripe: Pricing & Fees | Financial Infrastructure",
        "html": """
        <html>
            <head>
                <link rel="canonical" href="https://stripe.com/pricing">
                <link rel="icon" href="https://stripe.com/favicon.ico">
            </head>
            <body>
                <h1>Simple, transparent pricing</h1>
                <p>Start free trial or request demo for platform solutions</p>
                <a href="/login">Sign in</a>
                <button>Get started</button>
            </body>
        </html>
        """,
        "metadata": {"description": "Explore Stripe payment processing pricing, plans and fees."}
    }
    res = overview_service.analyze(sample)
    assert res["pageType"] == "SaaS"
    assert res["confidence"] >= 0.70
    assert res["industry"] == "Finance & Fintech"
    print("SaaS test: PASSED")


def test_documentation_classification():
    sample = {
        "url": "https://fastapi.tiangolo.com/docs/tutorial",
        "domain": "fastapi.tiangolo.com",
        "title": "FastAPI Tutorial - User Guide - Documentation",
        "html": """
        <html>
            <head>
                <link rel="canonical" href="https://fastapi.tiangolo.com/tutorial/">
            </head>
            <body>
                <h1>Quickstart Tutorial</h1>
                <pre><code>pip install fastapi</code></pre>
                <nav>Table of Contents</nav>
            </body>
        </html>
        """,
        "metadata": {"description": "FastAPI framework, high performance, easy to learn, fast to code, ready for production"}
    }
    res = overview_service.analyze(sample)
    assert res["pageType"] == "Documentation"
    assert res["industry"] == "Tech & Software"
    print("Documentation test: PASSED")


def test_export_formats():
    data = {
        "url": "https://example.com",
        "domain": "example.com",
        "title": "Example Page",
        "favicon": "https://example.com/favicon.ico",
        "industry": "General",
        "pageType": "Company",
        "confidence": 0.85,
        "language": "en",
        "currency": "USD",
        "scrapedAt": "2026-09-23T17:00:00Z",
        "statusCode": 200,
        "canonicalUrl": "https://example.com"
    }
    csv_out = overview_service.export(data, "csv")
    assert "URL,Domain,Title" in csv_out
    assert "example.com" in csv_out

    json_out = overview_service.export(data, "json")
    assert '"domain": "example.com"' in json_out
    print("Export formats test: PASSED")


def test_graceful_error_isolation():
    res = overview_service.analyze({})
    assert res["status"] == "failed"
    assert res["module"] == "overview"
    print("Error isolation test: PASSED")


if __name__ == "__main__":
    test_marketplace_classification()
    test_saas_classification()
    test_documentation_classification()
    test_export_formats()
    test_graceful_error_isolation()
    print("\nALL MODULE 1 UNIT TESTS PASSED!")
