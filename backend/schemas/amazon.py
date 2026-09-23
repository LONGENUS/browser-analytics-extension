"""
WebIntel — Amazon Extraction Schema
CSS selectors for Amazon search/category pages.
"""

AMAZON_SCHEMA = {
    "name": "Amazon Product Extractor",
    "baseSelector": "div.s-result-item[data-asin]:not([data-asin='']), [data-component-type='s-search-result']",
    "fields": [
        {
            "name": "title",
            "selector": "h2 span, h2 a span, a.s-line-clamp-3 span, h2, a.s-line-clamp-2 span, h2 [class*='text-normal']",
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
            "selector": "a.a-link-normal.s-no-outline, a.a-link-normal[href*='/dp/'], h2 a.a-link-normal, a.s-line-clamp-3",
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
    "baseSelector": "#dp-container, #ppd, #centerCol, body",
    "fields": [
        {
            "name": "title",
            "selector": "#productTitle, #title span, h1#title",
            "type": "text"
        },
        {
            "name": "price",
            "selector": ".a-price .a-offscreen, #corePriceDisplay_desktop_feature_div .a-price .a-offscreen, .priceToPay .a-offscreen, #priceblock_ourprice, #priceblock_dealprice, #corePrice_desktop .a-price .a-offscreen, .apexPriceToPay .a-offscreen",
            "type": "text"
        },
        {
            "name": "rating",
            "selector": "#acrPopover .a-icon-alt, #averageCustomerReviews .a-icon-alt, .a-icon-alt",
            "type": "text"
        },
        {
            "name": "reviews",
            "selector": "#acrCustomerReviewText",
            "type": "text"
        },
        {
            "name": "brand",
            "selector": "#bylineInfo, a#bylineInfo, #brand, a#brand",
            "type": "text"
        },
        {
            "name": "image",
            "selector": "#landingImage, #imgBlkFront, #main-image, img[data-a-image-name='landingImage']",
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
