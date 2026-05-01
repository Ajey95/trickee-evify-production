from __future__ import annotations

from dataclasses import dataclass

import joblib
import numpy as np
import torch
import torch.nn as nn
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Prediction, Telemetry, Vehicle
from app.services.physics import compute_range_factors


FEATURE_COLS = [
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

SEQ_LEN = 20


class BatteryRangeModel(nn.Module):
    def __init__(self, input_size: int, hidden_size: int = 64, num_layers: int = 1, dropout: float = 0.2):
        super().__init__()
        lstm_dropout = dropout if num_layers > 1 else 0.0
        self.lstm = nn.LSTM(
            input_size,
            hidden_size,
            num_layers,
            batch_first=True,
            dropout=lstm_dropout,
            bidirectional=True,
        )
        self.attention = nn.MultiheadAttention(hidden_size * 2, num_heads=4, dropout=dropout)
        self.bn = nn.BatchNorm1d(hidden_size * 2)
        self.fc1 = nn.Linear(hidden_size * 2, 128)
        self.fc2 = nn.Linear(128, 64)
        self.fc3 = nn.Linear(64, 1)
        self.drop = nn.Dropout(dropout)
        self.relu = nn.ReLU()

    def forward(self, x):
        out, _ = self.lstm(x)
        out, _ = self.attention(out, out, out)
        out = out[:, -1, :]
        out = self.bn(out)
        out = self.relu(self.fc1(out))
        out = self.drop(out)
        out = self.relu(self.fc2(out))
        out = self.drop(out)
        return self.fc3(out)


@dataclass
class InferenceResult:
    prediction: Prediction
    feature_columns: list[str]


class AiEngine:
    def __init__(self) -> None:
        self.model: BatteryRangeModel | None = None
        self.scaler = None
        self.y_scaler = None
        self.ready = False
        self.load()

    def load(self) -> None:
        settings = get_settings()
        if not (settings.model_path.exists() and settings.scaler_path.exists() and settings.y_scaler_path.exists()):
            self.ready = False
            return

        checkpoint = torch.load(settings.model_path, map_location="cpu", weights_only=False)
        checkpoint_features = checkpoint.get("feature_columns")
        if checkpoint_features and list(checkpoint_features) != FEATURE_COLS:
            raise RuntimeError("V4.1 checkpoint feature order does not match backend FEATURE_COLS")

        self.model = BatteryRangeModel(len(FEATURE_COLS), hidden_size=checkpoint.get("hidden_size", 64))
        self.model.load_state_dict(checkpoint["model_state_dict"])
        self.model.eval()
        self.scaler = joblib.load(settings.scaler_path)
        self.y_scaler = joblib.load(settings.y_scaler_path)
        self.ready = True

    def telemetry_to_features(self, row: Telemetry) -> list[float]:
        return [
            row.soc,
            row.current,
            row.battery_voltage,
            row.soh,
            row.power,
            row.speed,
            float(row.ignition_on),
            float(row.charge_plug),
            float(row.regen_status),
            float(row.throttle_status),
            row.temp_max,
            row.temp_rise_rate,
            row.cycle_count,
            row.cell_imbalance_mv,
            row.wh_throughput,
            row.r_internal_mohm,
            row.voltage_sag_v,
            row.power_density,
            row.minute_of_day,
            row.day_of_week,
        ]

    def infer_vehicle(self, db: Session, vehicle: Vehicle) -> InferenceResult:
        if not self.ready or self.model is None:
            raise RuntimeError("AI engine is not ready; model/scalers are missing")

        rows = (
            db.query(Telemetry)
            .filter(Telemetry.vehicle_id == vehicle.id)
            .order_by(desc(Telemetry.recorded_at))
            .limit(SEQ_LEN)
            .all()
        )
        if len(rows) < SEQ_LEN:
            raise ValueError(f"Need {SEQ_LEN} telemetry rows for V4.1 inference; found {len(rows)}")

        window = list(reversed(rows))
        feature_matrix = np.array([self.telemetry_to_features(row) for row in window], dtype=np.float32)
        x_scaled = self.scaler.transform(feature_matrix).astype(np.float32)
        x_tensor = torch.tensor(x_scaled).unsqueeze(0)

        with torch.no_grad():
            pred_scaled = self.model(x_tensor).numpy().reshape(-1, 1)
        predicted_delta = float(self.y_scaler.inverse_transform(pred_scaled)[0][0])

        current = window[-1]
        predicted_next_soc = max(0.0, min(100.0, current.soc + predicted_delta))
        range_now = compute_range_factors(
            soc=current.soc,
            soh=current.soh,
            temp_max=current.temp_max,
            power_density=current.power_density,
            max_range_km=vehicle.max_range_km,
        )
        range_after = compute_range_factors(
            soc=predicted_next_soc,
            soh=current.soh,
            temp_max=current.temp_max,
            power_density=current.power_density,
            max_range_km=vehicle.max_range_km,
        )

        prediction = Prediction(
            vehicle_id=vehicle.id,
            driver_id=current.driver_id,
            actual_soc=current.soc,
            predicted_delta_soc=round(predicted_delta, 4),
            predicted_next_soc=round(predicted_next_soc, 4),
            dynamic_range_km=range_now["dynamic_range_km"],
            predicted_range_km=range_after["dynamic_range_km"],
            soh_factor=range_now["soh_factor"],
            thermal_factor=range_now["thermal_factor"],
            aggression_factor=range_now["aggression_factor"],
            window_size=SEQ_LEN,
        )
        db.add(prediction)
        db.commit()
        db.refresh(prediction)
        return InferenceResult(prediction=prediction, feature_columns=FEATURE_COLS)


ai_engine = AiEngine()
