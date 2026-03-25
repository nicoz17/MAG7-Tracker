import sys
import os

# Add the backend/ directory to sys.path so that "from routes.xxx import ..."
# and other relative imports inside main.py resolve correctly.
backend_dir = os.path.join(os.path.dirname(__file__), "..", "backend")
sys.path.insert(0, os.path.abspath(backend_dir))

from main import app  # noqa: E402
