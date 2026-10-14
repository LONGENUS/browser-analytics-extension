"""
TailorResume — Main FastAPI Application
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
from routes.auth import router as auth_router
from routes.resumes import router as resumes_router
from routes.resume_imports import router as resume_imports_router
from routes.jobs import router as jobs_router
from routes.job_matches import router as job_matches_router
from routes.tailoring import router as tailoring_router
from routes.resume_export import router as resume_export_router
from routes.dashboard import router as dashboard_router



@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Initializes database connections on startup.
    """
    from models.database import init_db

    try:
        await init_db()
    except Exception as e:
        print(f"[WARN] Database startup warning: {e}")

    print(f"[OK] {settings.APP_NAME} v{settings.APP_VERSION} started")
    print(f"[API] API running on http://{settings.HOST}:{settings.PORT}")

    yield

    print(f"[STOP] {settings.APP_NAME} shut down")


# --- Create App ---
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Centralized API for Job Tailoring and Web Application",
    lifespan=lifespan,
)

# --- Global Exception Handler ---
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred.", "type": type(exc).__name__}
    )

# --- CORS Middleware ---
# Restricts origins to Chrome extension IDs, local dev, and Vercel production domains
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^(chrome-extension://.*|http://localhost(:\d+)?|http://127\.0\.0\.1(:\d+)?|https://.*\.vercel\.app)$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-Resume-SHA256", "X-File-Type"],
)

# --- Include Routers ---
app.include_router(auth_router, prefix="/auth", tags=["Authentication"])
app.include_router(auth_router, prefix="/user", tags=["User Profile"])
app.include_router(resume_imports_router, prefix="/api/resumes/import", tags=["Resume Import"])
app.include_router(resume_imports_router, prefix="/resumes/import", tags=["Resume Import"])
app.include_router(tailoring_router, prefix="/api/resumes", tags=["Resume Tailoring"])
app.include_router(tailoring_router, prefix="/resumes", tags=["Resume Tailoring"])
app.include_router(resume_export_router, prefix="/api/resumes", tags=["Resume Export"])
app.include_router(resume_export_router, prefix="/resumes", tags=["Resume Export"])
app.include_router(resumes_router, prefix="/api/resumes", tags=["Resumes"])
app.include_router(resumes_router, prefix="/resumes", tags=["Resumes"])
app.include_router(jobs_router, prefix="/api/jobs", tags=["Jobs"])
app.include_router(jobs_router, prefix="/jobs", tags=["Jobs"])
app.include_router(job_matches_router, prefix="/api/jobs", tags=["Job Matches"])
app.include_router(job_matches_router, prefix="/jobs", tags=["Job Matches"])
app.include_router(dashboard_router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(dashboard_router, prefix="/dashboard", tags=["Dashboard"])


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

