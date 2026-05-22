from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable

import joblib
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from sklearn.model_selection import GroupShuffleSplit
from sklearn.preprocessing import RobustScaler
from torch.utils.data import DataLoader, Dataset

from app.services.evify_adapter import normalize_evify_payload
from app.services.physics import CAPACITY_WH, compute_r_internal_mohm, soc_to_ocv
from app.services.soc_quality import is_plausible_eval_soc_delta

BASE_FEATURE_COLS = [
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

DRIVER_FEATURE_COLS = [
    "driver_avg_current_30m",
    "driver_avg_speed_30m",
    "driver_regen_ratio_30m",
    "driver_throttle_var_30m",
]

V5A_FEATURE_COLS = BASE_FEATURE_COLS + DRIVER_FEATURE_COLS
TARGET_COL = "delta_soc"
SEQ_LEN = 20
MIN_SPEED = 1.0


class BatteryRangeModel(nn.Module):
    def __init__(self, input_size: int, hidden_size: int = 64, num_layers: int = 1, dropout: float = 0.2):
        super().__init__()
        lstm_dropout = dropout if num_layers > 1 else 0.0
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True, dropout=lstm_dropout, bidirectional=True)
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


class BatteryDataset(Dataset):
    def __init__(self, x, y, noise_std: float = 0.0):
        self.x = torch.FloatTensor(x)
        self.y = torch.FloatTensor(y)
        self.noise_std = noise_std

    def __len__(self):
        return len(self.x)

    def __getitem__(self, idx):
        x = self.x[idx]
        if self.noise_std > 0:
            x = x + torch.randn_like(x) * self.noise_std
        return x, self.y[idx]


def _iter_json_records(path: Path) -> Iterable[dict]:
    files = sorted(path.glob("*.json")) if path.is_dir() else [path]
    for file_path in files:
        with file_path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
        if isinstance(data, list):
            yield from (row for row in data if isinstance(row, dict))
        elif isinstance(data, dict):
            yield data


def _ocv_vec(series: pd.Series) -> pd.Series:
    return series.apply(soc_to_ocv)


def load_evify_json(path: str | Path) -> pd.DataFrame:
    rows = []
    for payload in _iter_json_records(Path(path)):
        normalized = normalize_evify_payload(payload)
        if not normalized["vehicle_code"]:
            continue
        rows.append(
            {
                "vehicle_id": normalized["vehicle_code"],
                "driver_id": normalized.get("driver_code") or "unknown",
                "time": pd.Timestamp(normalized["recorded_at"], tz="UTC"),
                "soc": normalized["soc"],
                "current": normalized["current"],
                "battery_voltage": normalized["battery_voltage"],
                "speed": normalized["speed"],
                "temp_max": normalized["temp_max"],
                "soh": normalized["soh"],
                "charge_plug": int(normalized["charge_plug"]),
                "ignition_on": int(normalized["ignition_on"]),
                "regen_status": int(normalized["regen_status"]),
                "throttle_status": int(normalized["throttle_status"]),
                "cycle_count": normalized["cycle_count"],
                "cell_imbalance_mv": normalized["cell_imbalance_mv"],
                "wh_throughput": normalized["wh_throughput"],
            }
        )
    df = pd.DataFrame(rows)
    if df.empty:
        raise ValueError("No Evify telemetry records found")
    return df.sort_values(["vehicle_id", "time"]).reset_index(drop=True)


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    for col in [
        "soc",
        "current",
        "battery_voltage",
        "speed",
        "temp_max",
        "soh",
        "charge_plug",
        "ignition_on",
        "regen_status",
        "throttle_status",
        "cycle_count",
        "cell_imbalance_mv",
        "wh_throughput",
    ]:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)

    df["power"] = df["battery_voltage"] * df["current"]
    df["cell_temperature_01"] = df["temp_max"]
    df["ignstatus"] = df["ignition_on"].astype(int)
    df["allow_charging"] = df["charge_plug"].astype(int)
    df["r_internal_mohm"] = [
        compute_r_internal_mohm(int(cycle), float(soh)) for cycle, soh in zip(df["cycle_count"], df["soh"], strict=False)
    ]
    df["voltage_sag_v"] = (_ocv_vec(df["soc"]) - df["battery_voltage"]).round(3)
    df["temp_rise_rate"] = df.groupby("vehicle_id")["temp_max"].diff().fillna(0.0).clip(-5, 5)
    df["power_density"] = (df["power"] / CAPACITY_WH).round(4)
    df["minute_of_day"] = df["time"].dt.hour * 60 + df["time"].dt.minute
    df["day_of_week"] = df["time"].dt.dayofweek
    return df


AGG = {
    "battery_voltage": "mean",
    "current": "mean",
    "soc": "first",
    "soh": "mean",
    "power": "mean",
    "speed": "mean",
    "cell_temperature_01": "mean",
    "ignstatus": "max",
    "allow_charging": "first",
    "regen_status": "max",
    "throttle_status": "max",
    "cycle_count": "first",
    "cell_imbalance_mv": "mean",
    "wh_throughput": "last",
    "r_internal_mohm": "mean",
    "voltage_sag_v": "mean",
    "temp_rise_rate": "mean",
    "power_density": "mean",
    "minute_of_day": "first",
    "day_of_week": "first",
    "driver_id": "first",
}


def resample_v5a(df: pd.DataFrame) -> pd.DataFrame:
    frames = []
    for vehicle_id in df["vehicle_id"].unique():
        vdf = df[df["vehicle_id"] == vehicle_id].set_index("time").sort_index()
        frame = vdf.resample("5min").agg(AGG).dropna(subset=["soc"])
        frame["vehicle_id"] = vehicle_id
        frames.append(frame.reset_index())
    windows = pd.concat(frames, ignore_index=True).sort_values(["driver_id", "time"]).reset_index(drop=True)

    grouped = windows.groupby("driver_id", group_keys=False)
    windows["driver_avg_current_30m"] = grouped["current"].rolling(6, min_periods=1).mean().reset_index(level=0, drop=True)
    windows["driver_avg_speed_30m"] = grouped["speed"].rolling(6, min_periods=1).mean().reset_index(level=0, drop=True)
    windows["driver_regen_ratio_30m"] = grouped["regen_status"].rolling(6, min_periods=1).mean().reset_index(level=0, drop=True)
    windows["driver_throttle_var_30m"] = (
        grouped["throttle_status"].rolling(6, min_periods=1).var().reset_index(level=0, drop=True).fillna(0.0)
    )

    windows = windows.sort_values(["vehicle_id", "time"]).reset_index(drop=True)
    windows[TARGET_COL] = windows.groupby("vehicle_id")["soc"].shift(-1) - windows["soc"]
    windows = windows[windows[TARGET_COL].apply(is_plausible_eval_soc_delta)]
    windows = windows[windows["speed"] >= MIN_SPEED]
    windows = windows[windows["current"].abs() > 0.1]
    windows = windows.dropna(subset=V5A_FEATURE_COLS + [TARGET_COL])
    return windows


def build_sequences(df: pd.DataFrame):
    x = df[V5A_FEATURE_COLS].values.astype(np.float32)
    y = df[TARGET_COL].values.astype(np.float32)
    soc = df["soc"].values.astype(np.float32)
    groups = df["vehicle_id"].values

    scaler = RobustScaler()
    x_scaled = scaler.fit_transform(x).astype(np.float32)
    y_scaler = RobustScaler()
    y_scaled = y_scaler.fit_transform(y.reshape(-1, 1)).flatten().astype(np.float32)

    xseq, yseq, soc_seq, group_seq = [], [], [], []
    for vehicle_id in np.unique(groups):
        mask = groups == vehicle_id
        xv, yv, sv = x_scaled[mask], y_scaled[mask], soc[mask]
        for idx in range(len(xv) - SEQ_LEN):
            xseq.append(xv[idx : idx + SEQ_LEN])
            yseq.append(yv[idx + SEQ_LEN])
            soc_seq.append(sv[idx + SEQ_LEN])
            group_seq.append(vehicle_id)
    return (
        np.array(xseq, dtype=np.float32),
        np.array(yseq, dtype=np.float32),
        np.array(soc_seq, dtype=np.float32),
        np.array(group_seq),
        scaler,
        y_scaler,
    )


def train_v5a(
    json_path: str | Path,
    output_dir: str | Path,
    *,
    epochs: int = 12,
    batch_size: int = 256,
    hidden_size: int = 64,
    lr: float = 0.001,
) -> dict:
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    df_raw = engineer_features(load_evify_json(json_path))
    df_proc = resample_v5a(df_raw)
    xseq, yseq, soc_seq, group_seq, scaler, y_scaler = build_sequences(df_proc)
    if len(xseq) < 100:
        raise ValueError(f"Not enough V5-A sequences to train: {len(xseq)}")

    splitter = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
    train_idx, test_idx = next(splitter.split(xseq, yseq, groups=group_seq))
    xtr, xte = xseq[train_idx], xseq[test_idx]
    ytr, yte = yseq[train_idx], yseq[test_idx]
    soc_te = soc_seq[test_idx]

    train_loader = DataLoader(BatteryDataset(xtr, ytr, noise_std=0.02), batch_size=batch_size, shuffle=True)
    test_loader = DataLoader(BatteryDataset(xte, yte), batch_size=batch_size, shuffle=False)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = BatteryRangeModel(len(V5A_FEATURE_COLS), hidden_size=hidden_size).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=1e-4)
    criterion = nn.HuberLoss(delta=1.0)
    best = {"loss": float("inf"), "epoch": 0, "mae": float("inf"), "acc_1": 0.0, "acc_3": 0.0}
    model_path = output / "battery_model_v5a.pth"

    for epoch in range(1, epochs + 1):
        model.train()
        for xb, yb in train_loader:
            xb, yb = xb.to(device), yb.to(device)
            optimizer.zero_grad()
            loss = criterion(model(xb).squeeze(-1), yb)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()

        model.eval()
        preds_s, trues_s = [], []
        with torch.no_grad():
            for xb, yb in test_loader:
                preds_s.extend(model(xb.to(device)).squeeze(-1).cpu().numpy())
                trues_s.extend(yb.numpy())
        preds_s = np.array(preds_s).reshape(-1, 1)
        trues_s = np.array(trues_s).reshape(-1, 1)
        pred_delta = y_scaler.inverse_transform(preds_s).flatten()
        true_delta = y_scaler.inverse_transform(trues_s).flatten()
        err = np.abs((soc_te + pred_delta) - (soc_te + true_delta))
        loss_value = float(np.mean(np.abs(preds_s.flatten() - trues_s.flatten())))
        metrics = {
            "loss": loss_value,
            "epoch": epoch,
            "mae": float(np.mean(err)),
            "acc_1": float(np.mean(err < 1.0) * 100),
            "acc_3": float(np.mean(err < 3.0) * 100),
        }
        print(
            f"Epoch {epoch:02d}/{epochs} | loss={metrics['loss']:.4f} "
            f"MAE={metrics['mae']:.4f} Acc1={metrics['acc_1']:.2f}% Acc3={metrics['acc_3']:.2f}%"
        )
        if metrics["loss"] < best["loss"]:
            best = metrics
            torch.save(
                {
                    "model_state_dict": model.state_dict(),
                    "input_size": len(V5A_FEATURE_COLS),
                    "feature_columns": V5A_FEATURE_COLS,
                    "hidden_size": hidden_size,
                    "num_layers": 1,
                    "target": "delta_soc",
                    "seq_len": SEQ_LEN,
                    "model_version": "v5a_driver_behavior",
                },
                model_path,
            )

    joblib.dump(scaler, output / "scaler_v5a.joblib")
    joblib.dump(y_scaler, output / "y_scaler_v5a.joblib")
    report = {
        "model_version": "v5a_driver_behavior",
        "raw_rows": int(len(df_raw)),
        "training_windows": int(len(df_proc)),
        "sequences": int(len(xseq)),
        "train_sequences": int(len(xtr)),
        "test_sequences": int(len(xte)),
        "feature_count": len(V5A_FEATURE_COLS),
        "feature_columns": V5A_FEATURE_COLS,
        "best": best,
        "artifacts": {
            "model": str(model_path),
            "scaler": str(output / "scaler_v5a.joblib"),
            "y_scaler": str(output / "y_scaler_v5a.joblib"),
        },
    }
    with (output / "v5a_training_report.json").open("w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2)
    return report
