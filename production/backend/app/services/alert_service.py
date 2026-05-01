from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models import Alert, DevicePushToken, NudgeEvent, Telemetry, User, Vehicle
from app.services.firebase_service import send_fcm_notification

CHARGERS = [
    {"name": "Surat Smart Charge Hub", "lat": 21.1702, "lng": 72.8311, "type": "Fast (7.4kW)"},
    {"name": "Althan CPO Station", "lat": 21.1895, "lng": 72.8604, "type": "Fast (7.4kW)"},
    {"name": "Varachha Evify Depot", "lat": 21.2104, "lng": 72.8789, "type": "Slow (3.3kW)"},
    {"name": "Adajan Mall Charging", "lat": 21.1543, "lng": 72.8001, "type": "Fast (7.4kW)"},
]


def nearest_charger(lat: float | None, lng: float | None) -> tuple[str | None, int | None]:
    if lat is None or lng is None:
        return None, None
    best = min(CHARGERS, key=lambda c: (float(c["lat"]) - lat) ** 2 + (float(c["lng"]) - lng) ** 2)
    # Rough Surat-scale conversion, good enough for synthetic alert ranking.
    distance_m = int((((float(best["lat"]) - lat) ** 2 + (float(best["lng"]) - lng) ** 2) ** 0.5) * 111_000)
    return str(best["name"]), distance_m


def maybe_create_charging_alert(db: Session, row: Telemetry) -> Alert | None:
    if row.ignition_on or row.speed >= 3 or row.soc >= 25:
        return None

    existing = (
        db.query(Alert)
        .filter(Alert.vehicle_id == row.vehicle_id, Alert.alert_type == "charging_opportunity", Alert.is_resolved.is_(False))
        .order_by(desc(Alert.created_at))
        .first()
    )
    if existing:
        return existing

    charger, distance_m = nearest_charger(row.lat, row.lng)
    message = "Vehicle is parked with low SOC. Plug in now to recover delivery buffer."
    if charger:
        message = f"Vehicle is parked at {row.soc:.0f}% SOC. Nearest charger: {charger} (~{distance_m}m)."

    alert = Alert(
        vehicle_id=row.vehicle_id,
        driver_id=row.driver_id,
        alert_type="charging_opportunity",
        message=message,
        soc_at_alert=row.soc,
        nearest_charger=charger,
        charger_distance_m=distance_m,
    )
    db.add(alert)
    db.flush()
    db.add(
        NudgeEvent(
            driver_id=row.driver_id,
            vehicle_id=row.vehicle_id,
            alert_id=alert.id,
            nudge_type="charging_opportunity",
            channel="dashboard",
            message=message,
            payload={
                "soc": row.soc,
                "lat": row.lat,
                "lng": row.lng,
                "nearest_charger": charger,
                "charger_distance_m": distance_m,
            },
            status="created",
        )
    )
    _send_alert_push(db, alert, message)
    return alert


def _send_alert_push(db: Session, alert: Alert, message: str) -> None:
    vehicle = db.get(Vehicle, alert.vehicle_id)
    users_query = db.query(User).filter(User.is_active.is_(True))
    if alert.driver_id and vehicle:
        users_query = users_query.filter(
            (User.driver_id == alert.driver_id) | ((User.role == "fleet_operator") & (User.fleet_id == vehicle.fleet_id))
        )
    elif alert.driver_id:
        users_query = users_query.filter(User.driver_id == alert.driver_id)
    elif vehicle:
        users_query = users_query.filter(User.role == "fleet_operator", User.fleet_id == vehicle.fleet_id)

    user_ids = [user.id for user in users_query.all()]
    if not user_ids:
        return

    tokens = [
        row.token
        for row in db.query(DevicePushToken)
        .filter(DevicePushToken.user_id.in_(user_ids), DevicePushToken.is_active.is_(True))
        .all()
    ]
    result = send_fcm_notification(
        tokens=tokens,
        title="Trickee charging alert",
        body=message,
        data={"alert_id": alert.id, "alert_type": alert.alert_type, "vehicle_id": alert.vehicle_id},
    )
    if result.get("sent", 0) > 0:
        db.add(
            NudgeEvent(
                driver_id=alert.driver_id,
                vehicle_id=alert.vehicle_id,
                alert_id=alert.id,
                nudge_type=alert.alert_type,
                channel="fcm",
                message=message,
                payload=result,
                status="sent",
            )
        )
