"""
WebIntel — AI Summarizer Service
Generates intelligent page summaries using templates or LLM.
"""

from typing import Optional
from config import settings


class SummarizerService:
    """Generates AI-powered or template-based page summaries."""

    async def summarize(self, crawl_result: dict, analytics: dict) -> str:
        """
        Generate a summary of the analyzed page.

        Uses OpenAI/LLM if API key is configured, otherwise falls back
        to a template-based summary.
        """
        if settings.OPENAI_API_KEY:
            try:
                return await self._llm_summary(crawl_result, analytics)
            except Exception as e:
                print(f"[WARN] LLM summary failed, using template: {e}")

        return self._template_summary(crawl_result, analytics)

    # --- Template-Based Summary ---

    def _template_summary(self, crawl_result: dict, analytics: dict) -> str:
        """Generate a structured summary without AI."""
        domain = crawl_result.get("domain", "generic")
        url = crawl_result.get("url", "")
        title = (crawl_result.get("title") or "the page").strip()
        products = crawl_result.get("products", [])
        product_analytics = analytics.get("analytics", {})
        seo = analytics.get("seo", {})

        parts = []

        # Opening line
        total = product_analytics.get("total_products", 0)
        unique = product_analytics.get("unique_products", 0)

        if total > 0:
            domain_label = domain.replace("_", " ").title() if domain != "generic" else "this website"
            parts.append(
                f"Analyzed {domain_label} page and found {total} products "
                f"({unique} unique) across the page."
            )
        else:
            safe_title = title[:60] if title else "this page"
            parts.append(
                f"Analyzed the page \"{safe_title}\" but no structured product data was detected. "
                f"The page may be a non-product page or use a layout not yet supported."
            )

        # Price insights
        avg_price = product_analytics.get("avg_price")
        min_price = product_analytics.get("min_price")
        max_price = product_analytics.get("max_price")

        if avg_price is not None and min_price is not None and max_price is not None:
            parts.append(
                f"Prices range from ₹{min_price:,.0f} to ₹{max_price:,.0f}, "
                f"with an average of ₹{avg_price:,.0f}."
            )
        elif avg_price is not None:
            parts.append(f"Average price is ₹{avg_price:,.0f}.")

        # Brand insights
        unique_brands = product_analytics.get("unique_brands", 0)
        top_brands = product_analytics.get("top_brands", [])

        if unique_brands > 0:
            top_names = [b["name"] for b in top_brands[:3]]
            brands_str = ", ".join(top_names)
            parts.append(
                f"Found {unique_brands} unique brands. "
                f"Top brands: {brands_str}."
            )

        # Rating insights
        avg_rating = product_analytics.get("avg_rating")
        if avg_rating:
            parts.append(f"Average product rating: {avg_rating}/5 stars.")

        # SEO insights
        title_score = seo.get("title_score", "")
        desc_score = seo.get("description_score", "")

        seo_issues = []
        if title_score == "missing":
            seo_issues.append("missing meta title")
        elif title_score == "too_long":
            seo_issues.append("meta title is too long")

        if desc_score == "missing":
            seo_issues.append("missing meta description")
        elif desc_score == "too_long":
            seo_issues.append("meta description is too long")

        if seo_issues:
            parts.append(f"SEO issues detected: {', '.join(seo_issues)}.")

        # Link stats
        link_count = seo.get("link_count", 0)
        image_count = seo.get("image_count", 0)

        if link_count or image_count:
            parts.append(
                f"Page contains {link_count} links and {image_count} images."
            )

        return " ".join(parts)

    # --- LLM-Based Summary ---

    async def _llm_summary(self, crawl_result: dict, analytics: dict) -> str:
        """Generate summary using OpenAI API."""
        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

            # Build context
            product_analytics = analytics.get("analytics", {})
            seo = analytics.get("seo", {})
            products = crawl_result.get("products", [])

            prompt = self._build_llm_prompt(crawl_result, product_analytics, seo, products)

            response = await client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a website intelligence analyst. Generate a concise, "
                            "insightful 3-5 sentence summary of the analyzed webpage data. "
                            "Focus on actionable insights: pricing trends, competitive positioning, "
                            "brand dominance, and SEO health. Use specific numbers."
                        )
                    },
                    {"role": "user", "content": prompt}
                ],
                max_tokens=300,
                temperature=0.7,
            )

            return response.choices[0].message.content.strip()

        except ImportError:
            raise RuntimeError("openai package not installed")

    def _build_llm_prompt(self, crawl_result: dict, analytics: dict, seo: dict, products: list) -> str:
        """Build the prompt for the LLM."""
        return f"""Analyze this website data and provide insights:

URL: {crawl_result.get('url', 'N/A')}
Domain: {crawl_result.get('domain', 'N/A')}
Page Title: {crawl_result.get('title', 'N/A')}

Product Analytics:
- Total Products: {analytics.get('total_products', 0)}
- Unique Products: {analytics.get('unique_products', 0)}
- Average Price: ₹{analytics.get('avg_price', 'N/A')}
- Price Range: ₹{analytics.get('min_price', 'N/A')} - ₹{analytics.get('max_price', 'N/A')}
- Unique Brands: {analytics.get('unique_brands', 0)}
- Top Brands: {', '.join(b['name'] for b in analytics.get('top_brands', [])[:5])}
- Average Rating: {analytics.get('avg_rating', 'N/A')}

SEO:
- Meta Title: {seo.get('title_score', 'N/A')} ({seo.get('meta_title_length', 0)} chars)
- Meta Description: {seo.get('description_score', 'N/A')} ({seo.get('meta_description_length', 0)} chars)
- Links: {seo.get('link_count', 0)} total
- Images: {seo.get('image_count', 0)}

Sample Product Titles (first 5):
{chr(10).join(f'- {p.get("title", "N/A")[:80]}' for p in products[:5])}
"""
