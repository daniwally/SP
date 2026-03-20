"""
Vercel serverless entry point for FastAPI backend.
Adds backend/ to sys.path so all existing imports work.
"""
import sys
import os

# Add backend directory to Python path
backend_dir = os.path.join(os.path.dirname(__file__), '..', 'backend')
sys.path.insert(0, backend_dir)

from main import app  # noqa: E402
