import asyncio
from datetime import datetime, timedelta

from starlette.requests import Request

from app.models import (
    AIInteractionLog,
    AssistantMessage,
    Fleet,
    Driver,
    MobileChargingSession,
    MobileIssueEvent,
    MobileLocationPoint,
    MobileTripSession,
    MobileWaitEvent,
    Telemetry,
    User,
    Vehicle,
)
from app.services.mobile import resolve_destination_text
from app.routers.mobile import (
    ChargingStartRequest,
    IssueRequest,
    LocationPingRequest,
    TripStartRequest,
    VoiceCopilotRequest,
    WaitingEndRequest,
    WaitingStartRequest,
    record_location,
    start_charging,
    start_trip,
    start_waiting,
    voice_copilot,
    end_waiting,
    create_issue,
)


def _seed_driver(db_session):
    fleet = Fleet(name="Pilot Fleet", city="Surat")
    driver = Driver(fleet=fleet, driver_code="DRV-1", full_name="Pilot Rider")
    vehicle = Vehicle(fleet=fleet, vehicle_code="EV-1")
    user = User(
        email="driver@example.com",
        full_name="Pilot Rider",
        role="driver",
        driver=driver,
        fleet=fleet,
        auth_provider="supabase",
    )
    latest = Telemetry(
        vehicle=vehicle,
        driver=driver,
        recorded_at=datetime(2026, 5, 29, 10, 0, 0),
        soc=64.0,
        current=3.0,
        battery_voltage=52.0,
        speed=18.0,
        temp_max=33.0,
        soh=97.0,
        lat=21.1702,
        lng=72.8311,
    )
    db_session.add_all([fleet, driver, vehicle, user, latest])
    db_session.commit()
    return user, driver, vehicle


def _request(path="/api/v1/mobile/test"):
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": path,
            "headers": [],
            "client": ("testclient", 50000),
            "server": ("testserver", 80),
            "scheme": "http",
        }
    )


def test_mobile_trip_start_is_driver_scoped_and_idempotent(db_session):
    user, _, vehicle = _seed_driver(db_session)
    response = asyncio.run(
        start_trip(
            TripStartRequest(
                destination_text="Go to Phoenix Marketcity",
                origin={"lat": 21.17, "lng": 72.83},
                idempotency_key="trip-1",
            ),
            _request("/api/v1/mobile/trips/start"),
            db_session,
            user,
        )
    )
    data = response["data"]
    assert data["vehicle_id"] == vehicle.id
    assert data["destination_text"] == "Phoenix Marketcity"
    assert data["status"] == "active"

    duplicate = asyncio.run(
        start_trip(
            TripStartRequest(destination_text="Different", idempotency_key="trip-1"),
            _request("/api/v1/mobile/trips/start"),
            db_session,
            user,
        )
    )
    assert duplicate["data"]["id"] == data["id"]
    assert db_session.query(MobileTripSession).count() == 1


def test_mobile_location_is_stored_separately_from_vehicle_telemetry(db_session):
    user, _, vehicle = _seed_driver(db_session)
    before = db_session.query(Telemetry).count()
    response = asyncio.run(
        record_location(
            LocationPingRequest(
                lat=21.171,
                lng=72.832,
                accuracy_m=12,
                speed_mps=4.5,
                battery_pct=81,
                tracking_state="trip_active",
                idempotency_key="loc-1",
            ),
            _request("/api/v1/mobile/location"),
            db_session,
            user,
        )
    )
    data = response["data"]
    assert data["vehicle_id"] == vehicle.id
    assert data["source"] == "android_app"
    assert db_session.query(MobileLocationPoint).count() == 1
    assert db_session.query(Telemetry).count() == before


def test_charging_waiting_and_issue_events_attach_to_active_trip(db_session):
    user, _, _ = _seed_driver(db_session)
    trip_id = asyncio.run(
        start_trip(
            TripStartRequest(destination_text="HSR Layout", idempotency_key="trip-flow"),
            _request("/api/v1/mobile/trips/start"),
            db_session,
            user,
        )
    )["data"]["id"]

    wait = asyncio.run(
        start_waiting(
            WaitingStartRequest(
                trip_session_id=trip_id,
                location={"lat": 21.18, "lng": 72.84},
                wait_type="restaurant_pickup",
                idempotency_key="wait-1",
            ),
            _request("/api/v1/mobile/waiting/start"),
            db_session,
            user,
        )
    )["data"]
    assert wait["trip_session_id"] == trip_id
    assert wait["wait_type"] == "restaurant_pickup"

    ended_wait = asyncio.run(
        end_waiting(
            WaitingEndRequest(
                wait_event_id=wait["id"],
                ended_at=datetime.utcnow() + timedelta(minutes=7),
            ),
            _request("/api/v1/mobile/waiting/end"),
            db_session,
            user,
        )
    )["data"]
    assert ended_wait["duration_seconds"] > 0

    charging = asyncio.run(
        start_charging(
            ChargingStartRequest(
                trip_session_id=trip_id,
                location={"lat": 21.19, "lng": 72.85},
                soc_start=32,
                idempotency_key="charge-1",
            ),
            _request("/api/v1/mobile/charging/start"),
            db_session,
            user,
        )
    )["data"]
    assert charging["trip_session_id"] == trip_id
    assert charging["soc_start"] == 32

    issue = asyncio.run(
        create_issue(
            IssueRequest(
                trip_session_id=trip_id,
                issue_type="low_battery",
                message="Need charger",
                location={"lat": 21.2, "lng": 72.86},
                idempotency_key="issue-1",
            ),
            _request("/api/v1/mobile/issues"),
            db_session,
            user,
        )
    )["data"]
    assert issue["trip_session_id"] == trip_id
    assert issue["status"] == "open"
    assert db_session.query(MobileWaitEvent).count() == 1
    assert db_session.query(MobileChargingSession).count() == 1
    assert db_session.query(MobileIssueEvent).count() == 1


def test_voice_destination_resolution_keeps_uncertain_results_explicit():
    result = resolve_destination_text("Go to Phoenix Marketcity")
    assert result["destination_text"] == "Phoenix Marketcity"
    assert result["confidence"] >= 0.7
    assert result["map_resolution_status"] == "pending_backend_geocoder"

    unclear = resolve_destination_text("go")
    assert unclear["needs_confirmation"] is True


def test_voice_copilot_routes_to_grounded_assistant(db_session):
    user, _, _ = _seed_driver(db_session)
    response = asyncio.run(
        voice_copilot(
            VoiceCopilotRequest(
                transcript="What is my battery status?",
                current_location={"lat": 21.1702, "lng": 72.8311},
            ),
            _request("/api/v1/mobile/voice/copilot"),
            db_session,
            user,
        )
    )["data"]
    assert response["orchestrator_agent"] == "driver_copilot_orchestrator"
    assert response["specialist_agent"] == "battery_guard_agent"
    assert response["voice_response"]
    assert response["destination_resolution"]["intent"] == "start_trip"


def test_voice_copilot_uses_fresh_mobile_context_for_live_status(db_session):
    user, _, _ = _seed_driver(db_session)

    response = asyncio.run(
        voice_copilot(
            VoiceCopilotRequest(
                transcript="What speed am I doing now?",
                current_location={"lat": 21.1702, "lng": 72.8311},
                live_context={
                    "speed_kmh": 42.0,
                    "soc": 63.0,
                    "recorded_at": "2026-05-29T10:01:00Z",
                },
            ),
            _request("/api/v1/mobile/voice/copilot"),
            db_session,
            user,
        )
    )["data"]

    assert response["intent"] == "LIVE_VEHICLE_STATUS"
    assert "42 km/h" in response["voice_response"]
    assert response["fallback_used"] is True
    assert response["data_freshness"]["live_context_recorded_at"] == "2026-05-29T10:01:00Z"


def test_voice_copilot_grounds_driver_performance_questions(db_session):
    user, _, _ = _seed_driver(db_session)

    response = asyncio.run(
        voice_copilot(
            VoiceCopilotRequest(transcript="How was my driving today?"),
            _request("/api/v1/mobile/voice/copilot"),
            db_session,
            user,
        )
    )["data"]

    assert response["intent"] == "DRIVER_PERFORMANCE"
    assert set(response["tools_called"]) >= {
        "get_driver_profile",
        "get_driver_baseline",
        "get_trip_history",
        "get_vehicle_state",
    }
    assert db_session.query(AIInteractionLog).filter(AIInteractionLog.feature == "assistant").count() == 1
    assert db_session.query(AssistantMessage).filter(AssistantMessage.channel == "voice").count() == 1
