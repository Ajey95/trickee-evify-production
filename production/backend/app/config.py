from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Trickee EV Intelligence API"
    api_prefix: str = "/api/v1"
    database_url: str = "sqlite:///./trickee.db"
    secret_key: str = "change-me-generate-with-secrets-token-hex"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440
    allowed_origins: str = "http://localhost:3000"
    model_dir: str = "models_ml"
    demo_seed: bool = False
    demo_admin_password: str | None = None
    demo_fleet_password: str | None = None
    demo_driver_password: str | None = None
    openweather_api_key: str | None = None
    google_maps_api_key: str | None = None
    google_places_api_key: str | None = None
    external_api_timeout_seconds: float = 6.0
    notification_provider: str = "dashboard"
    notification_webhook_url: str | None = None
    firebase_project_id: str | None = None
    firebase_service_account_path: str | None = None
    firebase_service_account_json: str | None = None
    firebase_auth_enabled: bool = False
    firebase_fcm_enabled: bool = False
    groq_api_key: str | None = None
    groq_model: str = "llama-3.1-8b-instant"
    resend_api_key: str | None = None
    report_from_email: str | None = None
    report_to_emails: str | None = None
    redis_url: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        protected_namespaces=("settings_",),
    )

    @property
    def sqlalchemy_database_url(self) -> str:
        if self.database_url.startswith("postgres://"):
            return self.database_url.replace("postgres://", "postgresql://", 1)
        return self.database_url

    @property
    def allowed_origin_list(self) -> list[str]:
        origins = [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]
        production_origins = [
            "https://trickee-evify-live.vercel.app",
        ]
        return list(dict.fromkeys([*origins, *production_origins]))

    @property
    def report_to_email_list(self) -> list[str]:
        if not self.report_to_emails:
            return []
        return [email.strip() for email in self.report_to_emails.split(",") if email.strip()]

    @property
    def model_path(self) -> Path:
        return Path(self.model_dir) / "battery_model_v4_1.pth"

    @property
    def scaler_path(self) -> Path:
        return Path(self.model_dir) / "scaler_v4_1.joblib"

    @property
    def y_scaler_path(self) -> Path:
        return Path(self.model_dir) / "y_scaler_v4_1.joblib"


@lru_cache
def get_settings() -> Settings:
    return Settings()
