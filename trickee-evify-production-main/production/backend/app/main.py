import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import admin, alerts, assistant, auth, battery, chargers, drivers, fleet, intelligence, notifications, predictions, routes, telemetry, vehicles, ws
from app.services.ai_engine import FEATURE_COLS, SEQ_LEN, ai_engine
from app.services.security import SecurityMiddleware, http_exception_handler, unhandled_exception_handler
from app.services.ws_manager import manager

settings = get_settings()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

app = FastAPI(title=settings.app_name, version="1.0.0")

app.add_middleware(SecurityMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(vehicles.router, prefix=settings.api_prefix)
app.include_router(drivers.router, prefix=settings.api_prefix)
app.include_router(intelligence.router, prefix=settings.api_prefix)
app.include_router(telemetry.router, prefix=settings.api_prefix)
app.include_router(predictions.router, prefix=settings.api_prefix)
app.include_router(routes.router, prefix=settings.api_prefix)
app.include_router(alerts.router, prefix=settings.api_prefix)
app.include_router(admin.router, prefix=settings.api_prefix)
app.include_router(notifications.router, prefix=settings.api_prefix)
app.include_router(assistant.router, prefix=settings.api_prefix)
app.include_router(battery.router, prefix=settings.api_prefix)
app.include_router(chargers.router, prefix=settings.api_prefix)
app.include_router(fleet.router, prefix=settings.api_prefix)
# WebSocket router is registered without the /api/v1 prefix so the
# endpoint lives at  wss://<host>/ws/live-map  (no version segment).
app.include_router(ws.router)


@app.on_event("startup")
async def startup_live_broadcast() -> None:
    await manager.start_redis_listener(settings.redis_url)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": "V4.1",
        "model_ready": ai_engine.ready,
        "seq_len": SEQ_LEN,
        "feature_count": len(FEATURE_COLS),
        "delta_soc_input": False,
        "version": "1.0.0",
    }
