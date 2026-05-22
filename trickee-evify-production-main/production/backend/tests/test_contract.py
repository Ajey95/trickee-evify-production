from app.services.ai_engine import FEATURE_COLS, SEQ_LEN


def test_delta_soc_is_not_an_input_feature():
    assert "delta_soc" not in FEATURE_COLS


def test_v4_1_feature_contract():
    assert SEQ_LEN == 20
    assert len(FEATURE_COLS) == 20
    assert FEATURE_COLS == [
        "soc",
        "current",
        "battery_voltage",
        "soh",
        "power",
        "speed",
        "ignstatus",
        "allow_charging",
        "regen_status",
        "throttle_status",
        "cell_temperature_01",
        "temp_rise_rate",
        "cycle_count",
        "cell_imbalance_mv",
        "wh_throughput",
        "r_internal_mohm",
        "voltage_sag_v",
        "power_density",
        "minute_of_day",
        "day_of_week",
    ]
