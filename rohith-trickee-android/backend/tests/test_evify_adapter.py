from app.services.evify_adapter import normalize_evify_payload


def test_latest_evify_can_name_value_payload_is_normalized():
    payload = {
        "RegNo": "GJ05PZ1994",
        "driverID": 4,
        "eventTime": {"$date": "2026-04-25T18:29:39.000Z"},
        "Latitude": 0,
        "Longitude": 0,
        "Speed": 0,
        "IgnitionOn": False,
        "soc": "50 %",
        "soH": "96 %",
        "CanData": [
            {"Name": "Battery Current", "Value": "0.29 A"},
            {"Name": "MCU DC Current", "Value": "508.73 A"},
            {"Name": "Battery Voltage", "Value": "58.90 V"},
            {"Name": "Max Temperature", "Value": "32 °C"},
            {"Name": "BatteryCycle", "Value": "423"},
            {"Name": "CellVoltage_Min", "Value": "3695 mV"},
            {"Name": "CellVoltage_Max", "Value": "3689 mV"},
            {"Name": "MCU Throttle Status", "Value": "1"},
            {"Name": "MCU Regen Status", "Value": "0"},
            {"Name": "Wh Throughput", "Value": "937 kWh"},
        ],
    }

    normalized = normalize_evify_payload(payload)

    assert normalized["vehicle_code"] == "GJ05PZ1994"
    assert normalized["driver_code"] == 4
    assert normalized["current"] == 0.29
    assert normalized["battery_voltage"] == 58.9
    assert normalized["cell_imbalance_mv"] == 6
    assert normalized["lat"] is None
    assert normalized["lng"] is None
    assert normalized["speed"] == 0
    assert normalized["throttle_status"] is True
    assert normalized["regen_status"] is False


def test_current_falls_back_to_sane_mcu_current_when_pack_current_spikes():
    payload = {
        "RegNo": "GJ05PZ1903",
        "eventTime": {"$date": "2026-04-25T18:29:39.000Z"},
        "CanData": [
            {"Name": "Battery Current", "Value": "641.24 A"},
            {"Name": "MCU DC Current", "Value": "34.31 A"},
            {"Name": "Battery Voltage", "Value": "60.90 V"},
        ],
    }

    normalized = normalize_evify_payload(payload)

    assert normalized["current"] == 34.31
