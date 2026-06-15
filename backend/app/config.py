# app/config.py
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://omar:***@192.168.10.72:5432/owl_journal"

    # Redis
    REDIS_URL: str = "redis://192.168.10.72:6379/0"


@lru_cache
def get_settings() -> Settings:
    return Settings()
