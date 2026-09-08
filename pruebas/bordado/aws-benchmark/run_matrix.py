#!/usr/bin/env python3
"""Orquesta invocaciones directas y conserva métricas REPORT de Lambda."""

from __future__ import annotations

import argparse
import base64
import concurrent.futures
import json
import math
import re
import statistics
import subprocess
import tempfile
import time
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
STATE_PATH = ROOT / "aws-benchmark" / "resource-state.json"
# Los cuatro tamaños pedidos más el límite superior (3,008 MB) que aceptó la
# cuenta del benchmark cuando el servicio rechazó 3,072 y 4,096 MB.
MEMORIES = [1024, 2048, 3072, 4096, 3008]
ALLOWED_MEMORIES = [1024, 2048, 3008, 3072, 4096]
CASES = [
    "01-texto-simple",
    "02-logo-monocromo",
    "03-logo-cuatro-colores",
    "04-ilustracion",
    "05-imagen-compleja",
]
REPORT_RE = re.compile(
    r"REPORT RequestId: .*?Duration: (?P<duration>[\d.]+) ms\s+"
    r"Billed Duration: (?P<billed>[\d]+) ms\s+"
    r"Memory Size: (?P<memory>[\d]+) MB\s+"
    r"Max Memory Used: (?P<max_memory>[\d]+) MB"
    r"(?:\s+Init Duration: (?P<init>[\d.]+) ms)?"
)


def aws_base(state: dict[str, Any]) -> list[str]:
    return [
        "aws", "--profile", state["profile"], "--region", state["region"],
        "--cli-connect-timeout", "20", "--cli-read-timeout", "240",
    ]


def run(command: list[str], timeout: int = 300) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(command, capture_output=True, text=True, timeout=timeout)
    if result.returncode != 0:
        raise RuntimeError(f"Falló {' '.join(command[:4])}: {result.stderr.strip()}")
    return result


def configure_cold_generation(state: dict[str, Any], memory: int, token: str) -> None:
    base = aws_base(state)
    run(base + [
        "lambda", "update-function-configuration",
        "--function-name", state["function"],
        "--memory-size", str(memory),
        "--environment", f"Variables={{BENCHMARK_GENERATION={token}}}",
    ])
    run(base + ["lambda", "wait", "function-updated-v2", "--function-name", state["function"]])


def invoke(state: dict[str, Any], case: str, requested_phase: str, group: str) -> dict[str, Any]:
    base = aws_base(state)
    with tempfile.TemporaryDirectory(prefix="kustto-lambda-invoke-") as temporary:
        response_path = Path(temporary) / "response.json"
        result = run(base + [
            "lambda", "invoke",
            "--function-name", state["function"],
            "--cli-binary-format", "raw-in-base64-out",
            "--payload", json.dumps({"case": case}, separators=(",", ":")),
            "--log-type", "Tail",
            str(response_path),
        ], timeout=240)
        metadata = json.loads(result.stdout)
        response = json.loads(response_path.read_text())

    log = base64.b64decode(metadata.get("LogResult", "")).decode("utf-8", errors="replace")
    report = REPORT_RE.search(log)
    parsed = {
        "durationMs": float(report.group("duration")) if report else None,
        "billedDurationMs": int(report.group("billed")) if report else None,
        "memorySizeMb": int(report.group("memory")) if report else None,
        "maxMemoryUsedMb": int(report.group("max_memory")) if report else None,
        "initDurationMs": float(report.group("init")) if report and report.group("init") else None,
    }
    actual_phase = "cold" if parsed["initDurationMs"] is not None else "warm"
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "case": case,
        "requestedPhase": requested_phase,
        "actualPhase": actual_phase,
        "group": group,
        "functionError": metadata.get("FunctionError"),
        "statusCode": metadata.get("StatusCode"),
        "executedVersion": metadata.get("ExecutedVersion"),
        "report": parsed,
        "result": response,
        "reportLine": report.group(0) if report else None,
    }


def invoke_parallel(state: dict[str, Any], case: str, count: int, phase: str, group: str) -> list[dict[str, Any]]:
    with concurrent.futures.ThreadPoolExecutor(max_workers=count) as pool:
        futures = [pool.submit(invoke, state, case, phase, group) for _ in range(count)]
        return [future.result() for future in concurrent.futures.as_completed(futures)]


def percentile_95(values: list[float]) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    return ordered[max(0, math.ceil(len(ordered) * 0.95) - 1)]


def distribution(values: list[float]) -> dict[str, float | int | None]:
    return {
        "n": len(values),
        "min": round(min(values), 2) if values else None,
        "median": round(statistics.median(values), 2) if values else None,
        "p95Approx": round(percentile_95(values), 2) if values else None,
        "max": round(max(values), 2) if values else None,
    }


def summarize(records: list[dict[str, Any]]) -> dict[str, Any]:
    groups: dict[tuple[int, str, str], list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        memory = record["report"]["memorySizeMb"]
        if memory is not None and record["group"] == "matrix":
            groups[(memory, record["case"], record["actualPhase"])].append(record)

    cells: list[dict[str, Any]] = []
    for (memory, case, phase), samples in sorted(groups.items()):
        successful = [sample for sample in samples if sample["result"].get("success")]
        cells.append({
            "memoryMb": memory,
            "case": case,
            "phase": phase,
            "samples": len(samples),
            "successes": len(successful),
            "lambdaDurationMs": distribution([sample["report"]["durationMs"] for sample in successful]),
            "initDurationMs": distribution([sample["report"]["initDurationMs"] for sample in successful if sample["report"]["initDurationMs"] is not None]),
            "coldEndToEndMs": distribution([sample["report"]["durationMs"] + sample["report"]["initDurationMs"] for sample in successful if sample["report"]["initDurationMs"] is not None]),
            "engineMs": distribution([sample["result"]["engineMs"] for sample in successful]),
            "validationMs": distribution([sample["result"]["validationMs"] for sample in successful]),
            "previewMs": distribution([sample["result"]["previewMs"] for sample in successful]),
            "maxMemoryUsedMb": distribution([sample["report"]["maxMemoryUsedMb"] for sample in successful]),
            "billedDurationMs": distribution([sample["report"]["billedDurationMs"] for sample in successful]),
            "peakJobTmpBytes": distribution([sample["result"]["tmp"]["peakJobBytes"] for sample in successful]),
            "environmentIds": sorted({sample["result"].get("environmentId") for sample in successful}),
        })

    concurrency: list[dict[str, Any]] = []
    for record in records:
        if record["group"].startswith("concurrency-"):
            concurrency.append(record)
    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "matrix": cells,
        "concurrency": concurrency,
    }


def append_records(path: Path, records: list[dict[str, Any]]) -> None:
    with path.open("a", encoding="utf-8") as stream:
        for record in records:
            stream.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")
            stream.flush()


def load_records(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def run_matrix(state: dict[str, Any], raw_path: Path, memories: list[int]) -> None:
    for memory in memories:
        for case in CASES:
            token = f"matrix-{memory}-{case}-{uuid.uuid4().hex[:8]}"
            print(f"[{memory} MB] {case}: preparando cold generation", flush=True)
            try:
                configure_cold_generation(state, memory, token)
            except RuntimeError as error:
                error_path = raw_path.parent / "configuration-errors.jsonl"
                with error_path.open("a", encoding="utf-8") as stream:
                    stream.write(json.dumps({
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "memoryMb": memory,
                        "error": str(error),
                    }, ensure_ascii=False, separators=(",", ":")) + "\n")
                print(f"  configuración no soportada: {error}", flush=True)
                break
            cold = invoke_parallel(state, case, 3, "cold", "matrix")
            append_records(raw_path, cold)
            actual_cold = sum(record["actualPhase"] == "cold" for record in cold)
            print(f"  cold confirmados: {actual_cold}/3", flush=True)
            if not any(record["result"].get("success", False) for record in cold):
                print("  las tres ejecuciones fallaron; se omiten repeticiones warm inútiles", flush=True)
                continue

            warm: list[dict[str, Any]] = []
            attempts = 0
            while sum(record["actualPhase"] == "warm" for record in warm) < 5 and attempts < 4:
                needed = 5 - sum(record["actualPhase"] == "warm" for record in warm)
                batch = min(3, needed)
                samples = invoke_parallel(state, case, batch, "warm", "matrix")
                warm.extend(samples)
                append_records(raw_path, samples)
                attempts += 1
            confirmed = sum(record["actualPhase"] == "warm" for record in warm)
            print(f"  warm confirmados: {confirmed}/5", flush=True)


def run_concurrency(state: dict[str, Any], raw_path: Path, memory: int) -> None:
    case = "03-logo-cuatro-colores"
    for concurrency in (1, 5, 10):
        token = f"concurrency-{concurrency}-{uuid.uuid4().hex[:8]}"
        print(f"[concurrencia {concurrency}] {case} @ {memory} MB", flush=True)
        configure_cold_generation(state, memory, token)
        samples = invoke_parallel(state, case, concurrency, "cold", f"concurrency-{concurrency}")
        append_records(raw_path, samples)
        successes = sum(sample["result"].get("success", False) for sample in samples)
        environments = len({sample["result"].get("environmentId") for sample in samples})
        print(f"  success={successes}/{concurrency}, environments={environments}", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=("matrix", "concurrency", "all"), default="all")
    parser.add_argument("--concurrency-memory", type=int, default=2048)
    parser.add_argument("--memories", nargs="+", type=int, choices=ALLOWED_MEMORIES, default=MEMORIES)
    args = parser.parse_args()

    state = json.loads(STATE_PATH.read_text())
    if state.get("status") != "ACTIVE":
        raise SystemExit("El benchmark AWS no está ACTIVE")
    run_dir = Path(state["runDir"])
    run_dir.mkdir(parents=True, exist_ok=True)
    raw_path = run_dir / "invocations.jsonl"

    if args.mode in ("matrix", "all"):
        run_matrix(state, raw_path, args.memories)
    if args.mode in ("concurrency", "all"):
        run_concurrency(state, raw_path, args.concurrency_memory)

    records = load_records(raw_path)
    summary = summarize(records)
    (run_dir / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n")
    print(f"Resultados: {run_dir / 'summary.json'}", flush=True)


if __name__ == "__main__":
    main()
