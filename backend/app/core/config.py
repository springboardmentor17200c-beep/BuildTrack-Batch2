from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    app_name: str = Field(default="BuildTrack API", validation_alias="APP_NAME")
    app_env: str = Field(default="development", validation_alias="APP_ENV")
    debug: bool = Field(default=True, validation_alias="APP_DEBUG")
    api_v1_prefix: str = Field(default="/api/v1", validation_alias="API_V1_PREFIX")

    mongodb_url: str = Field(
        default="mongodb://localhost:27017",
        validation_alias="MONGODB_URL",
    )
    mongodb_db_name: str = Field(
        default="buildtrack",
        validation_alias="MONGODB_DB_NAME",
    )

    jwt_secret_key: str = Field(
        default="change-this-secret-before-production",
        validation_alias="JWT_SECRET_KEY",
    )
    jwt_algorithm: str = Field(default="HS256", validation_alias="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(
        default=60,
        validation_alias="ACCESS_TOKEN_EXPIRE_MINUTES",
    )

    backend_cors_origins: str = Field(
        default="http://localhost:4200,http://127.0.0.1:4200",
        validation_alias="BACKEND_CORS_ORIGINS",
    )

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("api_v1_prefix")
    @classmethod
    def normalize_api_prefix(cls, value: str) -> str:
        if not value.startswith("/"):
            return f"/{value}"
        return value.rstrip("/") or "/api/v1"

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        if self.app_env.lower() != "production":
            return self

        if self.debug:
            raise ValueError("APP_DEBUG must be false when APP_ENV=production")
        if self.jwt_secret_key == "change-this-secret-before-production":
            raise ValueError("JWT_SECRET_KEY must be supplied when APP_ENV=production")
        if "*" in self.cors_origins:
            raise ValueError("BACKEND_CORS_ORIGINS must not allow '*' in production")

        return self

    @property
    def cors_origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.backend_cors_origins.split(",")
            if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
