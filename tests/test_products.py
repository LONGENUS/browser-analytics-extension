"""
Unit & Integration Tests for Module 2 — Product Intelligence
"""

import sys
import os
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.product import product_service
from models.product import ProductItem, ProductAnalytics, ProductIntelligenceResponse


def test_product_normalization_13_fields():
    raw_products = [
        {
            "title": "Sony WH-1000XM5 Noise Cancelling Headphones",
            "price": "$348.00",
            "mrp": "$399.99",
            "rating": "4.6 out of 5",
            "reviews": "8,940 ratings",
            "asin": "B09XS7JWHH",
            "brand": "Sony",
            "url": "https://www.amazon.com/dp/B09XS7JWHH",
            "image": "https://m.media-amazon.com/images/I/61+elLGNVqL._AC_SX679_.jpg",
            "shipping": "Prime Free One-Day"
        },
        {
            "product_name": "Bose QuietComfort 45",
            "price": 279.00,
            "original_price": 329.00,
            "discount_percent": 15.2,
            "rating": 4.5,
            "review_count": 5200,
            "sku": "BOSE-QC45-BLK",
            "brand": "Bose",
            "url": "https://example.com/bose-qc45",
            "image_url": "https://example.com/qc45.jpg",
            "availability": "Only 3 left",
            "prime_shipping": "Standard"
        }
    ]

    normalized = product_service.normalize(raw_products, domain="amazon.com")
    assert len(normalized) == 2

    # Check Product 1
    p1 = normalized[0]
    # Check all 13 standard fields
    assert p1["product_name"] == "Sony WH-1000XM5 Noise Cancelling Headphones"
    assert p1["brand"] == "Sony"
    assert p1["price"] == 348.00
    assert p1["original_price"] == 399.99
    assert p1["discount_percent"] == 13.0
    assert p1["rating"] == 4.6
    assert p1["review_count"] == 8940
    assert p1["asin_sku"] == "B09XS7JWHH"
    assert p1["availability"] == "In Stock"
    assert p1["prime_shipping"] == "Prime Free One-Day"
    assert "https://m.media-amazon.com" in p1["image_url"]
    assert "https://www.amazon.com/dp/B09XS7JWHH" in p1["product_url"]
    assert p1["position"] == 1

    # Check backward compatibility aliases
    assert p1["title"] == p1["product_name"]
    assert p1["asin"] == p1["asin_sku"]
    assert p1["image"] == p1["image_url"]
    assert p1["url"] == p1["product_url"]
    assert p1["shipping"] == p1["prime_shipping"]
    assert p1["reviews_count"] == 8940

    # Check Product 2
    p2 = normalized[1]
    assert p2["product_name"] == "Bose QuietComfort 45"
    assert p2["brand"] == "Bose"
    assert p2["price"] == 279.00
    assert p2["position"] == 2
    assert p2["discount_percent"] == 15.2
    assert p2["availability"] == "Only 3 left"
    print("Product normalization (13 attributes + aliases): PASSED")


def test_product_analytics_and_duplicates():
    raw_products = [
        {"title": "Echo Dot 5th Gen", "price": 49.99, "original_price": 49.99, "asin": "B09B8V1LZ3", "brand": "Amazon"},
        {"title": "Echo Dot 5th Gen", "price": 49.99, "original_price": 49.99, "asin": "B09B8V1LZ3", "brand": "Amazon"},  # Duplicate title & asin
        {"title": "Echo Show 8", "price": 99.99, "original_price": 149.99, "asin": "B0BL65B82W", "brand": "Amazon"},      # 33.3% discount
        {"title": "Fire TV Stick 4K", "price": 29.99, "original_price": 49.99, "asin": "B0BP9MDCQZ", "brand": "Amazon"},   # 40% discount
        {"title": "Kindle Paperwhite", "price": 139.99, "original_price": 149.99, "asin": "B08KTZ8249", "brand": "Amazon"} # 6.7% discount
    ]

    crawl_result = {
        "url": "https://www.amazon.com/devices",
        "domain": "amazon.com",
        "products": raw_products
    }

    result = product_service.analyze(crawl_result, page=1, page_size=2)
    assert result["domain"] == "amazon.com"
    analytics = result["analytics"]

    # Deduplication
    assert analytics["total_products"] == 5
    assert analytics["unique_products"] == 4
    assert analytics["duplicate_products"] == 1
    assert analytics["duplicate_asins"] == 1

    # Price stats
    assert analytics["lowest_price"] == 29.99
    assert analytics["highest_price"] == 139.99
    assert analytics["average_price"] is not None
    assert analytics["median_price"] is not None

    # Discount Distribution buckets
    dist = analytics["discount_distribution"]
    assert "0%" in dist
    assert "1-10%" in dist
    assert "26-50%" in dist
    assert dist["0%"] == 2        # 2 Echo Dots (0% discount)
    assert dist["1-10%"] == 1     # Kindle (6.7%)
    assert dist["26-50%"] == 2    # Echo Show (33.3%) & Fire TV (40%)

    # Pagination
    pagination = result["pagination"]
    assert pagination["page"] == 1
    assert pagination["pageSize"] == 2
    assert pagination["total"] == 5
    assert pagination["totalPages"] == 3
    assert len(result["products"]) == 2
    assert result["products"][0]["position"] == 1
    assert result["products"][1]["position"] == 2

    print("Product analytics & duplicate detection: PASSED")


def test_product_export_formats():
    products = [
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

    # 1. JSON
    json_export = product_service.export(products, format="json")
    parsed_json = json.loads(json_export)
    assert len(parsed_json) == 1
    assert parsed_json[0]["product_name"] == "Test Wireless Mouse"

    # 2. CSV
    csv_export = product_service.export(products, format="csv")
    assert "Product Name" in csv_export
    assert "Test Wireless Mouse" in csv_export
    assert "Logitech" in csv_export
    assert "$29.99" in csv_export

    # 3. XLSX
    xlsx_export = product_service.export(products, format="xlsx")
    assert isinstance(xlsx_export, (bytes, bytearray))
    assert len(xlsx_export) > 0

    print("Multi-format export (JSON, CSV, XLSX): PASSED")


def test_validation():
    valid = {
        "title": "Good Product",
        "brand": "BrandX",
        "price": 10.0,
        "position": 1
    }
    assert product_service.validate(valid) is True

    invalid = {
        "price": "not-a-number-and-no-title"
    }
    assert product_service.validate(invalid) is False
    print("Product validation: PASSED")


def test_graceful_error_isolation():
    res = product_service.analyze(None)
    assert res["status"] == "failed"
    assert res["module"] == "products"
    print("Graceful error isolation: PASSED")


if __name__ == "__main__":
    test_product_normalization_13_fields()
    test_product_analytics_and_duplicates()
    test_product_export_formats()
    test_validation()
    test_graceful_error_isolation()
    print("\nALL MODULE 2 PRODUCT INTELLIGENCE UNIT TESTS PASSED!")
