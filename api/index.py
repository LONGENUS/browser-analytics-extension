import os
import sys

# Ensure backend and root directories are in sys.path
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
backend_dir = os.path.join(root_dir, "backend")

for p in (backend_dir, root_dir):
    if p not in sys.path:
        sys.path.insert(0, p)

from app import app as _app

app = _app
