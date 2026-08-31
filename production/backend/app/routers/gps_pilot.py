from fastapi import APIRouter, Depends

from app.models import User
from app.schemas.api import ok
from app.services.auth import require_roles
from app.services.gps_pilot_client import fetch_gps_pilot_snapshot

router = APIRouter(prefix="/admin", tags=["gps-pilot"])


@router.get("/gps-pilot")
def gps_pilot_snapshot(_: User = Depends(require_roles("trickee_admin"))):
    return ok(fetch_gps_pilot_snapshot())
