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


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Initializes Crawl4AI crawler and database connections on startup,
    and cleans them up on shutdown.
    """
    # --- Startup ---
    from services.crawler import CrawlService
    from models.database import init_db

    # Initialize database tables
    await init_db()

    # Initialize the global crawler instance
    crawler_service = CrawlService()
    try:
        await crawler_service.start()
    except Exception as e:
        print(f"[WARN] Crawler initial startup warning: {e}")
    app.state.crawler = crawler_service

    print(f"[OK] {settings.APP_NAME} v{settings.APP_VERSION} started")
    print(f"[API] API running on http://{settings.HOST}:{settings.PORT}")

    yield

    # --- Shutdown ---
    if hasattr(app.state, "crawler") and app.state.crawler:
        await app.state.crawler.stop()
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
app.include_router(export_router, prefix="/export", tags=["Export"])
app.include_router(history_router, prefix="/history", tags=["History"])


# --- Health Check ---
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

