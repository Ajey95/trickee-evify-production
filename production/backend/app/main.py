from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import admin, alerts, auth, drivers, intelligence, predictions, routes, telemetry, vehicles, ws
from app.services.ai_engine import FEATURE_COLS, SEQ_LEN, ai_engine

settings = get_settings()

app = FastAPI(title=settings.app_name, version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(vehicles.router, prefix=settings.api_prefix)
app.include_router(drivers.router, prefix=settings.api_prefix)
app.include_router(intelligence.router, prefix=settings.api_prefix)
app.include_router(telemetry.router, prefix=settings.api_prefix)
app.include_router(predictions.router, prefix=settings.api_prefix)
app.include_router(routes.router, prefix=settings.api_prefix)
app.include_router(alerts.router, prefix=settings.api_prefix)
app.include_router(admin.router, prefix=settings.api_prefix)
# WebSocket router is registered without the /api/v1 prefix so the
# endpoint lives at  wss://<host>/ws/live-map  (no version segment).
app.include_router(ws.router)


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
