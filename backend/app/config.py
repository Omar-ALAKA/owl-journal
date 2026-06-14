# app/config.py
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://omar:***@192.168.10.72:5432/owl_journal"

    # Redis
    REDIS_URL: str = "redis://192.168.10.72:6379/0"

    # App
    APP_NAME: str = "OWL Journal"
    APP_VERSION: str = "4.0.0"
    DEBUG: bool = False

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://192.168.10.71:5173"]

    # Security
    SECRET_KEY: str = "change-me-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24h

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
