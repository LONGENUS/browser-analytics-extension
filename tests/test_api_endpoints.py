"""
FastAPI Route & Endpoint Integration Tests for Module 2
"""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from app import app

client = TestClient(app)

def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    print("GET /health: PASSED")

def test_products_schema():
    resp = client.get("/products/schema")
    assert resp.status_code == 200
    schema = resp.json()
    assert "properties" in schema
    assert "products" in schema["properties"]
    assert "analytics" in schema["properties"]
    assert "pagination" in schema["properties"]
    print("GET /products/schema: PASSED")

def test_products_export():
    sample_products = [
        {
            "product_name": "Test Wireless Mouse",
            "brand": "Logitech",
            "price": 29.99,
            "original_price": 39.99,
            "discount_percent": 25.0,
            "rating": 4.7,
            "review_count": 1250,
            "asin_sku": "B071YZJ123",
            "availability": "In Stock",
            "prime_shipping": "Prime",
            "image_url": "https://example.com/mouse.jpg",
            "product_url": "https://example.com/mouse",
            "position": 1
        }
    ]

    # JSON export
    resp_json = client.post("/products/export", json={"products": sample_products, "format": "json"})
    assert resp_json.status_code == 200
    assert resp_json.json()[0]["product_name"] == "Test Wireless Mouse"

    # CSV export
    resp_csv = client.post("/products/export", json={"products": sample_products, "format": "csv"})
    assert resp_csv.status_code == 200
    assert "text/csv" in resp_csv.headers["content-type"]
    assert "Product Name" in resp_csv.text

    # XLSX export
    resp_xlsx = client.post("/products/export", json={"products": sample_products, "format": "xlsx"})
    assert resp_xlsx.status_code == 200
    assert len(resp_xlsx.content) > 0

    print("POST /products/export (JSON, CSV, XLSX): PASSED")

def test_overview_endpoints():
    resp = client.get("/overview/schema")
    assert resp.status_code == 200
    print("GET /overview/schema: PASSED")

if __name__ == "__main__":
    test_health()
    test_products_schema()
    test_products_export()
    test_overview_endpoints()
    print("\nALL FASTAPI INTEGRATION TESTS PASSED!")
