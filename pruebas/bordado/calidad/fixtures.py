"""Banco determinista de geometría para calidad de puntadas.

No pasa por el clasificador de raster: esta suite empieza justo donde termina
la preparación y pregunta si la trayectoria de hilo es buena.
"""
from __future__ import annotations

import hashlib
import html
import json
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent / "fixtures"
PROFILE = "experimental-v2-2026-09-06"
WIDTH = 90
HEIGHT = 60


def node_count(path: str) -> int:
    return len(re.findall(r"[MmLlHhVvCcSsQqTtAa]", path))


def satin(identifier: str, path: str, width: float = 2.6, color: str = "c0") -> dict[str, Any]:
    return {
        "id": identifier,
        "sourceObjectId": identifier,
        "sourceType": "text",
        "classification": "text",
        "colorId": color,
        "geometry": {"kind": "path", "d": path},
        "stitch": {"type": "satin", "strokeWidthMm": width, "spacingMm": .42, "pullCompensationMm": .15, "underlay": True},
        "bounds": {"xMm": 1, "yMm": 1, "widthMm": 88, "heightMm": 58},
        "nodeCount": node_count(path),
    }


def running(identifier: str, path: str, color: str = "c0") -> dict[str, Any]:
    item = satin(identifier, path, .3, color)
    item["stitch"] = {"type": "running", "strokeWidthMm": .3, "maxStitchLengthMm": 4}
    return item


def fill(identifier: str, path: str, color: str = "c0", angle: float = 0) -> dict[str, Any]:
    item = satin(identifier, path, 0, color)
    item["sourceType"] = "vector"
    item["classification"] = "logo"
    item["geometry"]["fillRule"] = "evenodd"
    item["stitch"] = {"type": "fill", "spacingMm": .45, "maxStitchLengthMm": 4, "angleDeg": angle, "underlay": True, "pullCompensationMm": .15}
    return item


def design(slug: str, objects: list[dict[str, Any]], palette: list[str] | None = None) -> dict[str, Any]:
    palette = palette or ["#171717"]
    return {
        "schemaVersion": 1,
        "sourceSnapshotHash": hashlib.sha256(slug.encode()).hexdigest(),
        "productId": "quality-fixture",
        "sideId": "front",
        "physical": {"widthMm": WIDTH, "heightMm": HEIGHT},
        "bounds": {"xMm": 1, "yMm": 1, "widthMm": 88, "heightMm": 58},
        "colors": [{"id": f"c{i}", "sourceHex": color, "displayHex": color, "order": i} for i, color in enumerate(palette)],
        "objects": objects,
        "metrics": {"componentCount": len(objects), "nodeCount": sum(item["nodeCount"] for item in objects), "colorCount": len(palette)},
        "preparation": {"profileVersion": PROFILE, "texto": {"satinColumns": sum(item["stitch"]["type"] == "satin" for item in objects), "runningPaths": sum(item["stitch"]["type"] == "running" for item in objects), "fillAreas": sum(item["stitch"]["type"] == "fill" for item in objects)}, "issues": []},
        "profileVersion": PROFILE,
        "engineVersion": "inkstitch-3.3.0",
    }


def glyph(letter: str, x: float, y: float = 18, scale: float = 1.0, prefix: str = "g") -> list[dict[str, Any]]:
    """Glifos de trazo conocido; ejercitan curvas y cruces sin depender de fuentes."""
    s = scale
    paths: dict[str, list[str]] = {
        "H": [f"M{x} {y}L{x} {y+24*s}", f"M{x+13*s} {y}L{x+13*s} {y+24*s}", f"M{x} {y+12*s}L{x+13*s} {y+12*s}"],
        "O": [f"M{x+7*s} {y}C{x+1*s} {y} {x} {y+5*s} {x} {y+12*s}C{x} {y+19*s} {x+1*s} {y+24*s} {x+7*s} {y+24*s}C{x+13*s} {y+24*s} {x+14*s} {y+19*s} {x+14*s} {y+12*s}C{x+14*s} {y+5*s} {x+13*s} {y} {x+7*s} {y}Z"],
        "e": [f"M{x+12*s} {y+15*s}C{x+9*s} {y+10*s} {x} {y+11*s} {x} {y+17*s}C{x} {y+25*s} {x+11*s} {y+26*s} {x+13*s} {y+20*s}M{x} {y+17*s}L{x+12*s} {y+17*s}"],
        "g": [f"M{x+12*s} {y+12*s}C{x+8*s} {y+9*s} {x} {y+11*s} {x} {y+18*s}C{x} {y+25*s} {x+9*s} {y+26*s} {x+12*s} {y+21*s}C{x+12*s} {y+29*s} {x+10*s} {y+34*s} {x+4*s} {y+34*s}C{x+1*s} {y+34*s} {x} {y+32*s} {x} {y+30*s}"],
        "t": [f"M{x+6*s} {y+2*s}L{x+6*s} {y+23*s}C{x+6*s} {y+26*s} {x+10*s} {y+26*s} {x+12*s} {y+24*s}", f"M{x} {y+10*s}L{x+12*s} {y+10*s}"],
        "d": [f"M{x+12*s} {y}L{x+12*s} {y+25*s}", f"M{x+11*s} {y+13*s}C{x+7*s} {y+9*s} {x} {y+11*s} {x} {y+18*s}C{x} {y+25*s} {x+8*s} {y+27*s} {x+12*s} {y+22*s}"],
        "R": [f"M{x} {y+24*s}L{x} {y}L{x+8*s} {y}C{x+15*s} {y} {x+15*s} {y+11*s} {x+8*s} {y+11*s}L{x} {y+11*s}", f"M{x+8*s} {y+11*s}L{x+15*s} {y+24*s}"],
        "s": [f"M{x+12*s} {y+12*s}C{x+8*s} {y+9*s} {x+1*s} {y+10*s} {x+1*s} {y+14*s}C{x+1*s} {y+18*s} {x+12*s} {y+16*s} {x+12*s} {y+21*s}C{x+12*s} {y+26*s} {x+4*s} {y+27*s} {x} {y+23*s}"],
        "n": [f"M{x} {y+11*s}L{x} {y+25*s}M{x} {y+15*s}C{x+4*s} {y+9*s} {x+12*s} {y+10*s} {x+12*s} {y+16*s}L{x+12*s} {y+25*s}"],
        "G": [f"M{x+14*s} {y+5*s}C{x+10*s} {y-1*s} {x} {y} {x} {y+12*s}C{x} {y+25*s} {x+12*s} {y+26*s} {x+15*s} {y+18*s}L{x+9*s} {y+18*s}"],
        "o": [f"M{x+6*s} {y+10*s}C{x} {y+10*s} {x} {y+25*s} {x+6*s} {y+25*s}C{x+12*s} {y+25*s} {x+12*s} {y+10*s} {x+6*s} {y+10*s}Z"],
        "l": [f"M{x+3*s} {y}L{x+3*s} {y+25*s}"],
        "I": [f"M{x} {y}L{x+12*s} {y}", f"M{x+6*s} {y}L{x+6*s} {y+24*s}", f"M{x} {y+24*s}L{x+12*s} {y+24*s}"],
    }
    return [satin(f"{prefix}-{letter}-{i}", path, 2.7 * s) for i, path in enumerate(paths[letter])]


def word(text: str, start: float, scale: float, prefix: str) -> list[dict[str, Any]]:
    widths = {"R": 17, "e": 15, "s": 15, "n": 15, "d": 15, "G": 18, "o": 14, "g": 15, "l": 8, "t": 15, "I": 15}
    result: list[dict[str, Any]] = []
    x = start
    for index, letter in enumerate(text):
        result.extend(glyph(letter, x, 17, scale, f"{prefix}-{index}"))
        x += widths[letter] * scale
    return result


def cases() -> dict[str, dict[str, Any]]:
    fixtures: dict[str, dict[str, Any]] = {}
    fixtures["01-resend"] = design("01-resend", word("Resend", 5, .82, "resend"))
    fixtures["02-intel"] = design("02-intel", word("Intel", 13, .9, "intel"))
    fixtures["03-google"] = design("03-google", word("Google", 4, .8, "google"), ["#4285f4"])
    fixtures["04-h"] = design("04-h", glyph("H", 37, 17, 1, "h"))
    fixtures["05-o"] = design("05-o", glyph("O", 37, 17, 1, "o"))
    fixtures["06-e"] = design("06-e", glyph("e", 38, 16, 1, "e"))
    fixtures["07-g"] = design("07-g", glyph("g", 38, 12, 1, "g"))
    fixtures["08-t"] = design("08-t", glyph("t", 39, 15, 1, "t"))
    fixtures["09-d"] = design("09-d", glyph("d", 38, 15, 1, "d"))
    fixtures["10-curva-gruesa"] = design("10-curva-gruesa", [satin("curva-gruesa", "M12 43C22 4 66 5 78 42", 7.2)])
    fixtures["11-curva-delgada"] = design("11-curva-delgada", [running("curva-delgada", "M12 43C22 4 66 5 78 42")])
    fixtures["12-swoosh"] = design("12-swoosh", [satin("swoosh", "M10 34C27 48 56 48 80 18", 4.8)])
    fixtures["13-interseccion-t"] = design("13-interseccion-t", [satin("t-horizontal", "M25 18L65 18", 5), satin("t-vertical", "M45 18L45 48", 5)])
    fixtures["14-junction-y"] = design("14-junction-y", [satin("y-left", "M24 12L45 31", 4), satin("y-right", "M66 12L45 31", 4), satin("y-down", "M45 31L45 52", 4)])
    fixtures["15-circulo-grueso"] = design("15-circulo-grueso", [satin("circulo", "M45 10C25 10 25 50 45 50C65 50 65 10 45 10Z", 7.4)])
    fixtures["16-donut"] = design("16-donut", [fill("donut", "M45 8A22 22 0 1 1 44.99 8ZM45 22A8 8 0 1 0 45.01 22Z")])
    fixtures["17-serif"] = design("17-serif", [satin("serif-stem", "M45 14L45 47", 4), satin("serif-top", "M34 14L56 14", 3), satin("serif-bottom", "M32 47L58 47", 3)])
    fixtures["18-logo-multicolor"] = design("18-logo-multicolor", [fill("blue-disc", "M28 13A17 17 0 1 1 27.99 13Z", "c0", 0), satin("red-swoosh", "M18 38C34 50 57 47 73 25", 4, "c1"), running("green-line", "M18 49C35 54 60 53 76 42", "c2")], ["#2563eb", "#ef4444", "#16a34a"])
    # Caso real ya producido por el pipeline browser: Discovery Park no recibe
    # tratamiento especial y sólo actúa como regresión dentro del banco.
    discovery = json.loads((ROOT / "pruebas/bordado/e2e/disenos/04-discovery.json").read_text(encoding="utf-8"))
    discovery["productId"] = "quality-fixture"
    discovery["sourceSnapshotHash"] = hashlib.sha256(b"19-discovery").hexdigest()
    fixtures["19-discovery"] = discovery
    fixtures["20-combinacion"] = design("20-combinacion", [running("outline", "M8 49L82 49"), satin("column", "M18 38C28 11 44 10 50 34", 3.4), fill("area", "M56 14L80 14L80 39L61 39C55 32 54 23 56 14Z", "c1", 45)], ["#171717", "#f59e0b"])
    return fixtures


def render_input(candidate: dict[str, Any], target: Path) -> None:
    colors = {item["id"]: item["displayHex"] for item in candidate["colors"]}
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}mm" height="{HEIGHT}mm" viewBox="0 0 {WIDTH} {HEIGHT}">', '<rect width="90" height="60" fill="#f7f7f5"/>']
    for obj in candidate["objects"]:
        path = html.escape(obj["geometry"]["d"], quote=True)
        color = colors[obj["colorId"]]
        stitch = obj["stitch"]
        if stitch["type"] == "fill":
            attrs = f'fill="{color}" fill-rule="evenodd"'
        else:
            attrs = f'fill="none" stroke="{color}" stroke-width="{stitch.get("strokeWidthMm", .3)}" stroke-linecap="round" stroke-linejoin="round"'
        parts.append(f'<path d="{path}" {attrs}/>')
    parts.append("</svg>")
    target.write_text("\n".join(parts), encoding="utf-8")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = []
    for slug, candidate in cases().items():
        directory = OUT / slug
        directory.mkdir(parents=True, exist_ok=True)
        (directory / "design.json").write_text(json.dumps(candidate, ensure_ascii=False, indent=2), encoding="utf-8")
        render_input(candidate, directory / "input.svg")
        manifest.append({"slug": slug, "objects": len(candidate["objects"])})
    (OUT / "manifest.json").write_text(json.dumps({"profileVersion": PROFILE, "fixtures": manifest}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"generated": len(manifest), "output": str(OUT)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
