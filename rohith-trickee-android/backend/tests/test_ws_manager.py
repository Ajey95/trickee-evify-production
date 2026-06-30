import asyncio

from app.services.ws_manager import ConnectionManager, ConnectionScope


def test_live_vehicle_point_scope_respects_role_and_selected_driver():
    manager = ConnectionManager()
    point = {"driver_id": "driver-1", "fleet_id": "fleet-1"}

    assert manager._can_receive(
        ConnectionScope(user_id="admin", role="trickee_admin", fleet_id=None, driver_id=None),
        point,
    )
    assert manager._can_receive(
        ConnectionScope(user_id="fleet-user", role="fleet_operator", fleet_id="fleet-1", driver_id=None),
        point,
    )
    assert not manager._can_receive(
        ConnectionScope(user_id="other-fleet", role="fleet_operator", fleet_id="fleet-2", driver_id=None),
        point,
    )
    assert manager._can_receive(
        ConnectionScope(user_id="driver-user", role="driver", fleet_id="fleet-1", driver_id="driver-1"),
        point,
    )
    assert not manager._can_receive(
        ConnectionScope(user_id="other-driver", role="driver", fleet_id="fleet-1", driver_id="driver-2"),
        point,
    )
    assert not manager._can_receive(
        ConnectionScope(
            user_id="filtered",
            role="trickee_admin",
            fleet_id=None,
            driver_id=None,
            selected_driver_id="driver-2",
        ),
        point,
    )


def test_live_vehicle_point_publish_is_scheduled_without_blocking():
    async def run_case():
        manager = ConnectionManager()
        calls = []

        async def fake_publish(point, redis_url=None):
            calls.append((point, redis_url))

        manager.publish_vehicle_point = fake_publish
        manager.schedule_vehicle_point_publish({"vehicle_id": "vehicle-1"}, "redis://example")
        await asyncio.sleep(0)

        assert calls == [({"vehicle_id": "vehicle-1"}, "redis://example")]

    asyncio.run(run_case())


def test_live_vehicle_point_publish_writes_live_state_before_broadcast(monkeypatch):
    async def run_case():
        manager = ConnectionManager()
        calls = []

        async def fake_store(point, redis_url=None):
            calls.append(("store", point, redis_url))

        async def fake_broadcast(point):
            calls.append(("broadcast", point, None))

        monkeypatch.setattr("app.services.ws_manager.store_live_vehicle_point", fake_store)
        manager.broadcast_vehicle_point = fake_broadcast

        await manager.publish_vehicle_point({"vehicle_id": "vehicle-1"}, "redis://example")

        assert calls == [
            ("store", {"vehicle_id": "vehicle-1"}, "redis://example"),
            ("broadcast", {"vehicle_id": "vehicle-1"}, None),
        ]

    asyncio.run(run_case())
