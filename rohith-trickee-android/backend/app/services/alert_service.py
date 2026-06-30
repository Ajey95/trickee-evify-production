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


def maybe_create_driver_risk_alert(db: Session, row: Telemetry) -> Alert | None:
    risk_reasons: list[str] = []
    if row.soc < 15:
        risk_reasons.append(f"critical SOC {row.soc:.0f}%")
    elif row.soc < 20:
        risk_reasons.append(f"low SOC {row.soc:.0f}%")
    if row.current >= 18:
        risk_reasons.append(f"high current draw {row.current:.1f}A")
    if row.temp_max >= 58:
        risk_reasons.append(f"high battery temperature {row.temp_max:.0f}C")

    if not risk_reasons:
        return None

    existing = (
        db.query(Alert)
        .filter(Alert.vehicle_id == row.vehicle_id, Alert.alert_type == "driver_risk", Alert.is_resolved.is_(False))
        .order_by(desc(Alert.created_at))
        .first()
    )
    if existing:
        return existing

    message = f"Driver risk detected: {', '.join(risk_reasons)}. Fleet operator should review route/charging plan."
    alert = Alert(
        vehicle_id=row.vehicle_id,
        driver_id=row.driver_id,
        alert_type="driver_risk",
        message=message,
        soc_at_alert=row.soc,
    )
    db.add(alert)
    db.flush()
    db.add(
        NudgeEvent(
            driver_id=row.driver_id,
            vehicle_id=row.vehicle_id,
            alert_id=alert.id,
            nudge_type="driver_risk",
            channel="dashboard",
            message=message,
            payload={
                "soc": row.soc,
                "current": row.current,
                "temp_max": row.temp_max,
                "lat": row.lat,
                "lng": row.lng,
                "risk_reasons": risk_reasons,
            },
            status="created",
        )
    )
    _send_alert_push(db, alert, message)
    return alert


def _alert_personalization_type(alert: Alert) -> str:
    if alert.alert_type == "charging_opportunity":
        return "charging_opportunity"
    if alert.soc_at_alert is not None and alert.soc_at_alert < 25:
        return "low_soc"
    if alert.alert_type == "driver_risk":
        return "driving_coaching"
    return "route_change"


def _alert_severity(alert: Alert) -> str:
    if alert.soc_at_alert is not None and alert.soc_at_alert < 12:
        return "critical"
    if alert.soc_at_alert is not None and alert.soc_at_alert < 20:
        return "high"
    if alert.alert_type == "driver_risk":
        return "high"
    return "medium"


def _personalized_alert_message(db: Session, alert: Alert, fallback_message: str, user: User) -> tuple[str, str, bool]:
    # Local imports avoid a module cycle because the AI tool registry imports
    # external context, and external context imports charger constants here.
    from app.models import NotificationPersonalizationLog
    from app.services.ai import AIToolRegistry, llm_client
    from app.services.ai.safety import sanitize_payload, sanitize_text

    alert_type = _alert_personalization_type(alert)
    severity = _alert_severity(alert)
    tone = {"low": "calm", "medium": "helpful", "high": "urgent", "critical": "critical"}[severity]
    registry = AIToolRegistry(db, user, feature="alert_fcm_personalization")
    tools = []
    if alert.driver_id:
        tools.append(registry.call("get_driver_profile", {"driver_id": alert.driver_id}))
    tools.extend(
        [
            registry.call("get_battery_prediction", {"vehicle_id": alert.vehicle_id}),
            registry.call("get_vehicle_state", {"vehicle_id": alert.vehicle_id}),
        ]
    )
    if alert_type == "charging_opportunity":
        state = (tools[-1].data.get("latest") or {}) if tools[-1].success else {}
        if state.get("lat") is not None and state.get("lng") is not None and alert.driver_id:
            tools.append(
                registry.call(
                    "get_nearest_charger",
                    {"driver_id": alert.driver_id, "lat": state["lat"], "lng": state["lng"], "radius_m": 2000},
                )
            )
    facts = {tool.name: tool.data for tool in tools if tool.success}
    result = llm_client.compose(
        feature="alert_fcm_personalization",
        system="Write one short EV driver/fleet push notification. Backend already decided severity and action. Use only tool facts.",
        facts={
            "alert": {
                "type": alert_type,
                "severity": severity,
                "action": fallback_message,
                "alert_id": alert.id,
                "vehicle_id": alert.vehicle_id,
                "driver_id": alert.driver_id,
            },
            "tool_facts": facts,
            "tone": tone,
        },
        fallback=sanitize_text(fallback_message, max_chars=220),
        max_sentences=2,
        max_tokens=120,
    )
    llm_client.record(
        db,
        user=user,
        feature="alert_fcm_personalization",
        result=result,
        driver_id=alert.driver_id,
        vehicle_id=alert.vehicle_id,
        tool_calls=[tool.name for tool in tools],
    )
    db.add(
        NotificationPersonalizationLog(
            user_id=user.id,
            driver_id=alert.driver_id,
            vehicle_id=alert.vehicle_id,
            alert_type=alert_type,
            severity=severity,
            action=sanitize_text(fallback_message, max_chars=240),
            message=result.text,
            tone=tone,
            send=True,
            fallback_used=result.fallback_used,
            raw_data_summary=sanitize_payload({"alert_id": alert.id, "source": "alert_fcm"}),
        )
    )
    return result.text, tone, result.fallback_used


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

    users = users_query.all()
    user_ids = [user.id for user in users]
    if not user_ids:
        return

    tokens = [
        row.token
        for row in db.query(DevicePushToken)
        .filter(DevicePushToken.user_id.in_(user_ids), DevicePushToken.is_active.is_(True))
        .all()
    ]
    if not tokens:
        return

    push_message = message
    tone = "helpful"
    fallback_used = True
    try:
        push_message, tone, fallback_used = _personalized_alert_message(db, alert, message, users[0])
    except Exception:
        push_message = message

    result = send_fcm_notification(
        tokens=tokens,
        title="Trickee charging alert",
        body=push_message,
        data={"alert_id": alert.id, "alert_type": alert.alert_type, "vehicle_id": alert.vehicle_id},
    )
    db.add(
        NudgeEvent(
            driver_id=alert.driver_id,
            vehicle_id=alert.vehicle_id,
            alert_id=alert.id,
            nudge_type=alert.alert_type,
            channel="fcm",
            message=push_message,
            payload={**result, "tone": tone, "fallback_used": fallback_used},
            status="sent" if result.get("sent", 0) > 0 else "failed",
        )
    )
