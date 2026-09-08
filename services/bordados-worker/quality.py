"""Métricas reproducibles de calidad para un plan de puntadas.

El DST ya no sabe de qué objeto ni de qué tipo de puntada vino cada bloque.
Por eso este módulo separa dos fuentes de verdad:

* ``analyze_design_geometry`` mide semántica y complejidad ANTES del motor.
* ``analyze_stitch_plan`` mide únicamente movimientos que existen en el DST.

La suite de calidad obtiene métricas por objeto digitizando cada objeto de
forma aislada. No se intenta reconstruir esa identidad desde Tajima.
"""
from __future__ import annotations

import math
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable

import pyembroidery as pe
from PIL import Image, ImageDraw


def _percentile(values: list[float], percentile: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    position = (len(ordered) - 1) * percentile
    low = int(math.floor(position))
    high = int(math.ceil(position))
    if low == high:
        return ordered[low]
    fraction = position - low
    return ordered[low] * (1 - fraction) + ordered[high] * fraction


def _orientation_delta(first: float, second: float) -> float:
    """Cambio de orientación, no de sentido, dentro de [0, 90] grados."""
    delta = abs(first - second) % 180
    return min(delta, 180 - delta)


def _proper_intersection(
    a: tuple[float, float],
    b: tuple[float, float],
    c: tuple[float, float],
    d: tuple[float, float],
    epsilon: float = 1e-7,
) -> bool:
    """Cruce interior entre segmentos; tocar un endpoint no cuenta."""
    def cross(p: tuple[float, float], q: tuple[float, float], r: tuple[float, float]) -> float:
        return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])

    first = cross(a, b, c)
    second = cross(a, b, d)
    third = cross(c, d, a)
    fourth = cross(c, d, b)
    return (
        ((first > epsilon and second < -epsilon) or (first < -epsilon and second > epsilon))
        and ((third > epsilon and fourth < -epsilon) or (third < -epsilon and fourth > epsilon))
    )


def _overlap_length(
    a: tuple[float, float],
    b: tuple[float, float],
    c: tuple[float, float],
    d: tuple[float, float],
    epsilon: float = 0.06,
) -> float:
    """Longitud solapada de dos segmentos casi colineales, en milímetros."""
    ab = (b[0] - a[0], b[1] - a[1])
    cd = (d[0] - c[0], d[1] - c[1])
    length_ab = math.hypot(*ab)
    length_cd = math.hypot(*cd)
    if length_ab < epsilon or length_cd < epsilon:
        return 0.0
    cross_dirs = abs(ab[0] * cd[1] - ab[1] * cd[0]) / (length_ab * length_cd)
    if cross_dirs > math.sin(math.radians(4)):
        return 0.0
    distance_c = abs(ab[0] * (c[1] - a[1]) - ab[1] * (c[0] - a[0])) / length_ab
    distance_d = abs(ab[0] * (d[1] - a[1]) - ab[1] * (d[0] - a[0])) / length_ab
    if max(distance_c, distance_d) > epsilon:
        return 0.0
    ux, uy = ab[0] / length_ab, ab[1] / length_ab
    projection = sorted((0.0, length_ab, (c[0] - a[0]) * ux + (c[1] - a[1]) * uy, (d[0] - a[0]) * ux + (d[1] - a[1]) * uy))
    # Para dos intervalos hay solape si los dos valores centrales pertenecen a
    # intervalos distintos. La forma explícita evita falsos positivos separados.
    c0, c1 = sorted(((c[0] - a[0]) * ux + (c[1] - a[1]) * uy, (d[0] - a[0]) * ux + (d[1] - a[1]) * uy))
    return max(0.0, min(length_ab, c1) - max(0.0, c0))


def analyze_design_geometry(design: dict[str, Any], svg_bytes: int | None = None) -> dict[str, Any]:
    """Complejidad y semántica confiables antes de perderlas en DST."""
    objects = design.get("objects") or []
    widths: list[float] = []
    for obj in objects:
        if obj.get("stitch", {}).get("type") != "satin":
            continue
        stroke_width = obj.get("stitch", {}).get("strokeWidthMm")
        quality = obj.get("quality") or {}
        if stroke_width is not None:
            widths.append(float(stroke_width))
        elif quality.get("averageWidthMm") is not None:
            widths.append(float(quality["averageWidthMm"]))
    node_count = sum(int(obj.get("nodeCount", 0)) for obj in objects)
    path_count = sum((obj.get("geometry", {}).get("d", "").count("M") + obj.get("geometry", {}).get("d", "").count("m")) for obj in objects)
    by_type = Counter(obj.get("stitch", {}).get("type") for obj in objects)
    representation = Counter(
        (obj.get("quality") or {}).get("representationDecision")
        for obj in objects
        if (obj.get("quality") or {}).get("representationDecision")
    )
    quality_blocks = [obj.get("quality") or {} for obj in objects]
    average_width = sum(widths) / len(widths) if widths else 0.0
    variance = sum((width - average_width) ** 2 for width in widths) / len(widths) if widths else 0.0
    result: dict[str, Any] = {
        "objectCount": len(objects),
        "pathCount": path_count,
        "nodeCount": node_count,
        # En este contrato cada comando de path es un segmento como máximo; es
        # la cuenta estable disponible sin aproximar curvas a polígonos.
        "segmentCount": max(0, node_count - path_count),
        "satinColumnCount": by_type["satin"],
        "fillRegionCount": by_type["fill"],
        "runningPathCount": by_type["running"],
        "junctionCount": sum(int(obj.get("quality", {}).get("junctionCount", 0)) for obj in objects),
        "representationDecision": {
            "strokeV2": representation["stroke-v2"],
            "railsV3": representation["rails-v3"],
            "strokeV2Percent": round(100 * representation["stroke-v2"] / max(1, sum(representation.values())), 1),
            "railsV3Percent": round(100 * representation["rails-v3"] / max(1, sum(representation.values())), 1),
        },
        "sampling": {
            "rawCenterlineNodes": sum(int(item.get("rawCenterlineNodes", 0)) for item in quality_blocks),
            "rawRailNodes": sum(int(item.get("rawRailNodes", 0)) for item in quality_blocks),
            "finalRailNodes": sum(int(item.get("finalRailNodes", 0)) for item in quality_blocks),
            "rungsBefore": sum(int(item.get("rungsBefore", 0)) for item in quality_blocks),
            "rungsAfter": sum(int(item.get("rungsAfter", 0)) for item in quality_blocks),
        },
        "underlay": {
            "layers": sum(int(item.get("underlayLayers", 0)) for item in quality_blocks),
            "estimatedStitches": sum(int(item.get("estimatedUnderlayStitches", 0)) for item in quality_blocks),
        },
        "joins": [item["join"] for item in quality_blocks if item.get("join")],
        "satin": {
            "minWidthMm": round(min(widths), 3) if widths else None,
            "maxWidthMm": round(max(widths), 3) if widths else None,
            "averageWidthMm": round(average_width, 3) if widths else None,
            "widthVariance": round(variance, 5) if widths else None,
        },
    }
    if svg_bytes is not None:
        result["svgBytes"] = svg_bytes
    return result


def _stitch_segments(pattern: pe.EmbPattern) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    segments: list[dict[str, Any]] = []
    previous: tuple[float, float] | None = None
    counts: Counter[int] = Counter()
    jump_lengths: list[float] = []
    stitch_lengths: list[float] = []
    for order, stitch in enumerate(pattern.stitches):
        x, y, command = float(stitch[0]) / 10, float(stitch[1]) / 10, int(stitch[2]) & pe.COMMAND_MASK
        counts[command] += 1
        point = (x, y)
        if previous is not None and command in (pe.STITCH, pe.JUMP):
            length = math.dist(previous, point)
            if command == pe.STITCH:
                stitch_lengths.append(length)
                if length > 1e-6:
                    segments.append({
                        "order": order,
                        "start": previous,
                        "end": point,
                        "length": length,
                        "angle": math.degrees(math.atan2(point[1] - previous[1], point[0] - previous[0])) % 180,
                    })
            else:
                jump_lengths.append(length)
        previous = point
    return segments, {
        "counts": counts,
        "stitchLengths": stitch_lengths,
        "jumpLengths": jump_lengths,
    }


def _spatial_pairs(segments: list[dict[str, Any]], cell_mm: float = 2.0) -> Iterable[tuple[int, int]]:
    cells: dict[tuple[int, int], list[int]] = defaultdict(list)
    for index, segment in enumerate(segments):
        xs = (segment["start"][0], segment["end"][0])
        ys = (segment["start"][1], segment["end"][1])
        left, right = math.floor(min(xs) / cell_mm), math.floor(max(xs) / cell_mm)
        top, bottom = math.floor(min(ys) / cell_mm), math.floor(max(ys) / cell_mm)
        for cell_x in range(left, right + 1):
            for cell_y in range(top, bottom + 1):
                cells[(cell_x, cell_y)].append(index)
    emitted: set[tuple[int, int]] = set()
    for indices in cells.values():
        for offset, first in enumerate(indices):
            for second in indices[offset + 1:]:
                pair = (min(first, second), max(first, second))
                if pair in emitted:
                    continue
                emitted.add(pair)
                yield pair


def analyze_stitch_plan(
    pattern: pe.EmbPattern,
    *,
    stitch_type: str | None = None,
    long_stitch_threshold_mm: float = 6.0,
    sharp_direction_threshold_deg: float = 55.0,
    fan_angle_threshold_deg: float = 40.0,
    local_cell_mm: float = 1.0,
) -> dict[str, Any]:
    """Mide sólo hechos observables del plan de puntadas final."""
    segments, raw = _stitch_segments(pattern)
    counts: Counter[int] = raw["counts"]
    lengths: list[float] = raw["stitchLengths"]
    jump_lengths: list[float] = raw["jumpLengths"]

    direction_changes: list[float] = []
    for previous, current in zip(segments, segments[1:]):
        # Un salto o cambio de bloque rompe la continuidad. Sólo comparar
        # puntadas realmente adyacentes en el archivo.
        if current["order"] != previous["order"] + 1:
            continue
        direction_changes.append(_orientation_delta(previous["angle"], current["angle"]))

    local_counts: Counter[tuple[int, int]] = Counter()
    for segment in segments:
        midpoint = ((segment["start"][0] + segment["end"][0]) / 2, (segment["start"][1] + segment["end"][1]) / 2)
        local_counts[(math.floor(midpoint[0] / local_cell_mm), math.floor(midpoint[1] / local_cell_mm))] += 1

    crossing_pairs = 0
    crossing_stitches: set[int] = set()
    overlaps = 0
    overlap_length = 0.0
    comparisons = 0
    comparison_limit = 2_000_000
    truncated = False
    for first_index, second_index in _spatial_pairs(segments):
        if comparisons >= comparison_limit:
            truncated = True
            break
        if abs(first_index - second_index) <= 2:
            continue
        comparisons += 1
        first, second = segments[first_index], segments[second_index]
        # El center-walk cruza perpendicularmente la cubierta satin y eso es
        # intencional. Sólo contamos cruces entre puntadas de orientación
        # comparable; son los que delatan rails invertidos o abanicos que se
        # repliegan sobre sí mismos.
        comparable = _orientation_delta(first["angle"], second["angle"]) <= 50
        if comparable and min(first["length"], second["length"]) >= .6 and _proper_intersection(first["start"], first["end"], second["start"], second["end"]):
            crossing_pairs += 1
            crossing_stitches.update((first_index, second_index))
        overlap = _overlap_length(first["start"], first["end"], second["start"], second["end"])
        if overlap >= 0.2:
            overlaps += 1
            overlap_length += overlap

    stitch_count = counts[pe.STITCH]
    color_changes = counts[pe.COLOR_CHANGE] + counts[pe.NEEDLE_SET]
    max_direction = max(direction_changes, default=0.0)
    fan_stitches = sum(
        1
        for segment, delta in zip(segments[1:], direction_changes)
        if segment["length"] > long_stitch_threshold_mm and delta > fan_angle_threshold_deg
    )
    result: dict[str, Any] = {
        "stitchCount": stitch_count,
        # Sólo se completa por tipo cuando la corrida es de un objeto aislado y
        # el caller conoce su semántica. En un DST mixto quedan explícitamente null.
        "runningStitches": stitch_count if stitch_type == "running" else (0 if stitch_type else None),
        "satinStitches": stitch_count if stitch_type == "satin" else (0 if stitch_type else None),
        "fillStitches": stitch_count if stitch_type == "fill" else (0 if stitch_type else None),
        "jumps": counts[pe.JUMP],
        "trims": counts[pe.TRIM],
        "colorChanges": color_changes,
        "maxStitchLengthMm": round(max(lengths, default=0.0), 3),
        "p95StitchLengthMm": round(_percentile(lengths, .95), 3),
        "averageStitchLengthMm": round(sum(lengths) / len(lengths), 3) if lengths else 0.0,
        "stitchesAboveThreshold": sum(length > long_stitch_threshold_mm for length in lengths),
        "maxJumpLengthMm": round(max(jump_lengths, default=0.0), 3),
        "estimatedThreadLengthMm": round(sum(lengths) + sum(jump_lengths), 1),
        "directionChangeDegrees": {
            "average": round(sum(direction_changes) / len(direction_changes), 3) if direction_changes else 0.0,
            "p95": round(_percentile(direction_changes, .95), 3),
        },
        "maxDirectionChange": round(max_direction, 3),
        "numberOfSharpDirectionChanges": sum(delta > sharp_direction_threshold_deg for delta in direction_changes),
        "maxAngleDeltaBetweenAdjacentStitches": round(max_direction, 3),
        "numberOfFanStitches": fan_stitches,
        "numberOfCrossingStitches": len(crossing_stitches),
        "overlappingSegments": overlaps,
        "overlapDensity": round(overlap_length / max(sum(lengths), 1e-6), 5),
        "localStitchDensity": {
            "cellMm": local_cell_mm,
            "occupiedCells": len(local_counts),
            "averagePerOccupiedCell": round(sum(local_counts.values()) / max(len(local_counts), 1), 3),
        },
        "maxLocalDensity": max(local_counts.values(), default=0),
        "analysis": {
            "crossingComparisons": comparisons,
            "crossingPairs": crossing_pairs,
            "crossingAnalysisTruncated": truncated,
        },
    }
    return result


def render_stitch_plot(pattern: pe.EmbPattern, palette: list[str], target: Path) -> None:
    """Vista técnica: hilo sólido, saltos discontinuos y puntos de aguja."""
    min_x, min_y, max_x, max_y = pattern.bounds()
    width_mm, height_mm = max(1.0, (max_x - min_x) / 10), max(1.0, (max_y - min_y) / 10)
    scale = min(1100 / width_mm, 720 / height_mm)
    margin = 48
    image = Image.new("RGB", (round(width_mm * scale + margin * 2), round(height_mm * scale + margin * 2)), "#ffffff")
    draw = ImageDraw.Draw(image, "RGBA")
    previous: tuple[float, float] | None = None
    block = 0
    for x, y, command in pattern.stitches:
        kind = int(command) & pe.COMMAND_MASK
        if kind in (pe.COLOR_CHANGE, pe.NEEDLE_SET):
            block += 1
        point = (margin + (x - min_x) / 10 * scale, margin + (y - min_y) / 10 * scale)
        if previous is not None and kind == pe.STITCH:
            color = palette[min(block, len(palette) - 1)] if palette else "#151515"
            draw.line((previous, point), fill=color + "d8", width=max(1, round(scale * .045)))
            draw.ellipse((point[0] - 1.2, point[1] - 1.2, point[0] + 1.2, point[1] + 1.2), fill="#00000070")
        elif previous is not None and kind == pe.JUMP:
            steps = max(1, int(math.dist(previous, point) / 10))
            for step in range(0, steps, 2):
                start = step / steps
                end = min(1.0, (step + 1) / steps)
                draw.line((previous[0] + (point[0] - previous[0]) * start, previous[1] + (point[1] - previous[1]) * start, previous[0] + (point[0] - previous[0]) * end, previous[1] + (point[1] - previous[1]) * end), fill="#db277780", width=1)
        previous = point
    image.save(target, optimize=True)


def render_embroidered_preview(pattern: pe.EmbPattern, palette: list[str], target: Path) -> None:
    """Simulación aproximada de hilo; nunca se presenta como test sew."""
    min_x, min_y, max_x, max_y = pattern.bounds()
    width_mm, height_mm = max(1.0, (max_x - min_x) / 10), max(1.0, (max_y - min_y) / 10)
    scale = min(1100 / width_mm, 720 / height_mm)
    margin = 56
    image = Image.new("RGB", (round(width_mm * scale + margin * 2), round(height_mm * scale + margin * 2)), "#ece7dc")
    draw = ImageDraw.Draw(image, "RGBA")
    previous: tuple[float, float] | None = None
    block = 0
    for x, y, command in pattern.stitches:
        kind = int(command) & pe.COMMAND_MASK
        if kind in (pe.COLOR_CHANGE, pe.NEEDLE_SET):
            block += 1
        point = (margin + (x - min_x) / 10 * scale, margin + (y - min_y) / 10 * scale)
        if previous is not None and kind == pe.STITCH:
            color = palette[min(block, len(palette) - 1)] if palette else "#151515"
            width = max(2, round(scale * .11))
            draw.line((previous[0] + 1, previous[1] + 1, point[0] + 1, point[1] + 1), fill="#00000028", width=width + 2)
            draw.line((previous, point), fill=color + "e8", width=width)
            draw.line((previous[0] - .45, previous[1] - .45, point[0] - .45, point[1] - .45), fill="#ffffff42", width=max(1, width // 3))
        previous = point
    image.save(target, optimize=True)
