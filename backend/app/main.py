import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.app.core.config import settings
from backend.app.db.session import engine, Base
from backend.app.db.seed import init_and_seed_db
from backend.app.api.auth import router as auth_router
from backend.app.api.vehicles import router as vehicles_router
from backend.app.api.trips import router as trips_router
from backend.app.api.caretaker import router as caretaker_router
from backend.app.api.hazards import router as hazards_router
from backend.app.api.emergency import router as emergency_router
from backend.app.api.department import router as department_router
from backend.app.api.admin import router as admin_router
from backend.app.api.ml_routes import router as ml_router
from backend.app.api.routes_api import router as routes_router
from backend.app.websocket.routes import ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables and seed demo data if fresh
    print(f"Starting {settings.APP_NAME} in {settings.ENVIRONMENT} mode...")
    init_and_seed_db()
    yield
    print(f"Shutting down {settings.APP_NAME}...")


app = FastAPI(
    title=settings.APP_NAME,
    description="Backend API Gateway for SafeDrive AI — Smart Driver Safety, Risk Prediction & Road Hazard Intelligence",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS Middleware for React dashboards and Flutter mobile app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permits all local web dev ports and mobile origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers under /api/v1
app.include_router(auth_router, prefix=settings.API_PREFIX)
app.include_router(vehicles_router, prefix=settings.API_PREFIX)
app.include_router(trips_router, prefix=settings.API_PREFIX)
app.include_router(caretaker_router, prefix=settings.API_PREFIX)
app.include_router(hazards_router, prefix=settings.API_PREFIX)
app.include_router(emergency_router, prefix=settings.API_PREFIX)
app.include_router(department_router, prefix=settings.API_PREFIX)
app.include_router(admin_router, prefix=settings.API_PREFIX)
app.include_router(ml_router, prefix=settings.API_PREFIX)
app.include_router(routes_router, prefix=settings.API_PREFIX)

# Include WebSocket routes
app.include_router(ws_router)

# Mount upload directory for static media access
uploads_path = settings.UPLOAD_DIR
os.makedirs(uploads_path, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_path), name="uploads")


@app.get("/")
def root():
    return {
        "app": settings.APP_NAME,
        "version": "1.0.0",
        "docs": "/docs",
        "health": f"{settings.API_PREFIX}/admin/health",
        "status": "online"
    }


@app.get("/health")
def basic_health():
    return {"status": "ok", "app": settings.APP_NAME}
