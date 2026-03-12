import asyncpg
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost/sobrepatas")

async def init_db():
    print("✅ Database initialized")
