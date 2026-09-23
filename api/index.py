"""
WebIntel — Vercel Serverless API Gateway
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
    from routes.analyze import router as analyze_router
    from routes.overview import router as overview_router
    from routes.products import router as products_router
    from routes.export import router as export_router
    from routes.history import router as history_router

    app.include_router(analyze_router, tags=["Analysis"])
    app.include_router(overview_router, prefix="/overview", tags=["Overview"])
    app.include_router(products_router, prefix="/products", tags=["Products"])
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
async def health(request: Request):
    if _init_error:
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": "Backend module import failed", "diagnostic": _init_error}
        )
    return {
        "status": "healthy",
        "app": "WebIntel",
        "version": "1.0.2",
        "platform": "vercel-serverless",
        "scope_path": request.scope.get("path"),
        "headers": {k: v for k, v in request.headers.items() if "auth" not in k.lower()}
    }


@app.get("/debug")
async def debug(request: Request):
    return {
        "init_error": _init_error,
        "cwd": os.getcwd(),
        "files": os.listdir(os.getcwd()) if os.path.exists(os.getcwd()) else [],
        "sys_path": sys.path,
        "scope_path": request.scope.get("path"),
        "headers": {k: v for k, v in request.headers.items() if "auth" not in k.lower()}
    }
