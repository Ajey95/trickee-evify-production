from app.services.charging_decision_engine import choose_charging_option
from app.services.external_context import external_context
from app.services.intelligence_history import persist_charging_decision, persist_order_assignment
from app.services.order_assignment_engine import assign_order
from app.services.wait_time_estimator import estimate_wait_window


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


def test_wait_window_has_chargeable_time():
    result = estimate_wait_window(
        {"lat": 21.17, "lng": 72.83},
        {"lat": 21.18, "lng": 72.84},
        prep_min=12,
    )
    assert result["total_window_min"] >= result["chargeable_min"]
    assert result["chargeable_min"] == 14.0


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
