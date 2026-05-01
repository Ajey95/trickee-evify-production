from datetime import datetime, timedelta

from app.models import Driver, Fleet, Telemetry, Vehicle, WaitEvent
from app.services.wait_classifier import classify_wait, update_wait_event
from app.services.wait_time_estimator import estimate_wait_window


def _telemetry(vehicle_id: str, driver_id: str, **overrides):
    values = {
        "vehicle_id": vehicle_id,
        "driver_id": driver_id,
        "recorded_at": datetime(2026, 4, 29, 10, 0, 0),
        "soc": 55.0,
        "current": 0.0,
        "battery_voltage": 57.0,
        "speed": 0.0,
        "temp_max": 31.0,
        "soh": 95.0,
        "charge_plug": False,
        "ignition_on": True,
        "regen_status": False,
        "throttle_status": False,
        "cycle_count": 10,
        "cell_imbalance_mv": 4.0,
        "wh_throughput": 0.0,
        "lat": 21.1701,
        "lng": 72.8310,
    }
    values.update(overrides)
    return Telemetry(**values)


def test_wait_classifier_detects_restaurant_wait_from_geofence():
    row = _telemetry("vehicle-1", "driver-1", speed=0.5, ignition_on=True)
    result = classify_wait(row)

    assert result["wait_type"] == "restaurant_wait"
    assert result["is_wait"] is True
    assert result["restaurant_distance_m"] <= 120


def test_wait_classifier_detects_traffic_wait_away_from_restaurant():
    row = _telemetry("vehicle-1", "driver-1", speed=0.0, ignition_on=True, lat=21.25, lng=72.95)
    result = classify_wait(row)

    assert result["wait_type"] == "traffic_wait"
    assert result["is_wait"] is True


def test_wait_classifier_detects_charging_wait_from_plug():
    row = _telemetry("vehicle-1", "driver-1", speed=0.0, ignition_on=False, charge_plug=True)
    result = classify_wait(row)

    assert result["wait_type"] == "charging_wait"
    assert result["is_wait"] is True


def test_wait_event_persists_and_extends_current_stop(db_session):
    fleet = Fleet(id="fleet-1", name="Evify", city="Surat")
    vehicle = Vehicle(id="vehicle-1", fleet_id=fleet.id, vehicle_code="GJ05TEST")
    driver = Driver(id="driver-1", fleet_id=fleet.id, driver_code="D1", full_name="Driver 1")
    db_session.add_all([fleet, vehicle, driver])
    db_session.flush()

    first = _telemetry(vehicle.id, driver.id, recorded_at=datetime(2026, 4, 29, 10, 0, 0))
    second = _telemetry(vehicle.id, driver.id, recorded_at=datetime(2026, 4, 29, 10, 4, 0))
    db_session.add(first)
    db_session.flush()
    update_wait_event(db_session, first)
    db_session.add(second)
    db_session.flush()
    event = update_wait_event(db_session, second)

    assert db_session.query(WaitEvent).count() == 1
    assert event.wait_type == "restaurant_wait"
    assert event.duration_seconds == int(timedelta(minutes=4).total_seconds())


def test_wait_estimator_marks_traffic_wait_not_useful_for_charging():
    result = estimate_wait_window(
        {"lat": 21.25, "lng": 72.95},
        {"lat": 21.1701, "lng": 72.8310},
        prep_min=12,
        current_speed_kmph=0,
        ignition_on=True,
        current_stop_duration_min=5,
    )

    assert result["wait_type"] == "traffic_wait"
    assert result["useful_for_charging"] is False


def test_wait_estimator_adds_observed_restaurant_stop_to_chargeable_time():
    result = estimate_wait_window(
        {"lat": 21.1701, "lng": 72.8310},
        {"lat": 21.1701, "lng": 72.8310},
        prep_min=12,
        current_speed_kmph=0,
        ignition_on=True,
        current_stop_duration_min=5,
    )

    assert result["wait_type"] == "restaurant_wait"
    assert result["chargeable_min"] == 19.0
    assert result["useful_for_charging"] is True
