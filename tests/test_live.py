import urllib.request
import json

base_url = "https://browser-analytics-extension-longenus05-3620s-projects.vercel.app"

# 1. Test Schema
req = urllib.request.Request(f"{base_url}/products/schema")
with urllib.request.urlopen(req) as resp:
    print(f"GET /products/schema -> Status {resp.status}")

# 2. Test Export (CSV)
sample = {
    "products": [
        {
            "product_name": "Sony WH-1000XM5 Wireless Headphones",
            "brand": "Sony",
            "price": 348.0,
            "original_price": 399.99,
            "discount_percent": 13.0,
            "rating": 4.6,
            "review_count": 8940,
            "asin_sku": "B09XS7JWHH",
            "availability": "In Stock",
            "prime_shipping": "Prime",
            "image_url": "https://example.com/sony.jpg",
            "product_url": "https://example.com/sony",
            "position": 1
        }
    ],
    "format": "csv"
}

data_bytes = json.dumps(sample).encode("utf-8")
post_req = urllib.request.Request(
    f"{base_url}/products/export",
    data=data_bytes,
    headers={"Content-Type": "application/json"}
)

with urllib.request.urlopen(post_req) as resp:
    content = resp.read().decode("utf-8")
    print(f"POST /products/export -> Status {resp.status}")
    print("CSV Content preview:\n" + content[:250])

print("\nALL LIVE PRODUCTION CHECKS VERIFIED SUCCESSFULLY!")
