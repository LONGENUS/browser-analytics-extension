"""
WebIntel — Vercel Serverless API Gateway
Provides FastAPI entrypoint for Vercel Serverless Functions with zero-downtime fallbacks.
"""

import os
import sys
import traceback

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Top-level application instance for Vercel
app = FastAPI(
    title="WebIntel",
    version="1.0.0",
    description="AI-powered website intelligence and analytics API (Vercel Serverless Gateway)"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Route Normalization Middleware for Vercel Serverless
@app.middleware("http")
async def strip_vercel_prefix(request: Request, call_next):
    path = request.scope.get("path", "")
    if path.startswith("/api/index.py"):
        request.scope["path"] = path[len("/api/index.py"):] or "/"
    elif path.startswith("/api") and len(path) > 4:
        request.scope["path"] = path[len("/api"):] or "/"
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
    from routes.analyze import router as analyze_router
    from routes.export import router as export_router
    from routes.history import router as history_router

    app.include_router(analyze_router, tags=["Analysis"])
    app.include_router(export_router, prefix="/export", tags=["Export"])
    app.include_router(history_router, prefix="/history", tags=["History"])
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
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "type": type(exc).__name__, "traceback": traceback.format_exc()}
    )


# Health Check & Root Endpoints
@app.get("/")
@app.get("/health")
async def health():
    if _init_error:
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": "Backend module import failed", "diagnostic": _init_error}
        )
    return {
        "status": "healthy",
        "app": "WebIntel",
        "version": "1.0.0",
        "platform": "vercel-serverless"
    }


@app.get("/debug")
async def debug():
    return {
        "init_error": _init_error,
        "cwd": os.getcwd(),
        "files": os.listdir(os.getcwd()) if os.path.exists(os.getcwd()) else [],
        "sys_path": sys.path
    }
