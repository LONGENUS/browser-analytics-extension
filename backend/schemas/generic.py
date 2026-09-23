"""
WebIntel — Generic Extraction Schema
Fallback CSS selectors for unknown/general websites.
Attempts to find common product-like structures.
"""

GENERIC_SCHEMA = {
    "name": "Generic Product Extractor",
    "baseSelector": (
        "[class*='product'], [class*='item'], [class*='card'], "
        "[data-product], article, .listing-item, .grid-item"
    ),
    "fields": [
        {
            "name": "title",
            "selector": (
                "h2, h3, h4, "
                "[class*='title'], [class*='name'], "
                "[class*='heading'], a[title]"
            ),
            "type": "text"
        },
        {
            "name": "price",
            "selector": (
                "[class*='price'], [class*='cost'], [class*='amount'], "
                "[data-price], .price, .sale-price, .regular-price"
            ),
            "type": "text"
        },
        {
            "name": "link",
            "selector": "a",
            "type": "attribute",
            "attribute": "href"
        },
        {
            "name": "image",
            "selector": "img",
            "type": "attribute",
            "attribute": "src"
        },
        {
            "name": "rating",
            "selector": (
                "[class*='rating'], [class*='star'], "
                "[class*='review-score'], [data-rating]"
            ),
            "type": "text"
        },
        {
            "name": "brand",
            "selector": (
                "[class*='brand'], [class*='vendor'], "
                "[class*='manufacturer']"
            ),
            "type": "text"
        }
    ]
}
