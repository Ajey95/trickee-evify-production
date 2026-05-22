from functools import lru_cache
from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_SECRET_KEY = "change-me-generate-with-secrets-token-hex"


class Settings(BaseSettings):
    app_name: str = "Trickee EV Intelligence API"
    api_prefix: str = "/api/v1"
    database_url: str = "sqlite:///./trickee.db"
    secret_key: str = DEFAULT_SECRET_KEY
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
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
    external_context_redis_cache_enabled: bool = True
    external_context_stale_cache_seconds: int = 86_400
    external_context_h3_enabled: bool = True
    external_context_h3_resolution: int = 10
    external_context_weather_h3_resolution: int = 6
    google_external_daily_limit: int = 1_500
    openweather_external_daily_limit: int = 1_000
    notification_provider: str = "dashboard"
    notification_webhook_url: str | None = None
    firebase_project_id: str | None = None
    firebase_service_account_path: str | None = None
    firebase_service_account_json: str | None = None
    firebase_auth_enabled: bool = False
    firebase_fcm_enabled: bool = False
    supabase_jwt_secret: str | None = None
    supabase_url: str | None = None
    supabase_anon_key: str | None = None
    supabase_jwks_url: str | None = None
    supabase_jwt_audience: str = "authenticated"
    legacy_auth_enabled: bool = False
    groq_api_key: str | None = None
    groq_model: str = "llama-3.1-8b-instant"
    ai_request_timeout_seconds: float = 4.0
    ai_max_retries: int = 1
    ai_max_input_chars: int = 4_000
    ai_max_output_tokens: int = 220
    assistant_rate_limit_per_hour: int = 20
    notification_personalization_rate_limit_per_hour: int = 10
    charger_recommendation_rate_limit_per_hour: int = 30
    route_explanation_rate_limit_per_hour: int = 30
    fleet_summary_rate_limit_per_hour: int = 20
    coaching_rate_limit_per_day: int = 10
    resend_api_key: str | None = None
    report_from_email: str | None = None
    report_to_emails: str | None = None
    redis_url: str | None = None
    live_state_redis_enabled: bool = True
    live_state_ttl_seconds: int = 300
    environment: str = "development"
    max_request_body_bytes: int = 2_000_000
    global_rate_limit_per_minute: int = 600
    auth_rate_limit_per_minute: int = 20
    telemetry_rate_limit_per_minute: int = 120
    intelligence_rate_limit_per_minute: int = 90
    ai_rate_limit_per_minute: int = 20
    websocket_ticket_rate_limit_per_minute: int = 30

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        protected_namespaces=("settings_",),
    )

    @model_validator(mode="after")
    def validate_production_secrets(self):
        if not self.database_url.startswith("sqlite") and self.secret_key == DEFAULT_SECRET_KEY:
            raise ValueError("SECRET_KEY must be set to a non-default value for non-SQLite deployments")
        if self.environment.lower() in {"production", "prod"} and self.database_url.startswith("sqlite"):
            raise ValueError("DATABASE_URL must point to Postgres in production")
        if self.environment.lower() in {"production", "prod"} and self.legacy_auth_enabled:
            raise ValueError("LEGACY_AUTH_ENABLED must remain false in production")
        return self

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
