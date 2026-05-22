from __future__ import annotations

import argparse
import json
import os
import statistics
import time
from collections import Counter
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

import httpx


DEFAULT_PATH = "/api/v1/telemetry/evify/bulk"
MAX_BATCH_SIZE = 500


@dataclass(frozen=True)
class Batch:
    source: str
    index: int
    rows: list[dict[str, Any]]


@dataclass(frozen=True)
class Result:
    ok: bool
    status_code: int
    elapsed_ms: float
    rows: int
    source: str
    index: int
    error: str | None = None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Replay Evify JSON telemetry files into Trickee's bulk ingest endpoint."
    )
    parser.add_argument("--data-dir", required=True, help="Directory containing Evify .json files")
    parser.add_argument("--base-url", default="http://localhost:8000", help="Backend base URL")
    parser.add_argument("--path", default=DEFAULT_PATH, help="Bulk ingest API path")
    parser.add_argument("--token", default=os.getenv("TRICKEE_API_TOKEN"), help="Bearer token; or set TRICKEE_API_TOKEN")
    parser.add_argument("--batch-size", type=int, default=MAX_BATCH_SIZE, help="Rows per request, max 500")
    parser.add_argument("--concurrency", type=int, default=10, help="Concurrent HTTP requests")
    parser.add_argument("--timeout", type=float, default=20.0, help="HTTP timeout seconds")
    parser.add_argument("--limit-files", type=int, default=None, help="Only read first N JSON files")
    parser.add_argument("--limit-rows", type=int, default=None, help="Stop after N total rows")
    parser.add_argument("--sleep-ms", type=float, default=0.0, help="Delay after each submitted batch")
    parser.add_argument("--dry-run", action="store_true", help="Read and batch files without POSTing")
    parser.add_argument("--stop-on-error", action="store_true", help="Stop submitting after first failed batch")
    return parser.parse_args()


def endpoint(base_url: str, path: str) -> str:
    return f"{base_url.rstrip('/')}/{path.lstrip('/')}"


def json_files(data_dir: Path, limit_files: int | None) -> list[Path]:
    files = sorted(data_dir.glob("*.json"))
    if limit_files is not None:
        files = files[:limit_files]
    return files


def load_records(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, list):
        raise ValueError(f"{path.name} must contain a JSON array")
    bad = next((idx for idx, item in enumerate(data) if not isinstance(item, dict)), None)
    if bad is not None:
        raise ValueError(f"{path.name} item {bad} is not an object")
    return data


def iter_batches(files: Iterable[Path], batch_size: int, limit_rows: int | None) -> Iterable[Batch]:
    seen = 0
    for file_path in files:
        records = load_records(file_path)
        if limit_rows is not None:
            remaining = limit_rows - seen
            if remaining <= 0:
                return
            records = records[:remaining]
        for index, start in enumerate(range(0, len(records), batch_size), start=1):
            rows = records[start : start + batch_size]
            if not rows:
                continue
            seen += len(rows)
            yield Batch(source=file_path.name, index=index, rows=rows)
            if limit_rows is not None and seen >= limit_rows:
                return


def post_batch(client: httpx.Client, url: str, headers: dict[str, str], batch: Batch) -> Result:
    started = time.perf_counter()
    try:
        response = client.post(url, headers=headers, json=batch.rows)
        elapsed_ms = (time.perf_counter() - started) * 1000
        if 200 <= response.status_code < 300:
            return Result(True, response.status_code, elapsed_ms, len(batch.rows), batch.source, batch.index)
        detail = response.text[:500].replace("\n", " ")
        return Result(False, response.status_code, elapsed_ms, len(batch.rows), batch.source, batch.index, detail)
    except Exception as exc:
        elapsed_ms = (time.perf_counter() - started) * 1000
        return Result(False, 0, elapsed_ms, len(batch.rows), batch.source, batch.index, exc.__class__.__name__)


def percentile(values: list[float], pct: int) -> float:
    if not values:
        return 0.0
    if len(values) == 1:
        return values[0]
    return statistics.quantiles(values, n=100, method="inclusive")[pct - 1]


def print_summary(results: list[Result], started_at: float) -> int:
    elapsed_s = time.perf_counter() - started_at
    latencies = [result.elapsed_ms for result in results]
    success = [result for result in results if result.ok]
    failed = [result for result in results if not result.ok]
    rows_ok = sum(result.rows for result in success)
    status_counts = Counter(result.status_code for result in results)

    print("\nReplay summary")
    print(f"  batches_total={len(results)} batches_ok={len(success)} batches_failed={len(failed)}")
    print(f"  rows_ok={rows_ok} elapsed_s={elapsed_s:.2f} rows_per_s={(rows_ok / elapsed_s) if elapsed_s else 0:.2f}")
    print(f"  status_counts={dict(sorted(status_counts.items()))}")
    print(f"  latency_ms_p50={statistics.median(latencies) if latencies else 0:.2f}")
    print(f"  latency_ms_p95={percentile(latencies, 95):.2f}")
    print(f"  latency_ms_max={max(latencies) if latencies else 0:.2f}")

    for result in failed[:10]:
        print(
            "  failed "
            f"source={result.source} batch={result.index} status={result.status_code} "
            f"rows={result.rows} error={result.error}"
        )
    return 1 if failed else 0


def main() -> int:
    args = parse_args()
    data_dir = Path(args.data_dir)
    if not data_dir.exists():
        raise SystemExit(f"Data directory does not exist: {data_dir}")
    if args.batch_size < 1 or args.batch_size > MAX_BATCH_SIZE:
        raise SystemExit(f"--batch-size must be between 1 and {MAX_BATCH_SIZE}")
    if args.concurrency < 1:
        raise SystemExit("--concurrency must be at least 1")

    files = json_files(data_dir, args.limit_files)
    if not files:
        raise SystemExit(f"No .json files found in {data_dir}")

    batches = iter_batches(files, args.batch_size, args.limit_rows)
    if args.dry_run:
        file_count = 0
        batch_count = 0
        row_count = 0
        for batch in batches:
            file_count += 1 if batch.index == 1 else 0
            batch_count += 1
            row_count += len(batch.rows)
        print("Dry run summary")
        print(f"  files_read={file_count}")
        print(f"  batches={batch_count}")
        print(f"  rows={row_count}")
        print(f"  batch_size={args.batch_size}")
        return 0

    if not args.token:
        raise SystemExit("Missing bearer token. Pass --token or set TRICKEE_API_TOKEN.")

    url = endpoint(args.base_url, args.path)
    headers = {"Authorization": f"Bearer {args.token}", "Content-Type": "application/json"}
    limits = httpx.Limits(max_connections=args.concurrency, max_keepalive_connections=args.concurrency)
    results: list[Result] = []
    pending = set()
    started_at = time.perf_counter()

    with httpx.Client(timeout=args.timeout, limits=limits) as client:
        with ThreadPoolExecutor(max_workers=args.concurrency) as pool:
            for batch in batches:
                while len(pending) >= args.concurrency:
                    done, pending = wait(pending, return_when=FIRST_COMPLETED)
                    for future in done:
                        result = future.result()
                        results.append(result)
                        if args.stop_on_error and not result.ok:
                            return print_summary(results, started_at)
                pending.add(pool.submit(post_batch, client, url, headers, batch))
                if args.sleep_ms > 0:
                    time.sleep(args.sleep_ms / 1000)

            while pending:
                done, pending = wait(pending, return_when=FIRST_COMPLETED)
                for future in done:
                    result = future.result()
                    results.append(result)
                    if args.stop_on_error and not result.ok:
                        return print_summary(results, started_at)

    return print_summary(results, started_at)


if __name__ == "__main__":
    raise SystemExit(main())
