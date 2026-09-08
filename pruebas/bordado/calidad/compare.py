"""Compara dos corridas completas sin seleccionar métricas a conveniencia."""
from __future__ import annotations

import json
import statistics
from pathlib import Path
from typing import Any, Callable

HERE = Path(__file__).resolve().parent
BEFORE = HERE / "resultados" / "before-v2" / "resultados.json"
AFTER = HERE / "resultados" / "after-v3-candidate" / "resultados.json"


def value(item: dict[str, Any], path: str) -> float:
    current: Any = item
    for part in path.split("."):
        current = current[part]
    return float(current)


def change(before: float, after: float) -> float | None:
    return round((after / before - 1) * 100, 1) if before else None


before_data = json.loads(BEFORE.read_text(encoding="utf-8"))
after_data = json.loads(AFTER.read_text(encoding="utf-8"))
before = {item["fixture"]: item for item in before_data["fixtures"]}
after = {item["fixture"]: item for item in after_data["fixtures"]}
if before.keys() != after.keys():
    raise SystemExit("Las corridas no contienen los mismos fixtures")

metrics = {
    "engineMs": "timings.inkstitchProcessAndDigitizationMs",
    "maxStitchLengthMm": "stitchPlan.maxStitchLengthMm",
    "p95StitchLengthMm": "stitchPlan.p95StitchLengthMm",
    "sharpDirectionChanges": "stitchPlan.numberOfSharpDirectionChanges",
    "crossingStitches": "stitchPlan.numberOfCrossingStitches",
    "overlappingSegments": "stitchPlan.overlappingSegments",
    "maxLocalDensity": "stitchPlan.maxLocalDensity",
    "jumps": "stitchPlan.jumps",
    "trims": "stitchPlan.trims",
    "stitchCount": "stitchPlan.stitchCount",
    "objectCount": "geometry.objectCount",
    "nodeCount": "geometry.nodeCount",
    "svgBytes": "geometry.svgBytes",
}

rows = []
for slug in before:
    item = {"fixture": slug}
    for name, metric_path in metrics.items():
        old, new = value(before[slug], metric_path), value(after[slug], metric_path)
        item[name] = {"before": old, "after": new, "changePct": change(old, new)}
    item["tajimaPassed"] = bool(before[slug]["tajima"]["passed"] and after[slug]["tajima"]["passed"])
    item["colorsPreserved"] = before[slug]["dst"]["colorCount"] == after[slug]["dst"]["colorCount"]
    rows.append(item)

aggregate = {}
for name in metrics:
    old = [row[name]["before"] for row in rows]
    new = [row[name]["after"] for row in rows]
    aggregate[name] = {
        "beforeTotal": round(sum(old), 3),
        "afterTotal": round(sum(new), 3),
        "totalChangePct": change(sum(old), sum(new)),
        "beforeMedian": round(statistics.median(old), 3),
        "afterMedian": round(statistics.median(new), 3),
        "beforeP95": sorted(old)[max(0, round((len(old) - 1) * .95))],
        "afterP95": sorted(new)[max(0, round((len(new) - 1) * .95))],
    }

gates = {
    "allFixturesMeasured": before_data["failed"] == 0 and after_data["failed"] == 0,
    "tajimaValid": all(row["tajimaPassed"] for row in rows),
    "colorsPreserved": all(row["colorsPreserved"] for row in rows),
    "maxStitchLengthImproved": aggregate["maxStitchLengthMm"]["totalChangePct"] < 0,
    "p95StitchLengthImproved": aggregate["p95StitchLengthMm"]["totalChangePct"] < 0,
    "crossingsImproved": aggregate["crossingStitches"]["totalChangePct"] < 0,
    "localDensityImproved": aggregate["maxLocalDensity"]["totalChangePct"] < 0,
    "overlapNotWorse": aggregate["overlappingSegments"]["totalChangePct"] <= 0,
    "jumpsNotWorse": aggregate["jumps"]["totalChangePct"] <= 0,
    "engineP95Improved30Pct": aggregate["engineMs"]["afterP95"] <= aggregate["engineMs"]["beforeP95"] * .7,
    "nodeCountNotWorse": aggregate["nodeCount"]["totalChangePct"] <= 0,
}
result = {
    "before": str(BEFORE.relative_to(HERE)),
    "after": str(AFTER.relative_to(HERE)),
    "physicallyValidated": False,
    "fixtures": rows,
    "aggregate": aggregate,
    "gates": gates,
    "promotable": all(gates.values()),
}
(HERE / "comparacion-v2-v3.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

table = [
    "| Fixture | engine | max stitch | p95 stitch | cruces | overlap | density | jumps | objetos | nodos |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
]
for row in rows:
    cell = lambda name: f'{row[name]["before"]:g} → {row[name]["after"]:g}'
    table.append(f'| {row["fixture"]} | {cell("engineMs")} | {cell("maxStitchLengthMm")} | {cell("p95StitchLengthMm")} | {cell("crossingStitches")} | {cell("overlappingSegments")} | {cell("maxLocalDensity")} | {cell("jumps")} | {cell("objectCount")} | {cell("nodeCount")} |')
(HERE / "COMPARACION.md").write_text("# Comparación v2 → experimental-v3\n\nValores `before → after`; tiempos en ms y longitudes en mm.\n\n" + "\n".join(table) + "\n", encoding="utf-8")
print(json.dumps({"promotable": result["promotable"], "gates": gates, "aggregate": aggregate}, ensure_ascii=False))
