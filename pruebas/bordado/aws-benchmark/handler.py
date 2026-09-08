"""Handler aislado para medir Ink/Stitch en AWS Lambda ARM64.

Sólo acepta uno de los cinco casos empacados. No recibe rutas ni URLs, no usa
red y crea un directorio temporal único por invocación.
"""

from __future__ import annotations

import json
import math
import os
import resource
import shutil
import subprocess
import tempfile
import time
import uuid
from collections import Counter
from pathlib import Path
from typing import Any

import pyembroidery as pe
from PIL import Image, ImageDraw


TASK_ROOT = Path("/var/task")
TMP_ROOT = Path("/tmp")
INKSTITCH = "/opt/inkstitch/bin/inkstitch"
ENGINE_TIMEOUT_SECONDS = 150
ENVIRONMENT_ID = uuid.uuid4().hex
ENVIRONMENT_INVOCATIONS = 0
INIT_STARTED = time.perf_counter()

CASES = {
    "01-texto-simple": {
        "palette": ["#171717"],
        "expected": {"widthMm": 82.6, "heightMm": 16.6, "stitches": 1321, "colorChanges": 0, "jumps": 8, "trims": 0},
    },
    "02-logo-monocromo": {
        "palette": ["#111111"],
        "expected": {"widthMm": 50.6, "heightMm": 50.0, "stitches": 1973, "colorChanges": 0, "jumps": 2, "trims": 0},
    },
    "03-logo-cuatro-colores": {
        "palette": ["#2457d6", "#f05a3f", "#acd633", "#171717"],
        "expected": {"widthMm": 70.6, "heightMm": 40.0, "stitches": 3382, "colorChanges": 3, "jumps": 7, "trims": 3},
    },
    "04-ilustracion": {
        "palette": ["#efb52d", "#ef6b45", "#315d9b", "#f2ead8", "#367c4a", "#74452a"],
        "expected": {"widthMm": 76.2, "heightMm": 44.6, "stitches": 2520, "colorChanges": 5, "jumps": 16, "trims": 6},
    },
    "05-imagen-compleja": {
        "palette": ["#5060ab", "#4fc19f", "#9c5b82", "#5390a7", "#d85f4f", "#4c2c99", "#bf8f5f", "#bfb35f"],
        "expected": {"widthMm": 90.6, "heightMm": 60.4, "stitches": 7295, "colorChanges": 7, "jumps": 155, "trims": 80},
    },
}


def directory_bytes(path: Path) -> int:
    total = 0
    if not path.exists():
        return total
    for candidate in path.rglob("*"):
        try:
            if candidate.is_file():
                total += candidate.stat().st_size
        except FileNotFoundError:
            pass
    return total


for writable in (Path(os.environ["HOME"]), Path(os.environ["XDG_CACHE_HOME"]), Path(os.environ["XDG_CONFIG_HOME"])):
    writable.mkdir(parents=True, exist_ok=True)

XVFB = subprocess.Popen(
    ["Xvfb", os.environ["DISPLAY"], "-screen", "0", "1280x1024x24", "-nolisten", "tcp", "-noreset"],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.PIPE,
)
for _ in range(50):
    if Path("/tmp/.X11-unix/X99").exists():
        break
    if XVFB.poll() is not None:
        error = XVFB.stderr.read().decode("utf-8", errors="replace") if XVFB.stderr else ""
        raise RuntimeError(f"Xvfb terminó durante init: {error[:500]}")
    time.sleep(0.02)
else:
    raise RuntimeError("Xvfb no estuvo listo durante init")

HANDLER_INIT_MS = round((time.perf_counter() - INIT_STARTED) * 1000, 1)


def command_counts(pattern: pe.EmbPattern) -> Counter[int]:
    return Counter(int(stitch[2]) & pe.COMMAND_MASK for stitch in pattern.stitches)


def analyze_dst(dst: Path) -> tuple[pe.EmbPattern, dict[str, Any]]:
    pattern = pe.read(str(dst))
    if pattern is None:
        raise RuntimeError("pyembroidery no pudo abrir el DST")
    counts = command_counts(pattern)
    min_x, min_y, max_x, max_y = pattern.bounds()
    lengths: list[float] = []
    previous = None
    for x, y, command in pattern.stitches:
        kind = int(command) & pe.COMMAND_MASK
        if previous is not None and kind in (pe.STITCH, pe.JUMP):
            lengths.append(math.dist(previous, (x, y)) / 10)
        previous = (x, y)
    return pattern, {
        "widthMm": round((max_x - min_x) / 10, 1),
        "heightMm": round((max_y - min_y) / 10, 1),
        "stitches": counts[pe.STITCH],
        "commands": len(pattern.stitches),
        "colorChanges": counts[pe.COLOR_CHANGE] + counts[pe.NEEDLE_SET],
        "jumps": counts[pe.JUMP],
        "trims": counts[pe.TRIM],
        "minStitchLengthMm": round(min((value for value in lengths if value > 0), default=0), 2),
        "maxStitchLengthMm": round(max(lengths), 2) if lengths else 0,
    }


def analyze_raw_dst(dst: Path, parsed: dict[str, Any]) -> dict[str, Any]:
    data = dst.read_bytes()
    header = data[:512].decode("ascii", errors="replace")
    payload = data[512:]
    records = [payload[index:index + 3] for index in range(0, len(payload) - 2, 3)]
    x = y = 0
    min_x = max_x = min_y = max_y = 0
    colors = 0
    ended = False
    max_axis_delta = 0
    movement_records: list[tuple[str, int, int]] = []

    def delta(a: int, b: int, c: int, axis: str) -> int:
        if axis == "x":
            return ((a & 0x01) and 1 or 0) - ((a & 0x02) and 1 or 0) + ((b & 0x01) and 3 or 0) - ((b & 0x02) and 3 or 0) + ((a & 0x04) and 9 or 0) - ((a & 0x08) and 9 or 0) + ((b & 0x04) and 27 or 0) - ((b & 0x08) and 27 or 0) + ((c & 0x04) and 81 or 0) - ((c & 0x08) and 81 or 0)
        return ((a & 0x80) and 1 or 0) - ((a & 0x40) and 1 or 0) + ((b & 0x80) and 3 or 0) - ((b & 0x40) and 3 or 0) + ((a & 0x20) and 9 or 0) - ((a & 0x10) and 9 or 0) + ((b & 0x20) and 27 or 0) - ((b & 0x10) and 27 or 0) + ((c & 0x20) and 81 or 0) - ((c & 0x10) and 81 or 0)

    decoded = 0
    for a, b, c in records:
        if c == 0xF3:
            ended = True
            break
        dx, dy = delta(a, b, c, "x"), delta(a, b, c, "y")
        max_axis_delta = max(max_axis_delta, abs(dx), abs(dy))
        x, y = x + dx, y + dy
        min_x, max_x = min(min_x, x), max(max_x, x)
        min_y, max_y = min(min_y, y), max(max_y, y)
        if c & 0xC3 == 0xC3:
            colors += 1
            kind = "color"
        elif c & 0x83 == 0x83:
            kind = "jump"
        else:
            kind = "stitch"
        movement_records.append((kind, dx, dy))
        decoded += 1

    encoded_trims = 0
    index = 0
    while index <= len(movement_records) - 3:
        first, second, third = movement_records[index:index + 3]
        is_trim = (
            first[0] == second[0] == third[0] == "jump"
            and first[1:] == third[1:]
            and second[1] == -2 * first[1]
            and second[2] == -2 * first[2]
            and first[1:] != (0, 0)
        )
        if is_trim:
            encoded_trims += 1
            index += 3
        else:
            index += 1

    def header_number(prefix: str) -> int | None:
        for line in header.split("\r"):
            if line.startswith(prefix):
                try:
                    return int(line[len(prefix):].strip())
                except ValueError:
                    return None
        return None

    width = round((max_x - min_x) / 10, 1)
    height = round((max_y - min_y) / 10, 1)
    logical_records = decoded - 2 * encoded_trims + 1
    checks = {
        "headerIs512Bytes": len(data) >= 512 and header.startswith("LA:"),
        "payloadAlignedTo3Bytes": len(payload) % 3 == 0,
        "hasEndRecord": ended,
        "headerRecordCountMatches": header_number("ST:") == logical_records,
        "headerColorChangesMatch": header_number("CO:") == colors,
        "boundsMatchPyembroidery": abs(width - parsed["widthMm"]) <= 0.1 and abs(height - parsed["heightMm"]) <= 0.1,
        "maxAxisMovementRepresentable": max_axis_delta <= 121,
    }
    return {"passed": all(checks.values()), "checks": checks, "maxAxisDeltaTenthsMm": max_axis_delta}


def render_preview(pattern: pe.EmbPattern, palette: list[str], out: Path) -> None:
    min_x, min_y, max_x, max_y = pattern.bounds()
    width_mm = max(1, (max_x - min_x) / 10)
    height_mm = max(1, (max_y - min_y) / 10)
    scale = min(900 / width_mm, 600 / height_mm)
    margin = 40
    width = round(width_mm * scale + margin * 2)
    height = round(height_mm * scale + margin * 2)
    image = Image.new("RGB", (width, height), "#f4f0e8")
    draw = ImageDraw.Draw(image, "RGBA")
    block = 0
    previous = None
    for x, y, command in pattern.stitches:
        kind = int(command) & pe.COMMAND_MASK
        if kind in (pe.COLOR_CHANGE, pe.NEEDLE_SET):
            block += 1
        point = (margin + (x - min_x) / 10 * scale, margin + (y - min_y) / 10 * scale)
        if previous is not None and kind == pe.STITCH:
            draw.line((previous, point), fill=palette[min(block, len(palette) - 1)] + "d9", width=max(1, round(scale * 0.07)))
        elif previous is not None and kind == pe.JUMP:
            draw.line((previous, point), fill="#d43b3b55", width=1)
        previous = point
    image.save(out, optimize=True)


def semantic_consistency(actual: dict[str, Any], expected: dict[str, Any]) -> dict[str, Any]:
    checks = {
        "width": abs(actual["widthMm"] - expected["widthMm"]) <= 0.2,
        "height": abs(actual["heightMm"] - expected["heightMm"]) <= 0.2,
        "stitches": abs(actual["stitches"] - expected["stitches"]) <= max(3, expected["stitches"] * 0.01),
        "colorChanges": actual["colorChanges"] == expected["colorChanges"],
        "jumps": actual["jumps"] == expected["jumps"],
        "trims": actual["trims"] == expected["trims"],
    }
    return {"passed": all(checks.values()), "checks": checks}


def process_case(case_name: str, request_id: str) -> dict[str, Any]:
    case = CASES[case_name]
    source = TASK_ROOT / "cases" / case_name / "geometria.svg"
    job_dir = Path(tempfile.mkdtemp(prefix=f"embroidery-{request_id[:12]}-", dir=TMP_ROOT))
    global_before = directory_bytes(TMP_ROOT)
    peak_job_bytes = 0
    total_started = time.perf_counter()

    try:
        geometry = job_dir / "geometria.svg"
        dst = job_dir / "diseno.dst"
        preview = job_dir / "preview.png"
        shutil.copyfile(source, geometry)
        peak_job_bytes = max(peak_job_bytes, directory_bytes(job_dir))

        engine_started = time.perf_counter()
        with dst.open("wb") as output:
            engine = subprocess.run(
                [INKSTITCH, "--extension=output", "--format=dst", str(geometry)],
                stdout=output,
                stderr=subprocess.PIPE,
                timeout=ENGINE_TIMEOUT_SECONDS,
                check=False,
                env=os.environ.copy(),
            )
        engine_ms = (time.perf_counter() - engine_started) * 1000
        peak_job_bytes = max(peak_job_bytes, directory_bytes(job_dir))
        if engine.returncode != 0 or not dst.exists() or dst.stat().st_size < 515:
            safe_stderr = engine.stderr.decode("utf-8", errors="replace")[-1000:]
            raise RuntimeError(f"engine_failed:{engine.returncode}:{safe_stderr}")

        validation_started = time.perf_counter()
        pattern, metrics = analyze_dst(dst)
        structural = analyze_raw_dst(dst, metrics)
        consistency = semantic_consistency(metrics, case["expected"])
        validation_ms = (time.perf_counter() - validation_started) * 1000
        if not structural["passed"] or not consistency["passed"]:
            raise RuntimeError(f"validation_failed:{structural}:{consistency}")

        preview_started = time.perf_counter()
        render_preview(pattern, case["palette"], preview)
        preview_ms = (time.perf_counter() - preview_started) * 1000
        peak_job_bytes = max(peak_job_bytes, directory_bytes(job_dir))

        result = {
            "success": True,
            "case": case_name,
            "engineMs": round(engine_ms, 1),
            "validationMs": round(validation_ms, 1),
            "previewMs": round(preview_ms, 1),
            "totalMs": round((time.perf_counter() - total_started) * 1000, 1),
            "stitchCount": metrics["stitches"],
            "colorChanges": metrics["colorChanges"],
            "jumps": metrics["jumps"],
            "trims": metrics["trims"],
            "widthMm": metrics["widthMm"],
            "heightMm": metrics["heightMm"],
            "outputBytes": dst.stat().st_size,
            "previewBytes": preview.stat().st_size,
            "tmp": {
                "geometryBytes": geometry.stat().st_size,
                "dstBytes": dst.stat().st_size,
                "previewBytes": preview.stat().st_size,
                "peakJobBytes": peak_job_bytes,
                "globalDeltaBytes": max(0, directory_bytes(TMP_ROOT) - global_before),
            },
            "structuralValidation": structural,
            "semanticConsistency": consistency,
        }
    finally:
        shutil.rmtree(job_dir, ignore_errors=True)

    result["tmp"]["cleaned"] = not job_dir.exists()
    return result


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    global ENVIRONMENT_INVOCATIONS
    ENVIRONMENT_INVOCATIONS += 1
    case_name = event.get("case") if isinstance(event, dict) else None
    if case_name not in CASES:
        return {"success": False, "errorCode": "INVALID_CASE", "allowedCases": sorted(CASES)}

    result = process_case(case_name, context.aws_request_id)
    self_rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024
    child_rss = resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss / 1024
    result.update({
        "architecture": "arm64",
        "configuredMemoryMb": int(os.environ.get("AWS_LAMBDA_FUNCTION_MEMORY_SIZE", "0")),
        "maxMemoryMb": round(max(self_rss, child_rss), 1),
        "environmentId": ENVIRONMENT_ID,
        "environmentInvocation": ENVIRONMENT_INVOCATIONS,
        "handlerInitMs": HANDLER_INIT_MS,
    })
    print(json.dumps({"event": "embroidery_benchmark", **result}, separators=(",", ":")))
    return result
