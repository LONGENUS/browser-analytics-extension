"""
Full Suite Integration Tests for All WebIntel Modules (1 to 6)
"""

import sys
import os
import io
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from app import app

client = TestClient(app)


def test_all_schemas():
    """Verify JSON schema endpoints for all 5 intelligence modules."""
    modules = ["overview", "products", "seo", "tech", "traffic"]
    for mod in modules:
        resp = client.get(f"/{mod}/schema")
        assert resp.status_code == 200, f"Schema for {mod} failed with {resp.status_code}"
        schema = resp.json()
        assert "properties" in schema or "title" in schema
        print(f"GET /{mod}/schema: PASSED")


def test_all_module_exports():
    """Verify independent exports across all modules."""
    # 1. Overview Export
    resp_ov = client.post("/overview/export", json={
        "data": {"url": "https://example.com", "domain": "example.com", "title": "Ex"},
        "format": "csv"
    })
    assert resp_ov.status_code == 200
    assert "example.com" in resp_ov.text
    print("POST /overview/export: PASSED")

    # 2. Products Export
    resp_prod = client.post("/products/export", json={
        "products": [{"product_name": "P1", "brand": "B1", "price": 9.99, "position": 1}],
        "format": "csv"
    })
    assert resp_prod.status_code == 200
    assert "P1" in resp_prod.text
    print("POST /products/export: PASSED")

    # 3. SEO Export
    resp_seo = client.post("/seo/export", json={
        "data": {
            "seo_score": {"score": 85, "rating": "Good"},
            "metadata": {"title": "Title", "canonical": "https://example.com"}
        },
        "format": "csv"
    })
    assert resp_seo.status_code == 200
    assert "SEO Score" in resp_seo.text
    print("POST /seo/export: PASSED")

    # 4. Tech Export
    resp_tech = client.post("/tech/export", json={
        "data": {"technologies": [{"name": "React", "category": "Frontend Framework", "confidence": 98}]},
        "format": "csv"
    })
    assert resp_tech.status_code == 200
    assert "React" in resp_tech.text
    print("POST /tech/export: PASSED")

    # 5. Traffic Export
    resp_traf = client.post("/traffic/export", json={
        "data": {"domain": "example.com", "source": "Unavailable", "status": "unmetered"},
        "format": "csv"
    })
    assert resp_traf.status_code == 200
    assert "Unavailable" in resp_traf.text
    print("POST /traffic/export: PASSED")


def test_universal_export_all_endpoint():
    """Verify POST /export/all and POST /export/module endpoints."""
    dossier = {
        "url": "https://example.com",
        "domain": "example.com",
        "overview": {"pageType": "Company", "industry": "Tech"},
        "products": [{"product_name": "Item 1", "price": 15.0, "position": 1}],
        "seo_intelligence": {"seo_score": {"score": 90, "rating": "Excellent"}},
        "tech_stack": {"technologies": [{"name": "Vue.js", "category": "Frontend Framework", "confidence": 95}]},
        "traffic": {"source": "Unavailable"}
    }

    # 1. Multi-sheet Excel
    resp_xlsx = client.post("/export/all", json={"dossier": dossier, "format": "xlsx"})
    assert resp_xlsx.status_code == 200
    assert len(resp_xlsx.content) > 1000
    assert "spreadsheetml" in resp_xlsx.headers["content-type"]
    print("POST /export/all (xlsx): PASSED")

    # 2. Consolidated CSV
    resp_csv = client.post("/export/all", json={"dossier": dossier, "format": "csv"})
    assert resp_csv.status_code == 200
    assert "WEBINTEL CONSOLIDATED INTELLIGENCE REPORT" in resp_csv.text
    print("POST /export/all (csv): PASSED")

    # 3. JSON
    resp_json = client.post("/export/all", json={"dossier": dossier, "format": "json"})
    assert resp_json.status_code == 200
    assert resp_json.json()["domain"] == "example.com"
    print("POST /export/all (json): PASSED")

    # 4. Single Module via /export/module
    resp_mod = client.post("/export/module", json={
        "module": "tech",
        "data": {"technologies": [{"name": "Next.js", "category": "Frontend Framework", "confidence": 99}]},
        "format": "csv"
    })
    assert resp_mod.status_code == 200
    assert "Next.js" in resp_mod.text
    print("POST /export/module (csv): PASSED")


if __name__ == "__main__":
    test_all_schemas()
    test_all_module_exports()
    test_universal_export_all_endpoint()
    print("\n=============================================")
    print("ALL MODULES 1-6 INTEGRATION TESTS PASSED 100%!")
    print("=============================================")
