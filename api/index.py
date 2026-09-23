import sys
import os

# Add backend directory to sys.path so all internal modules (routes, services, models) resolve cleanly
backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import app
