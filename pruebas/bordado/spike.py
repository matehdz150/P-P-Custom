#!/usr/bin/env python3
"""Spike aislado: raster/geometría -> Ink/Stitch -> DST -> validación.

No importa código de Kustto ni escribe fuera de pruebas/bordado. Los casos son
sintéticos y deliberadamente pequeños: miden la etapa de preparación y
digitización, no pretenden ser el pipeline final de producción.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import subprocess
import time
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import pyembroidery as pe
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
CASES_DIR = ROOT / "casos"
PX_PER_MM = 10
CANVAS_MM = (90.0, 60.0)
INKSTITCH_VERSION = "3.3.0"


@dataclass
class Case:
    slug: str
    label: str
    source_kind: str
    max_colors: int
    palette_hint: list[str]
    expected: str
    geometry_objects: list[dict[str, Any]] = field(default_factory=list)
    preparation: dict[str, Any] = field(default_factory=dict)


CASES = [
    Case(
        "01-texto-simple",
        "Texto simple",
        "fabric-text-known-geometry",
        1,
        ["#171717"],
        "accept",
    ),
    Case(
        "02-logo-monocromo",
        "Logo monocromo con contraformas",
        "transparent-raster",
        1,
        ["#111111"],
        "accept",
    ),
    Case(
        "03-logo-cuatro-colores",
        "Logo de cuatro colores",
        "transparent-raster",
        4,
        ["#2457d6", "#f05a3f", "#acd633", "#171717"],
        "accept",
    ),
    Case(
        "04-ilustracion",
        "Ilustración simplificada",
        "opaque-raster",
        6,
        ["#efb52d", "#ef6b45", "#315d9b", "#f2ead8", "#367c4a", "#74452a"],
        "review",
    ),
    Case(
        "05-imagen-compleja",
        "Imagen con degradado, ruido y componentes pequeños",
        "opaque-raster",
        10,
        [],
        "reject",
    ),
]


def mm(v: float) -> int:
    return round(v * PX_PER_MM)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for block in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size=size)
        except OSError:
            continue
    return ImageFont.load_default()


def draw_star(draw: ImageDraw.ImageDraw, center: tuple[float, float], outer: float, inner: float, fill: str) -> None:
    cx, cy = center
    points = []
    for i in range(10):
        angle = -math.pi / 2 + i * math.pi / 5
        radius = outer if i % 2 == 0 else inner
        points.append((cx + math.cos(angle) * radius, cy + math.sin(angle) * radius))
    draw.polygon(points, fill=fill)


def create_original(case: Case, out: Path) -> None:
    width, height = (mm(CANVAS_MM[0]), mm(CANVAS_MM[1]))

    if case.slug == "01-texto-simple":
        image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        draw.text((mm(6), mm(19)), "KUSTTO", font=font(mm(12)), fill="#171717", anchor="lm")
    elif case.slug == "02-logo-monocromo":
        image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        draw.ellipse((mm(20), mm(5), mm(70), mm(55)), fill="#111111")
        draw.ellipse((mm(29), mm(14), mm(61), mm(46)), fill=(0, 0, 0, 0))
        draw_star(draw, (mm(45), mm(30)), mm(12), mm(5.2), "#111111")
    elif case.slug == "03-logo-cuatro-colores":
        image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        draw.rounded_rectangle((mm(10), mm(10), mm(80), mm(50)), radius=mm(7), fill="#2457d6")
        draw.ellipse((mm(16), mm(16), mm(44), mm(44)), fill="#f05a3f")
        draw.polygon([(mm(48), mm(39)), (mm(61), mm(15)), (mm(75), mm(39))], fill="#acd633")
        draw.ellipse((mm(26), mm(26), mm(34), mm(34)), fill="#171717")
    elif case.slug == "04-ilustracion":
        image = Image.new("RGBA", (width, height), "#ffffff")
        draw = ImageDraw.Draw(image)
        draw.ellipse((mm(8), mm(7), mm(26), mm(25)), fill="#efb52d")
        draw.polygon([(mm(8), mm(50)), (mm(34), mm(18)), (mm(57), mm(50))], fill="#ef6b45")
        draw.polygon([(mm(31), mm(50)), (mm(60), mm(14)), (mm(84), mm(50))], fill="#315d9b")
        draw.polygon([(mm(49), mm(27)), (mm(60), mm(14)), (mm(68), mm(27)), (mm(61), mm(24))], fill="#f2ead8")
        draw.rectangle((mm(72), mm(31), mm(76), mm(51)), fill="#74452a")
        draw.polygon([(mm(63), mm(39)), (mm(74), mm(20)), (mm(84), mm(39))], fill="#367c4a")
        draw.polygon([(mm(65), mm(45)), (mm(74), mm(28)), (mm(82), mm(45))], fill="#367c4a")
    else:
        rng = np.random.default_rng(20260905)
        y, x = np.mgrid[0:height, 0:width]
        base = np.empty((height, width, 3), dtype=np.float32)
        base[:, :, 0] = 35 + 210 * x / width
        base[:, :, 1] = 35 + 180 * y / height
        base[:, :, 2] = 205 - 150 * x / width + 30 * np.sin(y / 12)
        base += rng.normal(0, 20, base.shape)
        arr = np.uint8(np.clip(base, 0, 255))
        image = Image.fromarray(arr).convert("RGBA")
        draw = ImageDraw.Draw(image)
        colors = ["#f04444", "#36b36a", "#315fd1", "#f2c641", "#8d49c7", "#171717"]
        for i in range(260):
            cx = int(rng.integers(mm(2), width - mm(2)))
            cy = int(rng.integers(mm(2), height - mm(2)))
            radius = int(rng.integers(mm(0.15), mm(1.15)))
            draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=colors[i % len(colors)])

    image.save(out)


def input_metrics(image: Image.Image) -> dict[str, Any]:
    rgba = np.asarray(image.convert("RGBA"))
    alpha = rgba[:, :, 3]
    visible = alpha > 24
    rgb = rgba[:, :, :3]
    # Los canales RGB de un píxel transparente no describen lo que ve el
    # usuario. Componer solamente para medir evita clasificar como "sin bordes"
    # un logo negro recortado sobre transparencia.
    analysis_rgb = np.where(visible[:, :, None], rgb, 255).astype(np.uint8)
    gray = cv2.cvtColor(analysis_rgb, cv2.COLOR_RGB2GRAY)
    edges = cv2.Canny(gray, 70, 150)
    border = np.concatenate((rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]), axis=0)
    border_std = float(np.mean(np.std(border.astype(np.float32), axis=0)))

    sample = rgb[visible][:: max(1, int(np.count_nonzero(visible) / 120_000))]
    sample_image = Image.fromarray(sample.reshape(1, -1, 3))
    quantized = sample_image.quantize(colors=32, method=Image.Quantize.MEDIANCUT)
    counts = np.asarray(quantized.getcolors(maxcolors=33) or [], dtype=np.float64)
    probabilities = counts[:, 0] / counts[:, 0].sum() if len(counts) else np.array([1.0])
    entropy = float(-(probabilities * np.log2(probabilities + 1e-12)).sum())
    laplacian = cv2.Laplacian(gray, cv2.CV_32F)

    return {
        "alphaCoverage": round(float(np.mean(visible)), 4),
        "hasMeaningfulTransparency": bool(np.mean(alpha < 250) > 0.01),
        "colorEntropyBits32": round(entropy, 3),
        "edgeDensity": round(float(np.mean(edges > 0)), 4),
        "borderUniformity": round(max(0.0, 1.0 - border_std / 80.0), 4),
        "textureLaplacianVariance": round(float(np.var(laplacian)), 2),
    }


def svg_header(width_mm: float, height_mm: float) -> str:
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
     xmlns:inkstitch="http://inkstitch.org/namespace"
     version="1.1" width="{width_mm}mm" height="{height_mm}mm"
     viewBox="0 0 {width_mm} {height_mm}">
  <metadata>
    <inkstitch:min_stitch_len_mm>0.3</inkstitch:min_stitch_len_mm>
    <inkstitch:collapse_len_mm>3</inkstitch:collapse_len_mm>
    <inkstitch:min_satin_stroke_width_mm>1.5</inkstitch:min_satin_stroke_width_mm>
    <inkstitch:inkstitch_svg_version>4</inkstitch:inkstitch_svg_version>
  </metadata>'''


def text_geometry(case: Case, out: Path) -> list[str]:
    paths = [
        ("K-asta", "M 7,20 V 6"),
        ("K-superior", "M 7,13 L 14,6"),
        ("K-inferior", "M 7,13 L 14,20"),
        ("U", "M 18,6 V 16 C 18,21 27,21 27,16 V 6"),
        ("S", "M 39,7 C 30,3 29,12 35,13 C 43,14 42,22 31,19"),
        ("T1-barra", "M 45,6 H 57"),
        ("T1-asta", "M 51,6 V 20"),
        ("T2-barra", "M 60,6 H 72"),
        ("T2-asta", "M 66,6 V 20"),
        ("O", "M 81,6 C 72,6 72,20 81,20 C 89,20 89,6 81,6 Z"),
    ]
    objects = []
    body = [svg_header(*CANVAS_MM)]
    for index, (name, d) in enumerate(paths):
        body.append(
            f'''  <path id="letra-{index + 1}" d="{d}" fill="none" stroke="#171717"
        stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"
        inkstitch:satin_column="true" inkstitch:zigzag_spacing_mm="0.42"
        inkstitch:pull_compensation_mm="0.2" inkstitch:center_walk_underlay="true"
        inkstitch:contour_underlay="false" inkstitch:max_stitch_length_mm="8" />'''
        )
        objects.append({
            "id": f"letra-{index + 1}",
            "source": {"kind": "text", "glyph": name, "fontStrategy": "stroke-safe-prototype"},
            "stitchType": "satin",
            "threadColor": "#171717",
            "density": {"zigzagSpacingMm": 0.42},
            "underlay": ["center-walk"],
            "pullCompensationMm": 0.2,
            "order": index,
        })
    body.append("</svg>\n")
    out.write_text("\n".join(body), encoding="utf-8")
    case.geometry_objects = objects
    case.preparation = {
        "strategy": "known-text-to-centerlines",
        "textHeightMm": 14,
        "nominalStrokeWidthMm": 2.2,
        "smallestCounterMm": 2.6,
        "componentsRaw": len(paths),
        "componentsKept": len(paths),
        "componentsRemoved": 0,
    }
    return ["#171717"]


def estimate_background(rgb: np.ndarray) -> tuple[np.ndarray, list[int], float]:
    border = np.concatenate((rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]), axis=0)
    palette_image = Image.fromarray(border.reshape(1, -1, 3)).quantize(colors=4)
    dominant_index = max(palette_image.getcolors() or [(0, 0)])[1]
    palette = palette_image.getpalette() or []
    color = palette[dominant_index * 3:dominant_index * 3 + 3]
    border_distance = np.linalg.norm(border.astype(np.float32) - np.array(color, dtype=np.float32), axis=1)
    uniformity = float(np.mean(border_distance < 18))

    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
    bg_lab = cv2.cvtColor(np.uint8([[color]]), cv2.COLOR_RGB2LAB)[0, 0].astype(np.float32)
    distance = np.linalg.norm(lab - bg_lab, axis=2)
    return distance > 15, [int(x) for x in color], uniformity


def quantized_palette(rgb: np.ndarray, artwork: np.ndarray, max_colors: int) -> tuple[np.ndarray, list[str], list[int]]:
    pixels = rgb[artwork]
    step = max(1, len(pixels) // 180_000)
    sampled = pixels[::step]
    sample_image = Image.fromarray(sampled.reshape(1, -1, 3))
    quantized = sample_image.quantize(colors=max_colors, method=Image.Quantize.MEDIANCUT)
    raw_palette = quantized.getpalette() or []
    counted = sorted(quantized.getcolors(maxcolors=max_colors + 1) or [], reverse=True)
    colors = np.array([raw_palette[i * 3:i * 3 + 3] for _, i in counted], dtype=np.float32)
    if len(colors) == 0:
        colors = np.array([[0, 0, 0]], dtype=np.float32)
    distances = np.sum((rgb[:, :, None, :].astype(np.float32) - colors[None, None, :, :]) ** 2, axis=3)
    labels = np.argmin(distances, axis=2)
    hexes = ["#" + "".join(f"{int(c):02x}" for c in color) for color in colors]
    counts = [int(np.count_nonzero((labels == i) & artwork)) for i in range(len(colors))]
    return labels, hexes, counts


def contour_path(contour: np.ndarray, epsilon_px: float) -> str | None:
    approx = cv2.approxPolyDP(contour, epsilon_px, True)
    if len(approx) < 3:
        return None
    points = approx[:, 0, :] / PX_PER_MM
    return "M " + " L ".join(f"{x:.2f},{y:.2f}" for x, y in points) + " Z"


def raster_geometry(case: Case, original: Path, out: Path, source_metrics: dict[str, Any]) -> list[str]:
    image = Image.open(original).convert("RGBA")
    rgba = np.asarray(image)
    rgb = rgba[:, :, :3]
    alpha = rgba[:, :, 3]
    alpha_signal = float(np.mean(alpha < 250)) > 0.01
    high_detail_input = (
        source_metrics["edgeDensity"] > 0.12
        and source_metrics["colorEntropyBits32"] > 3.0
        and source_metrics["textureLaplacianVariance"] > 1_000
    )
    minimum_area_mm2 = 1.8 if high_detail_input else 0.75
    component_cap = 140 if high_detail_input else 90
    if alpha_signal:
        artwork = alpha > 32
        background_color = None
        border_uniformity = None
    else:
        estimated, background_color, border_uniformity = estimate_background(rgb)
        artwork = estimated if border_uniformity >= 0.72 else np.ones(alpha.shape, dtype=bool)

    labels, palette, palette_counts = quantized_palette(rgb, artwork, case.max_colors)
    body = [svg_header(*CANVAS_MM)]
    objects: list[dict[str, Any]] = []
    raw_components = 0
    removed = 0
    candidates: list[dict[str, Any]] = []
    kernel = np.ones((3, 3), np.uint8)

    for color_index, color in enumerate(palette):
        if palette_counts[color_index] < max(20, int(np.count_nonzero(artwork) * 0.0015)):
            continue
        mask = np.uint8((labels == color_index) & artwork) * 255
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
        contours, hierarchy = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
        if hierarchy is None:
            continue
        hierarchy = hierarchy[0]
        raw_components += sum(1 for i in range(len(contours)) if hierarchy[i][3] == -1)

        for i, outer in enumerate(contours):
            if hierarchy[i][3] != -1:
                continue
            area_px = abs(cv2.contourArea(outer))
            child = hierarchy[i][2]
            holes = []
            while child != -1:
                area_px -= abs(cv2.contourArea(contours[child]))
                holes.append(contours[child])
                child = hierarchy[child][0]
            area_mm2 = area_px / (PX_PER_MM ** 2)
            if area_mm2 < minimum_area_mm2:
                removed += 1
                continue

            path_parts = [contour_path(outer, 1.2)]
            path_parts.extend(contour_path(hole, 1.0) for hole in holes)
            path_parts = [part for part in path_parts if part]
            if not path_parts:
                removed += 1
                continue
            x, y, w, h = cv2.boundingRect(outer)
            moments = cv2.moments(outer)
            cx = moments["m10"] / moments["m00"] if moments["m00"] else x + w / 2
            cy = moments["m01"] / moments["m00"] if moments["m00"] else y + h / 2
            candidates.append({
                "colorIndex": color_index,
                "color": color,
                "d": " ".join(path_parts),
                "areaMm2": round(area_mm2, 2),
                "boundsMm": [round(x / PX_PER_MM, 2), round(y / PX_PER_MM, 2), round(w / PX_PER_MM, 2), round(h / PX_PER_MM, 2)],
                "center": (cx / PX_PER_MM, cy / PX_PER_MM),
                "outer": contour_path(outer, 1.2),
            })

    # El orden de color evita re-enhebrados; dentro de cada color se usa vecino
    # más cercano. No reordena colores atravesando capas conocidas.
    ordered: list[dict[str, Any]] = []
    for color_index in range(len(palette)):
        pending = [item for item in candidates if item["colorIndex"] == color_index]
        cursor = (0.0, 0.0)
        while pending:
            chosen = min(pending, key=lambda item: math.dist(cursor, item["center"]))
            pending.remove(chosen)
            ordered.append(chosen)
            cursor = chosen["center"]

    if len(ordered) > component_cap:
        removed += len(ordered) - component_cap
        ordered = sorted(ordered, key=lambda item: item["areaMm2"], reverse=True)[:component_cap]
        ordered.sort(key=lambda item: (item["colorIndex"], item["center"][0], item["center"][1]))

    for index, item in enumerate(ordered):
        angle = [0, 45, -45, 90][item["colorIndex"] % 4]
        underlay = item["areaMm2"] >= 18
        trim = index < len(ordered) - 1 and math.dist(item["center"], ordered[index + 1]["center"]) > 8
        object_id = f"region-{index + 1}"
        body.append(
            f'''  <path id="{object_id}" d="{item['d']}" fill="{item['color']}" fill-rule="evenodd" stroke="none"
        inkstitch:fill_method="tatami_fill" inkstitch:angle="{angle}"
        inkstitch:row_spacing_mm="0.45" inkstitch:max_stitch_length_mm="4"
        inkstitch:fill_underlay="{'true' if underlay else 'false'}"
        inkstitch:pull_compensation_mm="0.15" inkstitch:trim_after="{'true' if trim else 'false'}" />'''
        )
        objects.append({
            "id": object_id,
            "source": {"kind": "raster-region", "paletteIndex": item["colorIndex"]},
            "geometry": {"svgPath": item["d"], "areaMm2": item["areaMm2"], "boundsMm": item["boundsMm"]},
            "stitchType": "fill",
            "threadColor": item["color"],
            "density": {"rowSpacingMm": 0.45},
            "angleDeg": angle,
            "underlay": ["tatami-sparse"] if underlay else [],
            "pullCompensationMm": 0.15,
            "maxStitchLengthMm": 4,
            "trimAfter": trim,
            "order": index,
        })

    # El caso monocromo añade un contorno running/bean. Es una decisión de
    # digitización; el mismo path de relleno por sí solo no define ese acabado.
    if case.slug == "02-logo-monocromo" and ordered:
        main = max(ordered, key=lambda item: item["areaMm2"])
        body.append(
            f'''  <path id="contorno-running" d="{main['outer']}" fill="none" stroke="{main['color']}" stroke-width="0.3"
        inkstitch:stroke_method="running_stitch" inkstitch:running_stitch_length_mm="2.2"
        inkstitch:bean_stitch_repeats="1" />'''
        )
        objects.append({
            "id": "contorno-running",
            "source": {"kind": "derived-outline"},
            "geometry": {"svgPath": main["outer"]},
            "stitchType": "running-bean",
            "threadColor": main["color"],
            "stitchLengthMm": 2.2,
            "order": len(objects),
        })

    body.append("</svg>\n")
    out.write_text("\n".join(body), encoding="utf-8")
    case.geometry_objects = objects
    case.preparation = {
        "strategy": "alpha-segmentation" if alpha_signal else "perimeter-background-and-color-segmentation",
        "backgroundColor": background_color,
        "borderBackgroundAgreement": round(border_uniformity, 4) if border_uniformity is not None else None,
        "paletteBeforeThreadMapping": palette,
        "componentsRaw": raw_components,
        "componentsKept": len(ordered),
        "componentsRemoved": removed,
        "highDetailInput": high_detail_input,
        "minimumKeptAreaMm2": minimum_area_mm2,
        "simplificationToleranceMm": 0.12,
    }
    return [palette[index] for index in sorted({item["colorIndex"] for item in ordered})]


def run_inkstitch(image_name: str, geometry: Path, dst: Path) -> tuple[float, str]:
    mount = str(geometry.parent.resolve())
    command = [
        "docker", "run", "--rm",
        "-e", "INKSTITCH_OFFLINE_SCRIPT=1",
        "-v", f"{mount}:/work", image_name,
        "--extension=output", "--format=dst", "/work/geometria.svg",
    ]
    started = time.perf_counter()
    with dst.open("wb") as output:
        result = subprocess.run(command, stdout=output, stderr=subprocess.PIPE, text=True, timeout=180)
    elapsed_ms = (time.perf_counter() - started) * 1000
    if result.returncode != 0 or dst.stat().st_size < 515:
        raise RuntimeError((result.stderr or "Ink/Stitch no produjo un DST válido").strip())
    return elapsed_ms, (result.stderr or "").strip()


def command_counts(pattern: pe.EmbPattern) -> Counter[int]:
    return Counter(int(stitch[2]) & pe.COMMAND_MASK for stitch in pattern.stitches)


def analyze_dst(dst: Path) -> tuple[pe.EmbPattern, dict[str, Any]]:
    pattern = pe.read(str(dst))
    if pattern is None:
        raise RuntimeError("pyembroidery no pudo abrir el DST")
    counts = command_counts(pattern)
    min_x, min_y, max_x, max_y = pattern.bounds()
    lengths = []
    thread_length = 0.0
    previous = None
    for x, y, command in pattern.stitches:
        kind = int(command) & pe.COMMAND_MASK
        if previous is not None and kind == pe.STITCH:
            length = math.dist(previous, (x, y)) / 10
            lengths.append(length)
            thread_length += length
        previous = (x, y)
    short = sum(1 for value in lengths if value < 0.3)
    long = sum(1 for value in lengths if value > 10.0)
    return pattern, {
        "widthMm": round((max_x - min_x) / 10, 1),
        "heightMm": round((max_y - min_y) / 10, 1),
        "boundsMm": [round(min_x / 10, 1), round(min_y / 10, 1), round(max_x / 10, 1), round(max_y / 10, 1)],
        "stitches": counts[pe.STITCH],
        "commands": len(pattern.stitches),
        "colorChanges": counts[pe.COLOR_CHANGE] + counts[pe.NEEDLE_SET],
        "jumps": counts[pe.JUMP],
        "trims": counts[pe.TRIM],
        "stops": counts[pe.STOP],
        "estimatedThreadLengthM": round(thread_length / 1000, 2),
        "minStitchLengthMm": round(min((value for value in lengths if value > 0), default=0), 2),
        "maxStitchLengthMm": round(max(lengths), 2) if lengths else 0,
        "zeroLengthStitches": sum(1 for value in lengths if value == 0),
        "shortStitchesUnder0_3mm": short,
        "longStitchesOver10mm": long,
    }


def analyze_raw_dst(dst: Path, parsed: dict[str, Any]) -> dict[str, Any]:
    """Validador Tajima pequeño, sin reutilizar pyembroidery/pystitch."""
    data = dst.read_bytes()
    header = data[:512].decode("ascii", errors="replace")
    payload = data[512:]
    aligned = len(payload) % 3 == 0
    records = [payload[i:i + 3] for i in range(0, len(payload) - 2, 3)]
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
        dx = delta(a, b, c, "x")
        dy = delta(a, b, c, "y")
        max_axis_delta = max(max_axis_delta, abs(dx), abs(dy))
        x += dx
        y += dy
        min_x, max_x = min(min_x, x), max(max_x, x)
        min_y, max_y = min(min_y, y), max(max_y, y)
        if c & 0xC3 == 0xC3:
            colors += 1
            movement_records.append(("color", dx, dy))
        elif c & 0x83 == 0x83:
            movement_records.append(("jump", dx, dy))
        else:
            movement_records.append(("stitch", dx, dy))
        decoded += 1

    # DST no tiene un opcode portable de trim. El escritor usado por Ink/Stitch
    # lo representa como tres saltos (+2, -4, +2), cuya suma es cero. Para
    # comparar con ST: hay que colapsar esas ternas a un comando lógico.
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

    raw_width = round((max_x - min_x) / 10, 1)
    raw_height = round((max_y - min_y) / 10, 1)
    header_records = header_number("ST:")
    header_colors = header_number("CO:")
    logical_records_including_end = decoded - 2 * encoded_trims + 1
    checks = {
        "headerIs512Bytes": len(data) >= 512 and header.startswith("LA:"),
        "payloadAlignedTo3Bytes": aligned,
        "hasEndRecord": ended,
        "headerRecordCountMatches": header_records == logical_records_including_end,
        "headerColorChangesMatch": header_colors == colors,
        "boundsMatchPyembroidery": abs(raw_width - parsed["widthMm"]) <= 0.1 and abs(raw_height - parsed["heightMm"]) <= 0.1,
        "maxAxisMovementRepresentable": max_axis_delta <= 121,
    }
    return {
        "passed": all(checks.values()),
        "checks": checks,
        "headerStitchRecords": header_records,
        "decodedRecordsBeforeEnd": decoded,
        "encodedTrimSequences": encoded_trims,
        "logicalRecordsIncludingEnd": logical_records_including_end,
        "headerColorChanges": header_colors,
        "decodedColorChanges": colors,
        "maxAxisDeltaTenthsMm": max_axis_delta,
        "decodedBoundsMm": [round(min_x / 10, 1), round(min_y / 10, 1), round(max_x / 10, 1), round(max_y / 10, 1)],
    }


def render_preview(pattern: pe.EmbPattern, palette: list[str], out: Path) -> None:
    min_x, min_y, max_x, max_y = pattern.bounds()
    width_mm = max(1, (max_x - min_x) / 10)
    height_mm = max(1, (max_y - min_y) / 10)
    scale = min(1100 / width_mm, 700 / height_mm)
    margin = 55
    width = round(width_mm * scale + margin * 2)
    height = round(height_mm * scale + margin * 2)
    image = Image.new("RGB", (width, height), "#f4f0e8")
    draw = ImageDraw.Draw(image, "RGBA")

    colors = palette or ["#222222"]
    block = 0
    previous = None
    for x, y, command in pattern.stitches:
        kind = int(command) & pe.COMMAND_MASK
        if kind in (pe.COLOR_CHANGE, pe.NEEDLE_SET):
            block += 1
        point = (margin + (x - min_x) / 10 * scale, margin + (y - min_y) / 10 * scale)
        if previous is not None and kind == pe.STITCH:
            color = colors[min(block, len(colors) - 1)]
            draw.line((previous, point), fill=color + "d9", width=max(1, round(scale * 0.07)))
        elif previous is not None and kind == pe.JUMP:
            draw.line((previous, point), fill="#d43b3b55", width=1)
        previous = point

    draw.rectangle((margin - 1, margin - 1, width - margin + 1, height - margin + 1), outline="#26231b55", width=1)
    image.save(out)


def validate(case: Case, source_metrics: dict[str, Any], preparation: dict[str, Any], dst_metrics: dict[str, Any], palette: list[str]) -> dict[str, Any]:
    issues = []

    def issue(code: str, severity: str, message: str, measured: Any, limit: Any) -> None:
        issues.append({"code": code, "severity": severity, "message": message, "measured": measured, "limit": limit})

    if dst_metrics["widthMm"] > CANVAS_MM[0] or dst_metrics["heightMm"] > CANVAS_MM[1]:
        issue("outside-area", "error", "El plan rebasa el área física del lado.", [dst_metrics["widthMm"], dst_metrics["heightMm"]], list(CANVAS_MM))
    if dst_metrics["stitches"] > 30_000:
        issue("stitch-count", "error", "Demasiadas puntadas para este tamaño de muestra.", dst_metrics["stitches"], 30_000)
    elif dst_metrics["stitches"] > 15_000:
        issue("stitch-count", "warning", "Conteo alto; requiere estimación de tiempo y costo.", dst_metrics["stitches"], 15_000)
    if len(palette) > 12:
        issue("thread-colors", "error", "Demasiados bloques de hilo para V1.", len(palette), 12)
    elif len(palette) > 8:
        issue("thread-colors", "warning", "Paleta alta; revisar contra el catálogo del taller.", len(palette), 8)
    if preparation.get("componentsKept", 0) > 80:
        issue("components", "error", "Demasiados componentes independientes tras simplificar.", preparation["componentsKept"], 80)
    if dst_metrics["longStitchesOver10mm"] > 0:
        issue("long-stitches", "warning", "Hay puntadas cercanas al límite mecánico.", dst_metrics["longStitchesOver10mm"], 0)
    if dst_metrics["stitches"] and dst_metrics["shortStitchesUnder0_3mm"] / dst_metrics["stitches"] > 0.03:
        issue("short-stitches", "warning", "Más de 3% de puntadas cae bajo 0.3 mm.", dst_metrics["shortStitchesUnder0_3mm"], round(dst_metrics["stitches"] * 0.03))
    if dst_metrics["jumps"] > 120:
        issue("jumps", "warning", "Muchos saltos; revisar ruteo y trims.", dst_metrics["jumps"], 120)
    if case.slug == "01-texto-simple":
        if preparation["textHeightMm"] < 6:
            issue("text-height", "error", "Texto menor a la altura segura inicial.", preparation["textHeightMm"], 6)
        if preparation["nominalStrokeWidthMm"] < 1.2:
            issue("text-stroke", "error", "Asta de letra demasiado estrecha.", preparation["nominalStrokeWidthMm"], 1.2)
        if preparation["smallestCounterMm"] < 1.0:
            issue("text-counter", "error", "Una contraforma se cerraría con facilidad.", preparation["smallestCounterMm"], 1.0)
    if source_metrics["edgeDensity"] > 0.2 and source_metrics["colorEntropyBits32"] > 4.0:
        issue("photographic-complexity", "error", "Textura y entropía indican contenido fotográfico/no digitizable automáticamente con confianza.", [source_metrics["edgeDensity"], source_metrics["colorEntropyBits32"]], [0.2, 4.0])
    elif case.source_kind == "opaque-raster" and len(palette) >= 5:
        issue("illustration-review", "warning", "Una ilustración multicapa requiere confirmar oclusiones, orden y resultado sobre tela.", len(palette), "revisión humana")

    errors = sum(1 for item in issues if item["severity"] == "error")
    warnings = sum(1 for item in issues if item["severity"] == "warning")
    confidence = max(0.0, min(1.0, 0.96 - errors * 0.35 - warnings * 0.08 - min(0.25, preparation.get("componentsRemoved", 0) * 0.002)))
    return {
        "passed": errors == 0,
        "decision": "accept" if errors == 0 and warnings == 0 else "review" if errors == 0 else "reject",
        "confidence": round(confidence, 2),
        "issues": issues,
        "limitsAre": "spike guardrails; calibrate by fabric/machine/test-sew before production",
    }


def run_case(case: Case, image_name: str) -> dict[str, Any]:
    case_dir = CASES_DIR / case.slug
    case_dir.mkdir(parents=True, exist_ok=True)
    original = case_dir / "original.png"
    geometry = case_dir / "geometria.svg"
    dst = case_dir / "diseno.dst"
    preview = case_dir / "preview.png"
    metadata_path = case_dir / "bordado.json"

    create_original(case, original)
    preparation_started = time.perf_counter()
    source = input_metrics(Image.open(original))
    palette = text_geometry(case, geometry) if case.slug == "01-texto-simple" else raster_geometry(case, original, geometry, source)
    preparation_ms = (time.perf_counter() - preparation_started) * 1000
    digitization_ms, stderr = run_inkstitch(image_name, geometry, dst)
    finishing_started = time.perf_counter()
    pattern, metrics = analyze_dst(dst)
    raw_validation = analyze_raw_dst(dst, metrics)
    metrics["dstSizeBytes"] = dst.stat().st_size
    metrics["estimatedMachineMinutesAt700Spm"] = round(metrics["stitches"] / 700 + metrics["colorChanges"] * 0.5, 1)
    validation = validate(case, source, case.preparation, metrics, palette)
    if not raw_validation["passed"]:
        validation["passed"] = False
        validation["decision"] = "reject"
        validation["confidence"] = 0
        validation["issues"].append({"code": "dst-structure", "severity": "error", "message": "La validación binaria independiente del DST no coincide.", "measured": raw_validation["checks"], "limit": "todos true"})
    render_preview(pattern, palette, preview)
    finishing_ms = (time.perf_counter() - finishing_started) * 1000
    metrics["preparationMs"] = round(preparation_ms, 1)
    metrics["digitizationMs"] = round(digitization_ms, 1)
    metrics["validationAndPreviewMs"] = round(finishing_ms, 1)
    metrics["processingMs"] = round(preparation_ms + digitization_ms + finishing_ms, 1)

    metadata = {
        "schemaVersion": 1,
        "case": {"id": case.slug, "label": case.label, "expectedDisposition": case.expected},
        "source": {"kind": case.source_kind, "file": "original.png", "sha256": sha256(original), "metrics": source},
        "physical": {"units": "mm", "embroideryArea": {"width": CANVAS_MM[0], "height": CANVAS_MM[1]}, "output": {"width": metrics["widthMm"], "height": metrics["heightMm"]}, "mustRedigitizeAfterScale": True},
        "colors": [{"order": index + 1, "hex": color, "threadCatalog": None} for index, color in enumerate(palette)],
        "objects": case.geometry_objects,
        "preparation": case.preparation,
        "digitization": {"engine": "Ink/Stitch", "version": INKSTITCH_VERSION, "format": "Tajima DST", "stderr": stderr or None},
        "dstStructuralValidation": raw_validation,
        "artifacts": {
            "preparedGeometry": {"file": "geometria.svg", "sha256": sha256(geometry)},
            "stitchPreview": {"file": "preview.png", "sha256": sha256(preview)},
            "machineFile": {"file": "diseno.dst", "sha256": sha256(dst)},
        },
        "metrics": metrics,
        "validation": validation,
    }
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {
        "case": case.slug,
        "label": case.label,
        "expected": case.expected,
        "decision": validation["decision"],
        "confidence": validation["confidence"],
        **metrics,
        "colors": len(palette),
        "components": case.preparation.get("componentsKept"),
        "issues": [item["code"] for item in validation["issues"]],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", default=os.environ.get("KUSTTO_INKSTITCH_IMAGE", "kustto-inkstitch-spike:local"))
    parser.add_argument("--only", choices=[case.slug for case in CASES])
    args = parser.parse_args()

    selected = [case for case in CASES if not args.only or case.slug == args.only]
    results = []
    for case in selected:
        print(f"[{case.slug}] preparando y digitizando...", flush=True)
        result = run_case(case, args.image)
        results.append(result)
        print(f"  {result['decision']}: {result['stitches']} puntadas, {result['processingMs']} ms", flush=True)

    if not args.only:
        summary = {
            "generatedBy": "pruebas/bordado/spike.py",
            "inkStitchVersion": INKSTITCH_VERSION,
            "machineFormat": "DST",
            "cases": results,
        }
        (ROOT / "resultados.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
