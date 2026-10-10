from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator

class Settings(BaseSettings):
    ENV: str = "development"
    SECRET_KEY: str
    PORT: int = 8000
    DATABASE_URL: str
    REDIS_URL: str
    S3_ENDPOINT_URL: str | None = None
    S3_BUCKET: str = ""
    S3_REGION: str = ""
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    SENTRY_DSN: str | None = None
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    GEMINI_API_KEY: str | None = None

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        return v

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()
