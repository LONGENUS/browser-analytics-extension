"""
Unit & Integration Tests for Module 5 — Website Traffic Analytics
"""

import sys
import os
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.traffic import traffic_service
from models.traffic import TrafficResponse


def test_traffic_unavailable_fallback():
    crawl_result = {
        "url": "https://example.com",
        "domain": "example.com"
    }

    result = traffic_service.analyze(crawl_result)
    assert result["domain"] == "example.com"
    assert result["source"] == "Unavailable"
    assert result["status"] == "unmetered"
    assert result["metrics"]["monthlyVisits"] is None
    assert "Unavailable" in result["note"]
    print("Traffic 'Unavailable' honest fallback test: PASSED")


def test_traffic_with_provider_data():
    crawl_result = {
        "url": "https://stripe.com",
        "domain": "stripe.com"
    }
    provider_data = {
        "source": "Similarweb API",
        "monthlyVisits": 32000000,
        "avgVisitDuration": "04:12",
        "pagesPerVisit": 4.8,
        "bounceRate": 34.2,
        "topCountries": [
            {"country": "United States", "code": "US", "share": 48.5},
            {"country": "United Kingdom", "code": "GB", "share": 8.2}
        ],
        "trafficChannels": {
            "direct": 52.0,
            "search": 34.0,
            "social": 4.0,
            "referral": 8.0,
            "mail": 2.0
        },
        "topReferrers": ["github.com", "ycombinator.com"]
    }

    result = traffic_service.analyze(crawl_result, provider_data=provider_data)
    assert result["domain"] == "stripe.com"
    assert result["source"] == "Similarweb API"
    assert result["status"] == "available"
    assert result["metrics"]["monthlyVisits"] == 32000000
    assert result["metrics"]["bounceRate"] == 34.2
    assert len(result["topCountries"]) == 2
    assert result["trafficChannels"]["direct"] == 52.0

    print("Traffic with connected provider data test: PASSED")


def test_traffic_export_formats():
    data = {
        "domain": "example.com",
        "source": "Unavailable",
        "status": "unmetered",
        "metrics": {"monthlyVisits": None, "bounceRate": None},
        "topReferrers": []
    }

    # CSV
    csv_out = traffic_service.export(data, "csv")
    assert "Metric,Value" in csv_out
    assert "Domain,example.com" in csv_out
    assert "Data Source,Unavailable" in csv_out

    # JSON
    json_out = traffic_service.export(data, "json")
    assert '"source": "Unavailable"' in json_out

    # XLSX
    xlsx_out = traffic_service.export(data, "xlsx")
    assert isinstance(xlsx_out, (bytes, bytearray))
    assert len(xlsx_out) > 0

    print("Traffic Export formats test: PASSED")


def test_traffic_error_isolation():
    err = traffic_service.analyze(None)
    assert err["status"] == "failed"
    assert err["module"] == "traffic"
    print("Traffic Error isolation test: PASSED")


if __name__ == "__main__":
    test_traffic_unavailable_fallback()
    test_traffic_with_provider_data()
    test_traffic_export_formats()
    test_traffic_error_isolation()
    print("\nALL MODULE 5 WEBSITE TRAFFIC TESTS PASSED!")
