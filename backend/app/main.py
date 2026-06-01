"""
FastAPI main application entry point.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.database import create_tables
from app.services.health import start_health_monitor


settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan — startup and shutdown logic."""
    # Startup
    await create_tables()
    health_task = start_health_monitor()
    yield
    # Shutdown
    health_task.cancel()
    try:
        await health_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="AI Workspace API",
    description="Production-grade AI Workspace SaaS Platform — multi-model AI chat with real-time token tracking.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
from app.routers import auth, chat, analytics, billing, api_keys, workspaces, teams, admin, agents  # noqa: E402

app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(analytics.router)
app.include_router(billing.router)
app.include_router(api_keys.router)
app.include_router(workspaces.router)
app.include_router(teams.router)
app.include_router(admin.router)
app.include_router(agents.router)

# Alias /api/v1/models to list_models from chat router
from app.routers.chat import list_models
app.get("/api/v1/models", tags=["models"])(list_models)


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["system"])
async def health_check() -> dict:
    return {
        "status": "ok",
        "version": "1.0.0",
        "environment": settings.APP_ENV,
    }


@app.get("/", tags=["system"])
async def root() -> dict:
    return {
        "message": "AI Workspace API",
        "docs": "/docs",
        "version": "1.0.0",
    }
