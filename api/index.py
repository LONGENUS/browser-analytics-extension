import os
import sys

# Add all candidate paths to sys.path
cwd = os.getcwd()
backend_dir = os.path.join(cwd, "backend")
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
file_backend_dir = os.path.join(root_dir, "backend")

for p in (cwd, backend_dir, root_dir, file_backend_dir):
    if p and os.path.exists(p) and p not in sys.path:
        sys.path.insert(0, p)

try:
    from app import app
except Exception as e:
    import traceback
    err_tb = traceback.format_exc()
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse
    
    app = FastAPI(title="WebIntel Diagnostic Handler")

    @app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"])
    async def catch_all_error(path: str):
        return JSONResponse(
            status_code=500,
            content={
                "error": "Backend initialization failed on Vercel",
                "detail": str(e),
                "traceback": err_tb,
                "sys_path": sys.path,
                "cwd": os.getcwd(),
                "files_in_cwd": os.listdir(os.getcwd()) if os.path.exists(os.getcwd()) else []
            }
        )
