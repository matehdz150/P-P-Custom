"""Ejecuta la suite de calidad contra Ink/Stitch real.

Uso dentro de la imagen ARM64 del worker:

    python3 pruebas/bordado/calidad/run_suite.py --label before
"""
from __future__ import annotations

import argparse
import copy
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[3]
WORKER = ROOT / "services" / "bordados-worker"
sys.path.insert(0, str(WORKER))

import quality  # noqa: E402
import worker  # noqa: E402

RESULTS = Path(__file__).resolve().parent / "resultados"


def ms(started: float) -> float:
    return round((time.perf_counter() - started) * 1000, 1)


def digitize(svg: Path, dst: Path) -> dict[str, Any]:
    display_started = time.perf_counter()
    worker.ensure_display()
    display_ms = ms(display_started)
    engine_started = time.perf_counter()
    with dst.open("wb") as output:
        result = subprocess.run(
            [worker.INKSTITCH, "--extension=output", "--format=dst", str(svg)],
            stdout=output,
            stderr=subprocess.PIPE,
            timeout=worker.ENGINE_TIMEOUT,
            check=False,
        )
    engine_ms = ms(engine_started)
    if result.returncode != 0 or not dst.exists() or dst.stat().st_size < 515:
        message = result.stderr.decode("utf-8", errors="replace")[-2000:]
        raise RuntimeError(f"ENGINE_FAILED: {message}")
    return {
        # Xvfb sí puede separarse de forma fiable. Ink/Stitch no expone un
        # corte interno entre bootstrap Python y digitización; se conserva la
        # suma en vez de inventar ambos números.
        "inkstitchDisplayStartupMs": display_ms,
        "inkstitchProcessAndDigitizationMs": engine_ms,
        "inkstitchInitializationMs": None,
        "inkstitchDigitizationMs": None,
    }


def isolated_design(design: dict[str, Any], obj: dict[str, Any]) -> dict[str, Any]:
    candidate = copy.deepcopy(design)
    candidate["objects"] = [copy.deepcopy(obj)]
    candidate["colors"] = [copy.deepcopy(next(color for color in design["colors"] if color["id"] == obj["colorId"]))]
    candidate["metrics"] = {
        "componentCount": 1,
        "nodeCount": obj["nodeCount"],
        "colorCount": 1,
    }
    return candidate


def object_metrics(design: dict[str, Any], directory: Path, max_objects: int) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    if len(design["objects"]) > max_objects:
        for obj in design["objects"]:
            geometry = quality.analyze_design_geometry({"objects": [obj]})
            result.append({
                "objectId": obj["id"],
                "stitchType": obj["stitch"]["type"],
                "geometry": geometry,
                "stitchPlan": None,
                "measurement": "geometry-only: el DST no conserva identidad de objeto y aislar este diseño excede el límite diagnóstico",
            })
        return result

    objects_dir = directory / "objects"
    objects_dir.mkdir(exist_ok=True)
    for index, obj in enumerate(design["objects"]):
        candidate = isolated_design(design, obj)
        svg = objects_dir / f"{index:03d}.svg"
        dst = objects_dir / f"{index:03d}.dst"
        worker.build_svg(candidate, svg)
        timing = digitize(svg, dst)
        pattern, _ = worker.analyze_dst(dst)
        result.append({
            "objectId": obj["id"],
            "stitchType": obj["stitch"]["type"],
            "geometry": quality.analyze_design_geometry(candidate, svg.stat().st_size),
            "stitchPlan": quality.analyze_stitch_plan(pattern, stitch_type=obj["stitch"]["type"]),
            "timings": timing,
            "measurement": "isolated-object-run",
        })
    shutil.rmtree(objects_dir)
    return result


def run_fixture(slug: str, source: Path, destination: Path, max_objects: int, cache_state: str) -> dict[str, Any]:
    destination.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source / "input.svg", destination / "input.svg")
    shutil.copy2(source / "design.json", destination / "design.json")
    design = json.loads((source / "design.json").read_text(encoding="utf-8"))
    prepared = destination / "prepared.svg"
    dst = destination / "design.dst"
    stitch_plot = destination / "stitchPlot.png"
    embroidered = destination / "embroideredPreview.png"
    timings: dict[str, Any] = {
        "cacheState": cache_state,
        # La suite empieza en geometría preparada y por ello no falsea tiempos
        # del clasificador/pipeline browser que aquí no se ejecutan.
        "segmentationMs": None,
        "vectorGeometryMs": None,
        "skeletonMs": None,
        "railsMs": None,
        "junctionHandlingMs": None,
        "stitchTypeAssignmentMs": None,
        "uploadMs": None,
    }
    total_started = time.perf_counter()
    try:
        started = time.perf_counter()
        worker.build_svg(design, prepared)
        timings["svgGenerationMs"] = ms(started)
        geometry = quality.analyze_design_geometry(design, prepared.stat().st_size)

        timings.update(digitize(prepared, dst))
        started = time.perf_counter()
        pattern, dst_metrics = worker.analyze_dst(dst)
        timings["dstParsingMs"] = ms(started)
        started = time.perf_counter()
        tajima = worker.validate_tajima(dst, dst_metrics)
        timings["tajimaValidationMs"] = ms(started)
        stitch_plan = quality.analyze_stitch_plan(pattern)

        palette = [item["displayHex"] for item in design["colors"]]
        started = time.perf_counter()
        quality.render_stitch_plot(pattern, palette, stitch_plot)
        quality.render_embroidered_preview(pattern, palette, embroidered)
        timings["previewMs"] = ms(started)

        per_object = object_metrics(design, destination, max_objects)
        # Estas sumas SÍ son confiables: cada objeto se ejecutó solo y su tipo se
        # conoce antes de generar DST. No sustituyen las métricas del conjunto.
        isolated = [item for item in per_object if item["stitchPlan"] is not None]
        if len(isolated) == len(per_object):
            stitch_plan["runningStitches"] = sum(item["stitchPlan"]["runningStitches"] for item in isolated)
            stitch_plan["satinStitches"] = sum(item["stitchPlan"]["satinStitches"] for item in isolated)
            stitch_plan["fillStitches"] = sum(item["stitchPlan"]["fillStitches"] for item in isolated)
            stitch_plan["typedStitchesMeasurement"] = "sum-of-isolated-object-runs; puede diferir de stitchCount por conexiones entre objetos"

        timings["totalMs"] = ms(total_started)
        metadata = {
            "fixture": slug,
            "profileVersion": design["profileVersion"],
            "status": "measured",
            "physicallyValidated": False,
            "geometry": geometry,
            "stitchPlan": stitch_plan,
            "dst": dst_metrics,
            "tajima": tajima,
            "objects": per_object,
            "timings": timings,
            "artifacts": {
                "input": "input.svg",
                "preparedSvg": "prepared.svg",
                "stitchPlot": "stitchPlot.png",
                "embroideredPreview": "embroideredPreview.png",
                "dst": "design.dst",
            },
        }
        (destination / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
        return metadata
    except Exception as error:
        timings["totalMs"] = ms(total_started)
        failed = {
            "fixture": slug,
            "profileVersion": design.get("profileVersion"),
            "status": "failed",
            "physicallyValidated": False,
            "error": type(error).__name__,
            "message": str(error),
            "timings": timings,
        }
        (destination / "metadata.json").write_text(json.dumps(failed, ensure_ascii=False, indent=2), encoding="utf-8")
        return failed


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--label", required=True)
    parser.add_argument("--fixtures", default="fixtures")
    parser.add_argument("--only", action="append", default=[])
    parser.add_argument("--max-isolated-objects", type=int, default=20)
    args = parser.parse_args()
    fixtures = Path(__file__).resolve().parent / args.fixtures
    manifest = json.loads((fixtures / "manifest.json").read_text(encoding="utf-8"))
    selected = [item for item in manifest["fixtures"] if not args.only or item["slug"] in args.only]
    output = RESULTS / args.label
    output.mkdir(parents=True, exist_ok=True)
    results = []
    for index, item in enumerate(selected):
        slug = item["slug"]
        print(json.dumps({"event": "fixture-start", "fixture": slug, "index": index + 1, "total": len(selected)}), flush=True)
        result = run_fixture(slug, fixtures / slug, output / slug, args.max_isolated_objects, "cold" if index == 0 else "warm")
        results.append(result)
        print(json.dumps({"event": "fixture-end", "fixture": slug, "status": result["status"], "totalMs": result["timings"]["totalMs"]}), flush=True)
    summary = {
        "label": args.label,
        "profileVersion": manifest["profileVersion"],
        "physicallyValidated": False,
        "fixtures": results,
        "passed": sum(item["status"] == "measured" for item in results),
        "failed": sum(item["status"] != "measured" for item in results),
    }
    (output / "resultados.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"event": "suite-end", "passed": summary["passed"], "failed": summary["failed"], "output": str(output)}), flush=True)


if __name__ == "__main__":
    main()
