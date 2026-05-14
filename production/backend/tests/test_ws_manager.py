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
