"""
WebIntel — Amazon Extraction Schema
CSS selectors for Amazon search/category pages.
"""

AMAZON_SCHEMA = {
    "name": "Amazon Product Extractor",
    "baseSelector": "[data-component-type='s-search-result'], .s-result-item[data-asin]",
    "fields": [
        {
            "name": "title",
            "selector": "h2 a span, h2 span.a-text-normal",
            "type": "text"
        },
        {
            "name": "price",
            "selector": ".a-price .a-offscreen, .a-price-whole",
            "type": "text"
        },
        {
            "name": "rating",
            "selector": ".a-icon-alt",
            "type": "text"
        },
        {
            "name": "reviews",
            "selector": ".a-size-base.s-underline-text, span.a-size-base[dir='auto']",
            "type": "text"
        },
        {
            "name": "link",
            "selector": "h2 a.a-link-normal",
            "type": "attribute",
            "attribute": "href"
        },
        {
            "name": "image",
            "selector": "img.s-image",
            "type": "attribute",
            "attribute": "src"
        },
        {
            "name": "brand",
            "selector": ".a-size-base-plus.a-color-base, span.a-size-base.a-color-secondary + span",
            "type": "text"
        },
        {
            "name": "asin",
            "selector": "[data-asin]",
            "type": "attribute",
            "attribute": "data-asin"
        }
    ]
}

# Schema for Amazon product detail pages
AMAZON_PRODUCT_DETAIL_SCHEMA = {
    "name": "Amazon Product Detail",
    "baseSelector": "#dp-container, #ppd",
    "fields": [
        {
            "name": "title",
            "selector": "#productTitle, #title span",
            "type": "text"
        },
        {
            "name": "price",
            "selector": ".a-price .a-offscreen, #priceblock_ourprice, #priceblock_dealprice, .priceToPay .a-offscreen",
            "type": "text"
        },
        {
            "name": "rating",
            "selector": "#acrPopover .a-icon-alt, .a-icon-alt",
            "type": "text"
        },
        {
            "name": "reviews",
            "selector": "#acrCustomerReviewText",
            "type": "text"
        },
        {
            "name": "brand",
            "selector": "#bylineInfo, a#bylineInfo",
            "type": "text"
        },
        {
            "name": "image",
            "selector": "#landingImage, #imgBlkFront",
            "type": "attribute",
            "attribute": "src"
        },
        {
            "name": "asin",
            "selector": "input#ASIN, [data-asin]",
            "type": "attribute",
            "attribute": "value"
        }
    ]
}
