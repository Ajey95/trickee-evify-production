from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any


CAN_ALIASES = {
    "soc": ["Battery SOC", "SOC", "soc", "BatteryPercentage"],
    "soh": ["SOH", "soH"],
    "battery_voltage": ["Battery Voltage", "battVoltage", "BatteryVoltage", "battery_voltage"],
    "current": ["Battery Current", "battCurrent", "current"],
    "mcu_dc_current": ["MCU DC Current", "mcuDcCurrent"],
    "mcu_speed": ["MCU Speed", "mcuSpeed", "vehicle_speed"],
    "temp_max": ["Max Temperature", "maxTemp", "maximum_temperature", "MCUTemperature"],
    "cycle_count": ["BatteryCycle", "cycleCount", "bms_chargingcycles"],
    "cell_min_mv": ["CellVoltage_Min", "minCellVoltage"],
    "cell_max_mv": ["CellVoltage_Max", "maxCellVoltage"],
    "cell_imbalance_mv": ["cellvoltage_mismatch", "cell_voltage_mismatch", "CellVoltageMismatch"],
    "wh_throughput": ["Wh Throughput", "Throughput", "battEnergy", "throughput"],
    "charge_plug": ["ChargePlugStatus", "chargePlugStatus", "charge_plug_status"],
    "charge_status": ["Battery Charge Status"],
    "regen_status": ["MCU Regen Status", "regen_status"],
    "throttle_status": ["MCU Throttle Status", "throttle_status"],
}


def parse_number(value: Any, default: float = 0.0) -> float:
    if value is None:
        return default
    if isinstance(value, bool):
        return float(value)
    if isinstance(value, int | float):
        return float(value)
    text = str(value).strip()
    if not text:
        return default
    match = re.search(r"-?\d+(?:\.\d+)?", text)
    return float(match.group(0)) if match else default


def parse_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, int | float):
        return bool(value)
    text = str(value).strip().lower()
    return text in {"1", "true", "yes", "on", "charging"}


def parse_time(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value.replace(tzinfo=None)
    if isinstance(value, dict):
        value = value.get("$date") or value.get("date") or value.get("value")
    if not value:
        return datetime.utcnow()
    text = str(value).replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return datetime.utcnow()
    if parsed.tzinfo:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


def _can_dict(payload: dict[str, Any]) -> dict[str, Any]:
    can_data = payload.get("CanData") or payload.get("canData") or []
    if isinstance(can_data, dict):
        return can_data
    can: dict[str, Any] = {}
    for item in can_data:
        if isinstance(item, dict):
            field = item.get("field") or item.get("name") or item.get("Name") or item.get("key")
            if field:
                can[str(field)] = item.get("value") if "value" in item else item.get("Value")
    return can


def _first(payload: dict[str, Any], can: dict[str, Any], aliases: list[str], default: Any = None) -> Any:
    for alias in aliases:
        if alias in payload:
            return payload[alias]
        if alias in can:
            return can[alias]
    return default


def _selected_current(payload: dict[str, Any], can: dict[str, Any]) -> float:
    """Prefer pack current; fall back to MCU DC current when pack current is unusable.

    Evify's latest sample has occasional decoded current spikes above a scooter-scale
    plausible range. We filter those at ingest so one bad CAN frame does not dominate
    power density, voltage sag, alerts, or model input.
    """
    pack_current = parse_number(_first(payload, can, CAN_ALIASES["current"]))
    mcu_current = parse_number(_first(payload, can, CAN_ALIASES["mcu_dc_current"]))
    if 0.05 <= abs(pack_current) <= 150.0:
        return pack_current
    if 0.05 <= abs(mcu_current) <= 150.0:
        return mcu_current
    return 0.0


def _selected_speed(payload: dict[str, Any], can: dict[str, Any]) -> float:
    if "Speed" in payload or "speed" in payload:
        speed = parse_number(payload.get("Speed") if "Speed" in payload else payload.get("speed"), 0.0)
        if speed:
            return speed
    return parse_number(_first(payload, can, CAN_ALIASES["mcu_speed"]), 0.0)


def _selected_temp_max(payload: dict[str, Any], can: dict[str, Any]) -> float:
    direct = parse_number(_first(payload, can, CAN_ALIASES["temp_max"]), 0.0)
    cell_temps = [
        parse_number(value)
        for key, value in {**can, **payload}.items()
        if str(key).lower().startswith("cell_temperature")
    ]
    valid_cell_temps = [value for value in cell_temps if value > 0]
    if direct > 0 and valid_cell_temps:
        return max(direct, *valid_cell_temps)
    if direct > 0:
        return direct
    if valid_cell_temps:
        return max(valid_cell_temps)
    return 30.0


def normalize_evify_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Convert Evify JSON/Mongo-style telemetry into Trickee's canonical fields."""
    can = _can_dict(payload)

    soc = parse_number(_first(payload, can, CAN_ALIASES["soc"], payload.get("soc")))
    soh = parse_number(_first(payload, can, CAN_ALIASES["soh"], payload.get("soH")), 100.0)
    voltage = parse_number(_first(payload, can, CAN_ALIASES["battery_voltage"]))
    current = _selected_current(payload, can)
    temp_max = _selected_temp_max(payload, can)
    cycle_count = int(parse_number(_first(payload, can, CAN_ALIASES["cycle_count"]), 0.0))

    cell_min = parse_number(_first(payload, can, CAN_ALIASES["cell_min_mv"]), 0.0)
    cell_max = parse_number(_first(payload, can, CAN_ALIASES["cell_max_mv"]), 0.0)
    if 0 < cell_min < 10:
        cell_min *= 1000.0
    if 0 < cell_max < 10:
        cell_max *= 1000.0
    direct_cell_imbalance = parse_number(_first(payload, can, CAN_ALIASES["cell_imbalance_mv"]), 0.0)
    cell_imbalance = direct_cell_imbalance or (abs(cell_max - cell_min) if cell_min and cell_max else 0.0)

    return {
        "vehicle_code": payload.get("RegNo") or payload.get("VehicleId") or payload.get("vehicle_id") or payload.get("vehicleCode"),
        "driver_code": payload.get("driverID") or payload.get("driver_id") or payload.get("driverCode"),
        "recorded_at": parse_time(payload.get("eventTime") or payload.get("event_time") or payload.get("DateTimeOfLog") or payload.get("time")),
        "soc": soc,
        "current": current,
        "battery_voltage": voltage,
        "speed": _selected_speed(payload, can),
        "temp_max": temp_max,
        "soh": soh,
        "charge_plug": parse_bool(_first(payload, can, CAN_ALIASES["charge_plug"], False)),
        "ignition_on": parse_bool(payload.get("IgnitionOn") or payload.get("ignition_on")),
        "regen_status": parse_bool(_first(payload, can, CAN_ALIASES["regen_status"], False)),
        "throttle_status": parse_bool(_first(payload, can, CAN_ALIASES["throttle_status"], False)),
        "cycle_count": cycle_count,
        "cell_imbalance_mv": cell_imbalance,
        "wh_throughput": parse_number(_first(payload, can, CAN_ALIASES["wh_throughput"]), 0.0),
        "lat": parse_number(payload.get("Latitude") or payload.get("latitude"), 0.0) or None,
        "lng": parse_number(payload.get("Longitude") or payload.get("longitude"), 0.0) or None,
    }
