"""
WebIntel — Analyze Route
POST /analyze — Main analysis endpoint.
"""

from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, HttpUrl

from services.analytics import AnalyticsService
from services.summarizer import SummarizerService


router = APIRouter()


class AnalyzeRequest(BaseModel):
    url: str
    title: str = ""


class AnalyzeResponse(BaseModel):
    id: str = ""
    url: str
    domain: str
    title: str
    status: str = "completed"
    summary: str = ""
    overview: dict = {}
    products_intelligence: dict = {}
    seo_intelligence: dict = {}
    tech_stack: dict = {}
    traffic: dict = {}
    analytics: dict = {}
    seo: dict = {}
    products: list = []
    created_at: str = ""


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_url(request: Request, body: AnalyzeRequest):
    """
    Analyze a website URL.

    Flow:
    1. Validate the URL
    2. Crawl the page with Crawl4AI
    3. Extract structured data (products, prices, etc.)
    4. Compute analytics (price stats, brand counts, SEO audit)
    5. Generate AI summary
    6. Store in database
    7. Return results
    """
    # Validate URL
    url = body.url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="URL must start with http:// or https://")

    try:
        parsed = urlparse(url)
        if not parsed.hostname:
            raise ValueError("Invalid hostname")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid URL format")

    # Get crawler from app state (or initialize on demand if needed)
    crawler = getattr(request.app.state, "crawler", None)
    if not crawler:
        from services.crawler import CrawlService
        crawler = CrawlService()
        await crawler.start()
        request.app.state.crawler = crawler

    try:
        # Step 1: Crawl the page
        crawl_result = await crawler.crawl_url(url)

        # Step 2: Website Overview Engine (Module 1)
        overview_data = {}
        try:
            from services.overview import overview_service
            overview_data = overview_service.analyze(crawl_result, status_code=200)
        except Exception as ov_err:
            print(f"[WARN] Overview extraction failed: {ov_err}")
            overview_data = {
                "module": "overview",
                "status": "failed",
                "reason": str(ov_err),
            }

        # Step 3: Product Intelligence Engine (Module 2)
        product_intelligence = {}
        try:
            from services.product import product_service
            normalized_products = product_service.normalize(
                raw_products=crawl_result.get("products", []),
                domain=crawl_result.get("domain", ""),
                page_url=url,
                html=crawl_result.get("html", "")
            )
            crawl_result["products"] = normalized_products
            product_intelligence = product_service.analyze(crawl_result)
        except Exception as p_err:
            print(f"[WARN] Product intelligence extraction failed: {p_err}")
            product_intelligence = {
                "module": "products",
                "status": "failed",
                "reason": str(p_err),
            }

        # Step 4: SEO Intelligence Engine (Module 3)
        seo_intelligence = {}
        try:
            from services.seo import seo_service
            seo_intelligence = seo_service.analyze(crawl_result)
        except Exception as s_err:
            print(f"[WARN] SEO intelligence extraction failed: {s_err}")
            seo_intelligence = {
                "module": "seo",
                "status": "failed",
                "reason": str(s_err),
            }

        # Step 5: Technology Detection Engine (Module 4)
        tech_stack = {}
        try:
            from services.techstack import techstack_service
            tech_stack = techstack_service.analyze(crawl_result)
        except Exception as t_err:
            print(f"[WARN] Technology detection failed: {t_err}")
            tech_stack = {
                "module": "techstack",
                "status": "failed",
                "reason": str(t_err),
            }

        # Step 6: Website Traffic Analytics (Module 5)
        traffic_data = {}
        try:
            from services.traffic import traffic_service
            traffic_data = traffic_service.analyze(crawl_result)
        except Exception as tr_err:
            print(f"[WARN] Traffic analytics failed: {tr_err}")
            traffic_data = {
                "module": "traffic",
                "status": "failed",
                "reason": str(tr_err),
            }

        # Step 7: Compute analytics (Preserve backward compatibility)
        analytics_service = AnalyticsService()
        analytics_data = analytics_service.compute(crawl_result)
        if isinstance(product_intelligence, dict) and "analytics" in product_intelligence:
            prod_an = product_intelligence["analytics"]
            an_dict = analytics_data.setdefault("analytics", {})
            an_dict["lowest_price"] = prod_an.get("lowest_price")
            an_dict["highest_price"] = prod_an.get("highest_price")
            an_dict["duplicate_products"] = prod_an.get("duplicate_products", 0)
            an_dict["duplicate_asins"] = prod_an.get("duplicate_asins", 0)
            an_dict["discount_distribution"] = prod_an.get("discount_distribution", {})

        # Step 8: Generate AI summary
        summarizer = SummarizerService()
        summary = await summarizer.summarize(crawl_result, analytics_data)

        # Step 9: Store in database (try, but don't fail if DB is unavailable)
        analysis_id = ""
        try:
            from models.database import AsyncSessionLocal, Analysis
            from datetime import datetime, timezone

            async with AsyncSessionLocal() as session:
                analysis = Analysis(
                    url=url,
                    domain=crawl_result.get("domain", ""),
                    title=crawl_result.get("title", body.title),
                    status="completed",
                    summary={"text": summary},
                    analytics=analytics_data.get("analytics", {}),
                    seo_data=analytics_data.get("seo", {}),
                    raw_products=crawl_result.get("products", []),
                )
                session.add(analysis)
                await session.commit()
                analysis_id = analysis.id
        except Exception as db_err:
            print(f"[WARN] Database storage skipped: {db_err}")

        # Step 10: Build response with complete backward compatibility
        from datetime import datetime, timezone

        return AnalyzeResponse(
            id=analysis_id,
            url=url,
            domain=crawl_result.get("domain", ""),
            title=crawl_result.get("title", body.title),
            status="completed",
            summary=summary,
            overview=overview_data,
            products_intelligence=product_intelligence,
            seo_intelligence=seo_intelligence,
            tech_stack=tech_stack,
            traffic=traffic_data,
            analytics=analytics_data.get("analytics", {}),
            seo=analytics_data.get("seo", {}),
            products=crawl_result.get("products", []),
            created_at=datetime.now(timezone.utc).isoformat(),
        )

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        try:
            print(f"[ERROR] Analysis failed for {url}: {e}")
        except Exception:
            pass
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(e)}"
        )
