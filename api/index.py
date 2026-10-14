"""
TailorResume — Vercel Serverless API Gateway
Provides FastAPI entrypoint for Vercel Serverless Functions with zero-downtime fallbacks.
"""

import os
import re
import sys
import traceback
import urllib.parse

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Top-level application instance for Vercel
app = FastAPI(
    title="TailorResume",
    version="1.0.0",
    description="AI-powered website intelligence and analytics API (Vercel Serverless Gateway)"
)

# CORS configuration
# Restricts origins to Chrome extension IDs, local dev, and Vercel production domains
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^(chrome-extension://.*|http://localhost(:\d+)?|http://127\.0\.0\.1(:\d+)?|https://.*\.vercel\.app)$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-Resume-SHA256", "X-File-Type"],
)

# Route Normalization Middleware for Vercel Serverless
@app.middleware("http")
async def strip_vercel_prefix(request: Request, call_next):
    raw_qs = request.scope.get("query_string", b"").decode("utf-8")
    path = request.scope.get("path", "")

    # Extract __path__ query param injected by Vercel rewrites if present
    if "__path__" in raw_qs:
        parsed_qs = urllib.parse.parse_qs(raw_qs, keep_blank_values=True)
        path = parsed_qs.pop("__path__", [""])[0] or "/"
        new_qs = urllib.parse.urlencode([(k, v) for k, vs in parsed_qs.items() for v in vs])
        request.scope["query_string"] = new_qs.encode("utf-8")
    else:
        # Check potential header fallbacks
        path = (
            request.headers.get("x-invoke-path")
            or request.headers.get("x-matched-path")
            or request.headers.get("x-real-path")
            or path
        )

    if "?" in path:
        path = path.split("?")[0]

    # Normalize slashes
    path = re.sub(r"/+", "/", path)
    if not path.startswith("/"):
        path = "/" + path

    # Normalize Vercel / serverless routing prefixes
    if path.startswith("/api/index.py"):
        path = path[len("/api/index.py"):] or "/"
    elif path.startswith("/api/") and len(path) > 5:
        path = path[len("/api"):] or "/"
    elif path == "/api":
        path = "/"

    path = re.sub(r"/+", "/", path)

    request.scope["path"] = path
    if "raw_path" in request.scope:
        request.scope["raw_path"] = path.encode("utf-8")

    if _init_error and request.scope["path"] not in ("/", "/health", "/debug"):
        return JSONResponse(
            status_code=500,
            content={
                "detail": f"Backend initialization failed: {_init_error.get('error')}",
                "diagnostic": _init_error,
            },
        )
    return await call_next(request)


# Path resolution for backend modules
cwd = os.getcwd()
backend_dir = os.path.join(cwd, "backend")
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
file_backend_dir = os.path.join(root_dir, "backend")

for p in (cwd, backend_dir, root_dir, file_backend_dir):
    if p and os.path.exists(p) and p not in sys.path:
        sys.path.insert(0, p)

# Track initialization status
_init_error = None

try:
    from routes.auth import router as auth_router
    from routes.resumes import router as resumes_router
    from routes.resume_imports import router as resume_imports_router
    from routes.jobs import router as jobs_router
    from routes.job_matches import router as job_matches_router
    from routes.tailoring import router as tailoring_router
    from routes.resume_export import router as resume_export_router
    from routes.dashboard import router as dashboard_router

    app.include_router(auth_router, prefix="/auth", tags=["Authentication"])
    app.include_router(auth_router, prefix="/user", tags=["User Profile"])
    app.include_router(resume_imports_router, prefix="/api/resumes/import", tags=["Resume Import"])
    app.include_router(resume_imports_router, prefix="/resumes/import", tags=["Resume Import"])
    app.include_router(tailoring_router, prefix="/api/resumes", tags=["Resume Tailoring"])
    app.include_router(tailoring_router, prefix="/resumes", tags=["Resume Tailoring"])
    app.include_router(tailoring_router, prefix="/api/tailoring", tags=["Resume Tailoring"])
    app.include_router(tailoring_router, prefix="/tailoring", tags=["Resume Tailoring"])
    app.include_router(resume_export_router, prefix="/api/resumes", tags=["Resume Export"])
    app.include_router(resume_export_router, prefix="/resumes", tags=["Resume Export"])
    app.include_router(resumes_router, prefix="/api/resumes", tags=["Resumes"])
    app.include_router(resumes_router, prefix="/resumes", tags=["Resumes"])
    app.include_router(jobs_router, prefix="/api/jobs", tags=["Jobs"])
    app.include_router(jobs_router, prefix="/jobs", tags=["Jobs"])
    app.include_router(job_matches_router, prefix="/api/jobs", tags=["Job Matches"])
    app.include_router(job_matches_router, prefix="/jobs", tags=["Job Matches"])
    app.include_router(job_matches_router, prefix="/api/job-matches", tags=["Job Matches"])
    app.include_router(job_matches_router, prefix="/job-matches", tags=["Job Matches"])
    app.include_router(dashboard_router, prefix="/api/dashboard", tags=["Dashboard"])
    app.include_router(dashboard_router, prefix="/dashboard", tags=["Dashboard"])
except Exception as e:
    _init_error = {
        "error": str(e),
        "type": type(e).__name__,
        "traceback": traceback.format_exc(),
        "sys_path": sys.path[:5],
        "cwd": cwd,
        "files_in_cwd": os.listdir(cwd) if os.path.exists(cwd) else []
    }


# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred.", "type": type(exc).__name__}
    )


# Health Check & Root Endpoints
@app.get("/")
@app.get("/health")
async def health(request: Request):
    if _init_error:
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": "Backend initialization failed"}
        )
    return {
        "status": "healthy",
        "app": "TailorResume",
        "version": "2.0.0",
        "platform": "vercel-serverless",
    }


@app.get("/debug")
async def debug(request: Request):
    debug_secret = os.environ.get("DEBUG_ENDPOINT_SECRET")
    provided = request.headers.get("x-debug-secret") or request.query_params.get("secret")
    if not debug_secret or provided != debug_secret:
        return JSONResponse(
            status_code=403,
            content={"detail": "Debug endpoint is disabled in production."}
        )
    return {
        "status": "debug",
        "platform": "vercel-serverless",
        "initialized": _init_error is None,
    }
