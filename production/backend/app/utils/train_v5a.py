from __future__ import annotations

import argparse
from pathlib import Path

from app.ml.v5a_training import train_v5a


def main() -> None:
    parser = argparse.ArgumentParser(description="Train Trickee V5-A driver-behavior SOC model from Evify JSON.")
    parser.add_argument("json_path", help="Evify JSON file or folder.")
    parser.add_argument("--output-dir", default="models_ml", help="Directory for V5-A artifacts.")
    parser.add_argument("--epochs", type=int, default=12)
    args = parser.parse_args()

    report = train_v5a(Path(args.json_path), Path(args.output_dir), epochs=args.epochs)
    best = report["best"]
    print("V5-A training complete")
    print(f"Best epoch: {best['epoch']}")
    print(f"MAE: {best['mae']:.4f} SOC units")
    print(f"Acc within 1 SOC: {best['acc_1']:.2f}%")
    print(f"Acc within 3 SOC: {best['acc_3']:.2f}%")
    print(f"Report: {Path(args.output_dir) / 'v5a_training_report.json'}")


if __name__ == "__main__":
    main()
