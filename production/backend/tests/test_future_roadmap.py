from app.services.charging_decision_engine import choose_charging_option
from app.services.external_context import external_context
from app.services.intelligence_history import persist_charging_decision, persist_order_assignment
from app.services.live_intelligence import fleet_live_overview, live_driver_decision, live_map_context, weekly_live_metrics
from app.services.live_driver_profile import classify_driver_archetype, detect_soc_rise_charging, live_driver_profile
from app.services.order_assignment_engine import assign_order
from app.services.route_scorer import route_scores
from app.services.wait_time_estimator import estimate_wait_window
from app.services.weekly_report import generate_weekly_report, send_weekly_report_email
from app.models import Driver, Fleet, Telemetry, Vehicle
from datetime import datetime, timedelta


def test_route_context_fallback_without_external_keys():
    context = external_context.route_context(
        {"lat": 21.17, "lng": 72.83},
        {"lat": 21.19, "lng": 72.86},
    )
    assert "weather" in context
    assert "traffic" in context
    assert context["traffic"]["distance_km"] > 0


def test_order_assignment_prefers_low_soc_when_wait_is_useful():
    result = assign_order(
        [
            {"driver_id": "D1", "soc": 80, "current_range_km": 60, "efficiency_score": 0.9},
            {"driver_id": "D2", "soc": 24, "current_range_km": 45, "efficiency_score": 0.6},
        ],
        {"delivery_distance_km": 8, "restaurant_wait_min": 20},
    )
    assert result["assigned_driver"]["driver_id"] == "D2"


def test_order_assignment_can_use_driver_archetype_hint():
    result = assign_order(
        [
            {
                "driver_id": "D1",
                "soc": 34,
                "current_range_km": 45,
                "efficiency_score": 0.7,
                "archetype": {"label": "stop_wait_optimizer"},
            },
            {"driver_id": "D2", "soc": 32, "current_range_km": 45, "efficiency_score": 0.7},
        ],
        {"delivery_distance_km": 8, "restaurant_wait_min": 20},
    )

    assert result["assigned_driver"]["driver_id"] == "D1"
    assert result["assigned_driver"]["strategy"] == "stop_wait_optimizer_charging"


def test_wait_window_has_chargeable_time():
    result = estimate_wait_window(
        {"lat": 21.17, "lng": 72.83},
        {"lat": 21.18, "lng": 72.84},
        prep_min=12,
    )
    assert result["total_window_min"] >= result["chargeable_min"]
    assert result["chargeable_min"] == 14.0


def test_route_scoring_marks_zero_soc_routes_infeasible():
    result = route_scores("weekday", "morning", personal_factor=1.1, soc_start=0)

    assert result["route_status"] == "charge_required"
    assert result["all_routes_infeasible"] is True
    assert all(route["is_feasible"] is False for route in result["ranked_routes"])
    assert result["recommended_route"] is None
    assert result["best_informational_route"]["feasibility_reason"] == "SOC is 0%; charge before route scoring."
    assert "Charge for" in result["nudge"]["message"]
    assert result["nudge"]["destination_charge_plan"]["needed"] is True
    assert result["nudge"]["destination_charge_plan"]["charge_minutes"] > 0
    assert "destination_charge_plan" in result["best_informational_route"]


def test_route_scoring_uses_selected_origin_destination():
    result = route_scores(
        "weekday",
        "morning",
        personal_factor=1.1,
        soc_start=80,
        origin={"lat": 21.1702, "lng": 72.8311},
        destination={"lat": 21.2131, "lng": 72.8708},
        origin_label="Ring Road Depot",
        dest_label="Varachha Pickup",
    )

    names = {route["name"] for route in result["ranked_routes"]}
    assert result["route_source"] == "selected_points"
    assert result["recommended_route"] is not None
    assert "EV-Safe Bypass" in names
    assert "Surat-Dumas Road" not in names


def test_charging_decision_returns_valid_option():
    result = choose_charging_option(
        {"soc": 22, "location": {"lat": 21.17, "lng": 72.831}},
        {
            "restaurant_location": {"lat": 21.1702, "lng": 72.8311},
            "customer_location": {"lat": 21.18, "lng": 72.84},
            "delivery_distance_km": 7,
            "restaurant_wait_min": 18,
        },
    )
    assert result["chosen_option"] in {"OPTION_A", "OPTION_B", "OPTION_C"}


def test_intelligence_history_records_are_persistable(db_session):
    class UserStub:
        fleet_id = "fleet-1"

    assignment = assign_order(
        [{"driver_id": "D2", "soc": 24, "current_range_km": 45, "efficiency_score": 0.6}],
        {"order_id": "O1", "delivery_distance_km": 8, "restaurant_wait_min": 20},
    )
    order_record = persist_order_assignment(
        db_session,
        user=UserStub(),
        available_drivers=[{"driver_id": "D2", "soc": 24, "current_range_km": 45, "efficiency_score": 0.6}],
        order={"order_id": "O1", "delivery_distance_km": 8, "restaurant_wait_min": 20},
        result=assignment,
    )
    charging = choose_charging_option(
        {"driver_id": "D2", "soc": 22, "location": {"lat": 21.17, "lng": 72.831}},
        {
            "order_id": "O1",
            "restaurant_location": {"lat": 21.1702, "lng": 72.8311},
            "delivery_distance_km": 7,
            "restaurant_wait_min": 18,
        },
    )
    charging_record = persist_charging_decision(
        db_session,
        driver={"driver_id": "D2", "soc": 22, "location": {"lat": 21.17, "lng": 72.831}},
        order={"order_id": "O1"},
        result=charging,
    )

    assert order_record.order_id == "O1"
    assert charging_record.chosen_option in {"OPTION_A", "OPTION_B", "OPTION_C"}


def test_soc_rise_charging_detection():
    now = datetime.utcnow()
    prev = Telemetry(vehicle_id="v1", driver_id="d1", recorded_at=now, soc=40, current=2, battery_voltage=50, speed=0, temp_max=35, soh=95)
    row = Telemetry(vehicle_id="v1", driver_id="d1", recorded_at=now + timedelta(minutes=20), soc=43.2, current=-1, battery_voltage=51, speed=0, temp_max=35, soh=95)

    result = detect_soc_rise_charging(prev, row)

    assert result is not None
    assert result["method"] == "soc_rise"
    assert result["delta_soc"] == 3.2


def test_driver_archetype_classifier_uses_live_metrics_and_baseline():
    driver = Driver(driver_code="D2")

    baseline = classify_driver_archetype(
        driver=driver,
        sample_count=1,
        avg_current_a=4.0,
        regen_ratio_pct=12.0,
        low_soc_pct=0.0,
        stop_wait_pct=0.0,
        thermal_load="low",
        avg_temp_c=35.0,
        battery_risk_score=10,
        soc_rise_event_count=0,
        gps_coverage_pct=100.0,
    )
    assert baseline["label"] == "late_charger"
    assert baseline["source"] == "baseline_seed"

    live = classify_driver_archetype(
        driver=driver,
        sample_count=80,
        avg_current_a=13.2,
        regen_ratio_pct=12.0,
        low_soc_pct=8.0,
        stop_wait_pct=20.0,
        thermal_load="low",
        avg_temp_c=42.0,
        battery_risk_score=48,
        soc_rise_event_count=1,
        gps_coverage_pct=90.0,
    )
    assert live["label"] == "aggressive_drainer"
    assert live["policy"]["route_buffer_multiplier"] > 1.0


def test_live_driver_profile_summarizes_recent_telemetry(db_session):
    fleet = Fleet(name="Evify", city="Surat")
    db_session.add(fleet)
    db_session.flush()
    driver = Driver(fleet_id=fleet.id, driver_code="D2", full_name="Driver 2")
    vehicle = Vehicle(fleet_id=fleet.id, vehicle_code="GJ05PZ1903")
    db_session.add_all([driver, vehicle])
    db_session.flush()
    now = datetime.utcnow()
    rows = [
        Telemetry(vehicle_id=vehicle.id, driver_id=driver.id, recorded_at=now, soc=28, current=5, battery_voltage=50, speed=12, temp_max=48, soh=95, lat=21.17, lng=72.83, regen_status=False, throttle_status=True, ignition_on=True),
        Telemetry(vehicle_id=vehicle.id, driver_id=driver.id, recorded_at=now + timedelta(minutes=5), soc=18, current=7, battery_voltage=49, speed=1, temp_max=50, soh=95, lat=21.171, lng=72.831, regen_status=True, throttle_status=False, ignition_on=True),
        Telemetry(vehicle_id=vehicle.id, driver_id=driver.id, recorded_at=now + timedelta(minutes=10), soc=21, current=-1, battery_voltage=51, speed=0, temp_max=49, soh=95, lat=21.172, lng=72.832, regen_status=False, throttle_status=False, ignition_on=False),
    ]
    db_session.add_all(rows)
    db_session.commit()

    profile = live_driver_profile(db_session, driver)

    assert profile["profile_status"] == "live_with_baseline"
    assert profile["charging"]["soc_rise_events"] == 1
    assert profile["battery"]["low_soc_events"] == 1
    assert profile["location"]["gps_coverage_pct"] == 100.0
    assert profile["archetype"]["label"] == "late_charger"


def test_live_profile_does_not_hardcode_vehicle_exclusions(db_session):
    fleet = Fleet(name="Evify", city="Surat")
    db_session.add(fleet)
    db_session.flush()
    driver = Driver(fleet_id=fleet.id, driver_code="D2", full_name="Driver 2")
    vehicle = Vehicle(fleet_id=fleet.id, vehicle_code="GJ05PZ1856")
    db_session.add_all([driver, vehicle])
    db_session.flush()
    db_session.add(
        Telemetry(
            vehicle_id=vehicle.id,
            driver_id=driver.id,
            recorded_at=datetime.utcnow(),
            soc=8,
            current=1,
            battery_voltage=48,
            speed=0,
            temp_max=40,
            soh=90,
            lat=0,
            lng=0,
        )
    )
    db_session.commit()

    profile = live_driver_profile(db_session, driver)

    assert profile["profile_status"] == "live_with_baseline"
    assert profile["baseline_seed"]["avg_speed_kmph"] == 12.4
    assert profile["latest"]["vehicle_id"] == vehicle.id
    assert profile["data_quality"]["excluded_vehicle_codes"] == []


def test_live_decision_returns_range_wait_charge_and_nudge(db_session):
    fleet = Fleet(name="Evify", city="Surat")
    db_session.add(fleet)
    db_session.flush()
    driver = Driver(fleet_id=fleet.id, driver_code="D4", full_name="Driver 4", personal_factor=1.1)
    vehicle = Vehicle(fleet_id=fleet.id, vehicle_code="GJ05PZ1994")
    db_session.add_all([driver, vehicle])
    db_session.flush()
    db_session.add(
        Telemetry(
            vehicle_id=vehicle.id,
            driver_id=driver.id,
            recorded_at=datetime.utcnow(),
            soc=18,
            current=4,
            battery_voltage=49,
            speed=0,
            temp_max=44,
            soh=96,
            ignition_on=False,
            lat=21.1701,
            lng=72.8310,
        )
    )
    db_session.commit()

    decision = live_driver_decision(db_session, driver, destination={"lat": 21.18, "lng": 72.84})

    assert decision["personalized_range"]["estimated_range_km"] >= 0
    assert decision["wait_classification"]["is_wait"] is True
    assert decision["charging_recommendation"]["action"] in {"charge_now", "charge_during_wait", "detour_to_charger"}
    assert decision["route_recommendation"]["personalized_eta_min"] >= decision["route_recommendation"]["traffic_duration_min"]
    assert "destination_charge_plan" in decision["route_recommendation"]
    assert "Destination needs" in decision["route_recommendation"]["destination_charge_plan"]["message"]
    assert decision["driver_nudge"]["message"]


def test_fleet_map_and_weekly_report_are_scoped_and_deterministic(db_session, monkeypatch):
    class UserStub:
        role = "fleet_operator"
        fleet_id = None
        driver_id = None

    class ReportSettingsStub:
        groq_api_key = None
        groq_model = "test-model"
        resend_api_key = None
        report_from_email = None
        external_api_timeout_seconds = 1.0

        @property
        def report_to_email_list(self):
            return []

    monkeypatch.setattr("app.services.weekly_report.get_settings", lambda: ReportSettingsStub())

    fleet = Fleet(name="Evify", city="Surat")
    db_session.add(fleet)
    db_session.flush()
    user = UserStub()
    user.fleet_id = fleet.id
    driver = Driver(fleet_id=fleet.id, driver_code="D5", full_name="Driver 5")
    vehicle = Vehicle(fleet_id=fleet.id, vehicle_code="GJ05PZ2370")
    db_session.add_all([driver, vehicle])
    db_session.flush()
    db_session.add(
        Telemetry(
            vehicle_id=vehicle.id,
            driver_id=driver.id,
            recorded_at=datetime.utcnow(),
            soc=32,
            current=5,
            battery_voltage=50,
            speed=1,
            temp_max=52,
            soh=95,
            ignition_on=True,
            lat=21.1895,
            lng=72.8604,
        )
    )
    db_session.commit()

    fleet_live = fleet_live_overview(db_session, user)
    map_context = live_map_context(db_session, user)
    metrics = weekly_live_metrics(db_session, user)
    report = generate_weekly_report(metrics)
    delivery = send_weekly_report_email(metrics, report)

    assert fleet_live["summary"]["total_drivers"] == 1
    assert map_context["vehicle_points"]
    assert metrics["driver_count"] == 1
    assert report["narrative"]
    assert delivery["email_status"] == "not_configured"
