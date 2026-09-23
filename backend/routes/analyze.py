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

        # Step 3: Compute analytics
        analytics_service = AnalyticsService()
        analytics_data = analytics_service.compute(crawl_result)

        # Step 4: Generate AI summary
        summarizer = SummarizerService()
        summary = await summarizer.summarize(crawl_result, analytics_data)

        # Step 5: Store in database (try, but don't fail if DB is unavailable)
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

        # Step 6: Build response
        from datetime import datetime, timezone

        return AnalyzeResponse(
            id=analysis_id,
            url=url,
            domain=crawl_result.get("domain", ""),
            title=crawl_result.get("title", body.title),
            status="completed",
            summary=summary,
            overview=overview_data,
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
