"""
WebIntel — Main FastAPI Application
Entry point for the backend API server.
"""

import asyncio
from contextlib import asynccontextmanager

import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(line_buffering=True, encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(line_buffering=True, encoding="utf-8")

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from routes.analyze import router as analyze_router
from routes.export import router as export_router
from routes.history import router as history_router
from routes.overview import router as overview_router
from routes.products import router as products_router
from routes.seo import router as seo_router
from routes.tech import router as tech_router
from routes.traffic import router as traffic_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Initializes crawler and database connections on startup with resilient fallbacks.
    """
    # --- Startup ---
    from services.crawler import CrawlService
    from models.database import init_db

    # Initialize database tables
    try:
        await init_db()
    except Exception as e:
        print(f"[WARN] Database startup warning: {e}")

    # Initialize the global crawler instance
    try:
        crawler_service = CrawlService()
        await crawler_service.start()
        app.state.crawler = crawler_service
    except Exception as e:
        print(f"[WARN] Crawler initial startup warning: {e}")
        app.state.crawler = None

    print(f"[OK] {settings.APP_NAME} v{settings.APP_VERSION} started")
    print(f"[API] API running on http://{settings.HOST}:{settings.PORT}")

    yield

    # --- Shutdown ---
    if hasattr(app.state, "crawler") and app.state.crawler:
        try:
            await app.state.crawler.stop()
        except Exception:
            pass
    print(f"[STOP] {settings.APP_NAME} shut down")


# --- Create App ---
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI-powered website intelligence and analytics API",
    lifespan=lifespan,
)

# --- Global Exception Handler ---
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "type": type(exc).__name__}
    )

# --- CORS Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for extension compatibility
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Include Routers ---
app.include_router(analyze_router, tags=["Analysis"])
app.include_router(overview_router, prefix="/overview", tags=["Overview"])
app.include_router(products_router, prefix="/products", tags=["Products"])
app.include_router(seo_router, prefix="/seo", tags=["SEO"])
app.include_router(tech_router, prefix="/tech", tags=["Technology"])
app.include_router(traffic_router, prefix="/traffic", tags=["Traffic"])
app.include_router(export_router, prefix="/export", tags=["Export"])
app.include_router(history_router, prefix="/history", tags=["History"])


# --- Root & Health Check ---
@app.get("/")
async def root():
    """Root endpoint for status check."""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    """Basic health check endpoint."""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }


# --- Run ---
if __name__ == "__main__":
    import sys
    import asyncio
    import uvicorn

    # Fix for Windows: Playwright requires SelectorEventLoop
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    uvicorn.run(
        "app:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=False,  # Disable reload on Windows (Playwright conflict)
    )

