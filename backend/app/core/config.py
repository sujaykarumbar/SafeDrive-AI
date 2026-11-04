import os
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    APP_NAME: str = "SafeDrive AI"
    API_PREFIX: str = "/api/v1"
    SECRET_KEY: str = "safedrive-super-secret-development-key-change-in-production-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Database
    DATABASE_URL: str = "sqlite:///./safedrive.db"
    REDIS_URL: str = "redis://localhost:6379/0"

    # Storage
    UPLOAD_DIR: str = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")

    # Google Maps Platform configuration
    GOOGLE_MAPS_SERVER_API_KEY: Optional[str] = None
    GOOGLE_MAPS_CLIENT_API_KEY: Optional[str] = None
    ENABLE_GOOGLE_MAPS: bool = True

    # Tracking & Telemetry defaults
    DEFAULT_LOCATION_INTERVAL_SECONDS: int = 2
    MAX_SPEED_KMPH_CAR: float = 120.0
    HARSH_BRAKE_G_THRESHOLD_CAR: float = 0.45
    HARSH_ACCEL_G_THRESHOLD_CAR: float = 0.40

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "allow"


settings = Settings()

# Ensure upload directory exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
