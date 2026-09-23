"""
WebIntel — Flipkart Extraction Schema
CSS selectors for Flipkart product listing pages.
"""

FLIPKART_SCHEMA = {
    "name": "Flipkart Product Extractor",
    "baseSelector": "div._1AtVbE, div._75nlfW, div.cPHDOP a.CGtC98, div[data-id]",
    "fields": [
        {
            "name": "title",
            "selector": "div._4rR01T, a.s1Q9rs, a.IRpwTa, div.KzDlHZ",
            "type": "text"
        },
        {
            "name": "price",
            "selector": "div._30jeq3, div._30jeq3._1_WHN1",
            "type": "text"
        },
        {
            "name": "rating",
            "selector": "div._3LWZlK, span._1lRcqv div._3LWZlK",
            "type": "text"
        },
        {
            "name": "reviews",
            "selector": "span._2_R_DZ span, span._13vcmD",
            "type": "text"
        },
        {
            "name": "link",
            "selector": "a._1fQZEK, a.s1Q9rs, a.IRpwTa, a.CGtC98",
            "type": "attribute",
            "attribute": "href"
        },
        {
            "name": "image",
            "selector": "img._396cs4, img._2r_T1I",
            "type": "attribute",
            "attribute": "src"
        },
        {
            "name": "brand",
            "selector": "div._2WkVRV, span._2B_pmu",
            "type": "text"
        }
    ]
}
