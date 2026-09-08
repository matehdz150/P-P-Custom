"""Worker productivo de bordado. Entrada: sólo jobId/designHash desde SQS."""
from __future__ import annotations

import hashlib
import html
import json
import math
import os
import re
import shutil
import subprocess
import tempfile
import time
from collections import Counter
from decimal import Decimal
from pathlib import Path
from typing import Any, Callable

import pyembroidery as pe
from botocore.exceptions import ClientError
from PIL import Image, ImageDraw
from quality import analyze_design_geometry, analyze_stitch_plan, render_embroidered_preview

INKSTITCH = os.environ.get("INKSTITCH_PATH", "/opt/inkstitch/bin/inkstitch")
ENGINE_TIMEOUT = int(os.environ.get("KUSTTO_ENGINE_TIMEOUT", "75"))
MAX_INPUT_BYTES = 750_000
PATH_RE = re.compile(r"^[MmZzLlHhVvCcSsQqTtAaEe0-9+.,\s-]+$")
HEX_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
NUMBER_RE = re.compile(r"[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?")
# Los perfiles que este worker sabe leer, por version. TIENEN QUE SEGUIR A LOS
# DE `packages/bordado/src/profile.ts`: son el mismo contrato en dos lenguajes.
# Cuando se anadio v2 sin tocar esta tabla, el worker rechazo TODOS los disenos
# con UNSUPPORTED_VERSION y los jobs acabaron en FAILED sin llegar al motor. La
# validacion cruzada es deliberada —el navegador no es de fiar— pero tiene que
# conocer las mismas versiones.
#
# Los techos de v2 son mayores porque cuentan otra cosa: alli una letra son
# varias columnas (un objeto cada una) y un relleno lleva sus contraformas como
# subtrazados, asi que el mismo diseno suma mas objetos y mas subtrazados sin
# ser mas complejo de bordar.
PROFILES = {
    "experimental-v1-2026-09-05": {"maxObjects": 120, "maxComponents": 100, "maxNodes": 8000, "maxColors": 8, "maxGradient": .18, "maxTexture": .42, "maxEntropy": 6.8},
    "experimental-v2-2026-09-06": {"maxObjects": 300, "maxComponents": 320, "maxNodes": 40000, "maxColors": 8, "maxGradient": .18, "maxTexture": .42, "maxEntropy": 6.8},
    "experimental-v3-2026-09-06": {"maxObjects": 300, "maxComponents": 320, "maxNodes": 40000, "maxColors": 8, "maxGradient": .18, "maxTexture": .42, "maxEntropy": 6.8},
    "experimental-hybrid-v4-2026-09-06": {"maxObjects": 300, "maxComponents": 320, "maxNodes": 40000, "maxColors": 8, "maxGradient": .18, "maxTexture": .42, "maxEntropy": 6.8},
}


def profile_for(design: dict[str, Any]) -> dict[str, Any]:
    """El perfil del diseno. Lanza si no lo conocemos: no se adivina."""
    perfil = PROFILES.get(design.get("profileVersion"))
    if perfil is None:
        raise ValueError("UNSUPPORTED_VERSION")
    return perfil


def log(event: str, **fields: Any) -> None:
    print(json.dumps({"event": event, **fields}, separators=(",", ":"), default=str))


def emit_metrics(event: str, job_id: str, design_hash: str, result: dict[str, Any], total_ms: float) -> None:
    values = {event: 1, "engineMs": result.get("engineMs", 0), "totalMs": total_ms, **{key: result.get("metrics", {}).get(key, 0) for key in ("stitchCount", "colorCount", "jumps", "trims")}}
    metrics = [{"Name": name, "Unit": "Milliseconds" if name.endswith("Ms") else "Count"} for name in values]
    print(json.dumps({"_aws":{"Timestamp":int(time.time()*1000),"CloudWatchMetrics":[{"Namespace":"Kustto/Embroidery","Dimensions":[[]],"Metrics":metrics}]},"jobId":job_id,"designHash":design_hash,**values}, separators=(",", ":")))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def validate_design(design: dict[str, Any], design_hash: str, canonical_hash_verified: bool = False) -> None:
    if not canonical_hash_verified:
        canonical = json.dumps(design, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        if hashlib.sha256(canonical.encode("utf-8")).hexdigest() != design_hash:
            raise ValueError("DESIGN_HASH_MISMATCH")
    if design.get("schemaVersion") != 1 or design.get("engineVersion") != "inkstitch-3.3.0":
        raise ValueError("UNSUPPORTED_VERSION")
    profile = profile_for(design)
    physical = design.get("physical") or {}
    width, height = float(physical.get("widthMm", 0)), float(physical.get("heightMm", 0))
    if not (math.isfinite(width) and math.isfinite(height) and 0 < width <= 90 and 0 < height <= 60):
        raise ValueError("INVALID_DIMENSIONS")
    def valid_box(box: dict[str, Any] | None) -> bool:
        if not isinstance(box, dict): return False
        try: x, y, box_width, box_height = (float(box[key]) for key in ("xMm", "yMm", "widthMm", "heightMm"))
        except (KeyError, TypeError, ValueError): return False
        return all(math.isfinite(value) for value in (x, y, box_width, box_height)) and x >= -.1 and y >= -.1 and box_width > 0 and box_height > 0 and x + box_width <= width + .1 and y + box_height <= height + .1
    if not valid_box(design.get("bounds")):
        raise ValueError("INVALID_BOUNDS")
    colors, objects = design.get("colors"), design.get("objects")
    if not isinstance(colors, list) or not 1 <= len(colors) <= profile["maxColors"]:
        raise ValueError("INVALID_COLORS")
    if any(not item.get("id") or not HEX_RE.fullmatch(str(item.get("sourceHex", ""))) or not HEX_RE.fullmatch(str(item.get("displayHex", ""))) for item in colors):
        raise ValueError("INVALID_COLORS")
    if not isinstance(objects, list) or not 1 <= len(objects) <= profile["maxObjects"]:
        raise ValueError("INVALID_OBJECTS")
    total_nodes = 0
    color_ids = {item.get("id") for item in colors}
    preparacion = design.get("preparation") or {}
    preparado_desde_raster = isinstance(preparacion.get("raster"), dict)
    if preparacion and preparacion.get("profileVersion") != design.get("profileVersion"):
        # Si la preparacion dijera otra version que el diseno, no se sabria con
        # que reglas se genero la geometria.
        raise ValueError("PREPARATION_MISMATCH")
    for obj in objects:
        geometry = obj.get("geometry") or {}
        path = geometry.get("d", "")
        # Un raster sigue prohibido A MENOS que el diseno traiga el bloque de
        # preparacion, que es la prueba de que su geometria salio de segmentar y
        # medir la imagen en milimetros y no de colar un <image>. La regla no se
        # relaja, se le pone una prueba —igual que en `validation.ts`, que es el
        # mismo contrato en el otro lenguaje—. Sin esto el worker rechazaba TODO
        # diseno con imagen, que es la mitad del producto.
        if obj.get("sourceType") == "raster" and not preparado_desde_raster:
            raise ValueError("RASTER_NOT_PREPARED")
        if geometry.get("kind") != "path" or not path or len(path) > 200_000 or not PATH_RE.fullmatch(path):
            raise ValueError("UNSAFE_GEOMETRY")
        coordinates = [float(value) for value in NUMBER_RE.findall(path)]
        if not coordinates or any(not math.isfinite(value) or abs(value) > 1000 for value in coordinates):
            raise ValueError("UNSAFE_GEOMETRY")
        if geometry.get("fillRule", "evenodd") not in ("evenodd", "nonzero"):
            raise ValueError("UNSAFE_GEOMETRY")
        if obj.get("colorId") not in color_ids:
            raise ValueError("INVALID_COLOR_REFERENCE")
        if not valid_box(obj.get("bounds")):
            raise ValueError("INVALID_OBJECT_BOUNDS")
        stitch = obj.get("stitch") or {}
        if stitch.get("type") not in ("running", "satin", "fill"):
            raise ValueError("INVALID_STITCH")
        if stitch.get("satinMode") not in (None, "stroke", "rails"):
            raise ValueError("INVALID_SATIN_MODE")
        if stitch.get("satinMode") == "rails" and stitch.get("type") != "satin":
            raise ValueError("INVALID_SATIN_MODE")
        spacing = stitch.get("spacingMm")
        if spacing is not None and (not math.isfinite(float(spacing)) or not .2 <= float(spacing) <= 2):
            raise ValueError("INVALID_STITCH_SPACING")
        maximum = stitch.get("maxStitchLengthMm")
        if maximum is not None and (not math.isfinite(float(maximum)) or not 1 <= float(maximum) <= 12):
            raise ValueError("INVALID_STITCH_LENGTH")
        for name, minimum, maximum_allowed in (("strokeWidthMm", .1, 20), ("pullCompensationMm", 0, 5), ("angleDeg", -360, 360)):
            value = stitch.get(name)
            if value is not None and (not math.isfinite(float(value)) or not minimum <= float(value) <= maximum_allowed):
                raise ValueError("INVALID_STITCH_PARAMETER")
        actual_nodes = len(re.findall(r"[MmLlHhVvCcSsQqTtAa]", path))
        if actual_nodes < 1 or int(obj.get("nodeCount", 0)) != actual_nodes:
            raise ValueError("INVALID_NODE_COUNT")
        total_nodes += actual_nodes
    if total_nodes <= 0:
        raise ValueError("INVALID_NODE_COUNT")


def early_analysis(design: dict[str, Any]) -> tuple[str, float, list[dict[str, str]]]:
    profile = profile_for(design)
    metrics = design.get("metrics") or {}
    objects = design["objects"]
    reasons: list[dict[str, str]] = []
    es_foto = any(item.get("classification") == "photo" for item in objects)
    if es_foto: reasons.append({"code": "PHOTO", "message": "Las fotografías no son aptas para este bordado automático.", "severity": "reject"})
    if float(metrics.get("gradientRatio", 0)) > profile["maxGradient"]:
        # UN DEGRADADO NO RECHAZA UN GRAFICO, LO MANDA A REVISION.
        #
        # `maxGradient` viene del perfil v1, cuando el navegador nunca producia
        # esta metrica porque v1 rechazaba todo raster: es un limite calibrado
        # contra nada que se aplica por primera vez a una medida que solo existe
        # desde v2. El logo Discovery da 0.1906 contra un tope de 0.18 —un 6 %—
        # y acababa rechazado siendo un logo perfectamente bordable.
        #
        # En una fotografia el degradado SI es motivo de rechazo, pero eso ya lo
        # dice `PHOTO`; aqui, sobre un grafico, lo unico que significa es que
        # alguien deberia mirarlo antes de coserlo.
        reasons.append({
            "code": "COMPLEX_GRADIENT",
            "message": "Este diseño tiene degradados y el bordado los simplifica; lo revisamos antes de fabricarlo.",
            "severity": "reject" if es_foto else "review",
        })
    if float(metrics.get("texture", 0)) > profile["maxTexture"] or float(metrics.get("colorEntropy", 0)) > profile["maxEntropy"]: reasons.append({"code": "COMPLEX_TEXTURE", "message": "La textura es demasiado compleja para bordado automático.", "severity": "reject"})
    nodes = sum(int(item.get("nodeCount", 0)) for item in objects)
    components = sum(len(re.findall(r"[Mm]", item["geometry"]["d"])) for item in objects)
    if components > profile["maxComponents"] or nodes > profile["maxNodes"]: reasons.append({"code": "TOO_COMPLEX", "message": "El diseño tiene demasiados detalles pequeños; simplifícalo.", "severity": "reject"})
    # Un solo motivo de rechazo manda sobre todos los de revision.
    if any(motivo["severity"] == "reject" for motivo in reasons):
        return "REJECTED", .98, [m for m in reasons if m["severity"] == "reject"]
    if any(item.get("classification") == "illustration" for item in objects):
        reasons.append({"code": "ILLUSTRATION_REVIEW", "message": "Este diseño necesita revisión antes de fabricarse.", "severity": "review"})
    if reasons: return "REVIEW", .82, reasons
    return "READY", .94, []


def _bounds_overlap(first: dict[str, Any], second: dict[str, Any]) -> bool:
    a, b = first["bounds"], second["bounds"]
    return not (
        float(a["xMm"]) + float(a["widthMm"]) <= float(b["xMm"])
        or float(b["xMm"]) + float(b["widthMm"]) <= float(a["xMm"])
        or float(a["yMm"]) + float(a["heightMm"]) <= float(b["yMm"])
        or float(b["yMm"]) + float(b["heightMm"]) <= float(a["yMm"])
    )


def _center(obj: dict[str, Any]) -> tuple[float, float]:
    box = obj["bounds"]
    return float(box["xMm"]) + float(box["widthMm"]) / 2, float(box["yMm"]) + float(box["heightMm"]) / 2


def ordered_objects(design: dict[str, Any]) -> list[dict[str, Any]]:
    """Nearest-neighbor sólo donde el stacking es demostrablemente irrelevante."""
    objects = list(design["objects"])
    if design.get("profileVersion") not in ("experimental-v3-2026-09-06", "experimental-hybrid-v4-2026-09-06"):
        return objects
    output: list[dict[str, Any]] = []
    previous = (0.0, 0.0)
    start = 0
    while start < len(objects):
        end = start + 1
        while end < len(objects) and objects[end].get("colorId") == objects[start].get("colorId"):
            end += 1
        group = objects[start:end]
        has_dependencies = any(item.get("dependencies") for item in group)
        overlaps = any(_bounds_overlap(group[i], group[j]) for i in range(len(group)) for j in range(i + 1, len(group)))
        if len(group) < 3 or has_dependencies or overlaps:
            output.extend(group)
        else:
            remaining = list(group)
            while remaining:
                selected = min(range(len(remaining)), key=lambda i: math.dist(previous, _center(remaining[i])))
                item = remaining.pop(selected)
                output.append(item)
                previous = _center(item)
        if output:
            previous = _center(output[-1])
        start = end
    return output


def estimated_object_travel(objects: list[dict[str, Any]]) -> float:
    points = [(0.0, 0.0), *(_center(item) for item in objects)]
    return round(sum(math.dist(points[i - 1], points[i]) for i in range(1, len(points))), 2)


def build_svg(design: dict[str, Any], target: Path) -> None:
    width, height = design["physical"]["widthMm"], design["physical"]["heightMm"]
    colors = {item["id"]: item["displayHex"] for item in design["colors"]}
    parts = ['<?xml version="1.0" encoding="UTF-8"?>', f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkstitch="http://inkstitch.org/namespace" width="{width}mm" height="{height}mm" viewBox="0 0 {width} {height}">', '<metadata><inkstitch:min_stitch_len_mm>0.3</inkstitch:min_stitch_len_mm><inkstitch:collapse_len_mm>3</inkstitch:collapse_len_mm><inkstitch:min_satin_stroke_width_mm>1.5</inkstitch:min_satin_stroke_width_mm><inkstitch:inkstitch_svg_version>4</inkstitch:inkstitch_svg_version></metadata>']
    objects = ordered_objects(design)
    for index, obj in enumerate(objects):
        stitch = obj["stitch"]; kind = stitch["type"]; color = colors[obj["colorId"]]; d = html.escape(obj["geometry"]["d"], quote=True); ident = html.escape(obj["id"], quote=True)
        if kind == "satin":
            stroke_width = '' if stitch.get("satinMode") == "rails" else f' stroke-width="{float(stitch.get("strokeWidthMm", 2.2))}" stroke-linecap="round" stroke-linejoin="round"'
            max_satin = 6.5 if design.get("profileVersion") in ("experimental-v3-2026-09-06", "experimental-hybrid-v4-2026-09-06") else 8
            underlay = str(bool(stitch.get("underlay", True))).lower()
            attrs = f'fill="none" stroke="{color}"{stroke_width} inkstitch:satin_column="true" inkstitch:zigzag_spacing_mm="{float(stitch.get("spacingMm", .42))}" inkstitch:pull_compensation_mm="{float(stitch.get("pullCompensationMm", .2))}" inkstitch:center_walk_underlay="{underlay}" inkstitch:max_stitch_length_mm="{max_satin}"'
        elif kind == "running":
            attrs = f'fill="none" stroke="{color}" stroke-width="{float(stitch.get("strokeWidthMm", .3))}" inkstitch:stroke_method="running_stitch" inkstitch:running_stitch_length_mm="2.2" inkstitch:bean_stitch_repeats="1"'
        else:
            attrs = f'fill="{color}" fill-rule="{obj["geometry"].get("fillRule", "evenodd")}" stroke="none" inkstitch:fill_method="tatami_fill" inkstitch:angle="{float(stitch.get("angleDeg", (index % 4) * 45))}" inkstitch:row_spacing_mm="{float(stitch.get("spacingMm", .45))}" inkstitch:max_stitch_length_mm="{float(stitch.get("maxStitchLengthMm", 4))}" inkstitch:fill_underlay="{str(bool(stitch.get("underlay", True))).lower()}" inkstitch:pull_compensation_mm="{float(stitch.get("pullCompensationMm", .15))}" inkstitch:trim_after="{str(bool(stitch.get("trimAfter", index < len(objects) - 1))).lower()}"'
        parts.append(f'<path id="{ident}" d="{d}" {attrs} />')
    parts.append("</svg>")
    target.write_text("\n".join(parts), encoding="utf-8")


def command_counts(pattern: pe.EmbPattern) -> Counter[int]:
    return Counter(int(stitch[2]) & pe.COMMAND_MASK for stitch in pattern.stitches)


def analyze_dst(path: Path) -> tuple[pe.EmbPattern, dict[str, Any]]:
    pattern = pe.read(str(path))
    if pattern is None: raise ValueError("DST_UNREADABLE")
    counts = command_counts(pattern); min_x, min_y, max_x, max_y = pattern.bounds()
    return pattern, {"widthMm": round((max_x-min_x)/10, 1), "heightMm": round((max_y-min_y)/10, 1), "stitchCount": counts[pe.STITCH], "colorCount": counts[pe.COLOR_CHANGE] + counts[pe.NEEDLE_SET] + 1, "colorChanges": counts[pe.COLOR_CHANGE] + counts[pe.NEEDLE_SET], "jumps": counts[pe.JUMP], "trims": counts[pe.TRIM]}


def validate_tajima(path: Path, parsed: dict[str, Any]) -> dict[str, Any]:
    data = path.read_bytes()
    header = data[:512].decode("ascii", errors="replace"); payload = data[512:]
    records = [payload[i:i+3] for i in range(0, len(payload)-2, 3)]
    x = y = min_x = max_x = min_y = max_y = colors = decoded = max_delta = 0; ended = False; movements = []
    def delta(a: int, b: int, c: int, axis: str) -> int:
        if axis == "x": return ((a&1)and 1 or 0)-((a&2)and 1 or 0)+((b&1)and 3 or 0)-((b&2)and 3 or 0)+((a&4)and 9 or 0)-((a&8)and 9 or 0)+((b&4)and 27 or 0)-((b&8)and 27 or 0)+((c&4)and 81 or 0)-((c&8)and 81 or 0)
        return ((a&128)and 1 or 0)-((a&64)and 1 or 0)+((b&128)and 3 or 0)-((b&64)and 3 or 0)+((a&32)and 9 or 0)-((a&16)and 9 or 0)+((b&32)and 27 or 0)-((b&16)and 27 or 0)+((c&32)and 81 or 0)-((c&16)and 81 or 0)
    for a,b,c in records:
        if c == 0xF3: ended = True; break
        dx,dy=delta(a,b,c,"x"),delta(a,b,c,"y"); max_delta=max(max_delta,abs(dx),abs(dy)); x+=dx;y+=dy;min_x=min(min_x,x);max_x=max(max_x,x);min_y=min(min_y,y);max_y=max(max_y,y)
        if c&0xC3 == 0xC3: colors+=1; kind="color"
        elif c&0x83 == 0x83: kind="jump"
        else: kind="stitch"
        movements.append((kind,dx,dy)); decoded+=1
    trims=0; index=0
    while index <= len(movements)-3:
        first,second,third=movements[index:index+3]
        if first[0]==second[0]==third[0]=="jump" and first[1:]==third[1:] and second[1]==-2*first[1] and second[2]==-2*first[2] and first[1:]!=(0,0): trims+=1; index+=3
        else: index+=1
    def header_number(prefix: str) -> int | None:
        for line in header.split("\r"):
            if line.startswith(prefix):
                try: return int(line[len(prefix):].strip())
                except ValueError: return None
        return None
    checks={"headerIs512Bytes":len(data)>=512 and header.startswith("LA:"),"payloadAlignedTo3Bytes":len(payload)%3==0,"hasEndRecord":ended,"headerRecordCountMatches":header_number("ST:")==decoded-2*trims+1,"headerColorChangesMatch":header_number("CO:")==colors,"boundsMatchPyembroidery":abs(round((max_x-min_x)/10,1)-parsed["widthMm"])<=.1 and abs(round((max_y-min_y)/10,1)-parsed["heightMm"])<=.1,"maxAxisMovementRepresentable":max_delta<=121}
    result={"passed":all(checks.values()),"checks":checks,"maxAxisDeltaTenthsMm":max_delta}
    if not result["passed"]:
        # QUE FALLO, no solo QUE fallo. Con el codigo a secas, un DST rechazado
        # es indistinguible de otro y no hay forma de saber si el problema es la
        # cabecera, el recuento o un movimiento que el formato no representa.
        # Los nombres van al registro; al comprador nunca se le ensena esto.
        fallaron = [nombre for nombre, ok in checks.items() if not ok]
        log("tajimaInvalido", checks=fallaron, maxAxisDeltaTenthsMm=max_delta, stitches=decoded)
        raise ValueError("TAJIMA_INVALID")
    return result


def render_preview(pattern: pe.EmbPattern, palette: list[str], target: Path) -> None:
    min_x, min_y, max_x, max_y = pattern.bounds(); width_mm = max(1, (max_x-min_x)/10); height_mm = max(1, (max_y-min_y)/10); scale = min(900/width_mm, 600/height_mm); margin = 40
    image = Image.new("RGB", (round(width_mm*scale+80), round(height_mm*scale+80)), "#f4f0e8"); draw = ImageDraw.Draw(image, "RGBA"); previous = None; block = 0
    for x, y, command in pattern.stitches:
        kind = int(command) & pe.COMMAND_MASK
        if kind in (pe.COLOR_CHANGE, pe.NEEDLE_SET): block += 1
        point = (margin+(x-min_x)/10*scale, margin+(y-min_y)/10*scale)
        if previous is not None and kind == pe.STITCH: draw.line((previous, point), fill=palette[min(block, len(palette)-1)]+"d9", width=max(1, round(scale*.07)))
        previous = point
    image.save(target, optimize=True)


def quality_issues(design: dict[str, Any], geometry: dict[str, Any], plan: dict[str, Any]) -> list[dict[str, str]]:
    """Guardrails de trayectoria, independientes de PHOTO/GRAPHIC."""
    if design.get("profileVersion") not in ("experimental-v3-2026-09-06", "experimental-hybrid-v4-2026-09-06"):
        return []
    issues: list[dict[str, str]] = []
    satin = geometry.get("satin") or {}
    if satin.get("maxWidthMm") is not None and float(satin["maxWidthMm"]) > 6:
        issues.append({"code": "SATIN_TOO_WIDE", "message": "Una columna satin supera 6 mm y requiere subdivisión o fill.", "severity": "review"})
    if float(plan.get("maxStitchLengthMm", 0)) > 6.5:
        issues.append({"code": "STITCH_TOO_LONG", "message": "El plan contiene puntadas por encima del guardrail de 6.5 mm.", "severity": "review"})
    if float(plan.get("overlapDensity", 0)) > .25:
        issues.append({"code": "EXCESSIVE_OVERLAP", "message": "La trayectoria acumula demasiado solape local.", "severity": "review"})
    if int(plan.get("maxLocalDensity", 0)) > 24:
        issues.append({"code": "HIGH_LOCAL_DENSITY", "message": "Hay una zona con demasiadas puntadas por milímetro cuadrado.", "severity": "review"})
    stitches = max(1, int(plan.get("stitchCount", 0)))
    if int(plan.get("numberOfSharpDirectionChanges", 0)) / stitches > .08:
        issues.append({"code": "SHARP_DIRECTION_CHANGE", "message": "El plan concentra demasiados cambios bruscos de dirección.", "severity": "review"})
    if int(plan.get("jumps", 0)) > max(20, round(len(design.get("objects", [])) * .75)):
        issues.append({"code": "TOO_MANY_JUMPS", "message": "El orden de cosido produce demasiados saltos.", "severity": "review"})
    return issues


Engine = Callable[[Path, Path], float]
_xvfb: subprocess.Popen[bytes] | None = None
def ensure_display() -> None:
    """Levanta Xvfb y ESPERA A QUE ESTE, no un segundo fijo.

    El arranque en frio de este contenedor tarda casi siete segundos y Xvfb
    compite con el por CPU; con el segundo de espera que habia antes, el primer
    trabajo de cada contenedor moria con XVFB_FAILED mientras el resto pasaba.
    Un fallo que sale una vez de cada tantas y siempre en el primero es de los
    que se atribuyen al diseno y no a la maquina.

    Tambien se mira si el proceso se murio: si Xvfb no arranca de verdad, es
    mejor decirlo ya que agotar la espera entera.
    """
    global _xvfb
    socket = Path("/tmp/.X11-unix/X99")
    if socket.exists(): return
    if _xvfb is None or _xvfb.poll() is not None:
        _xvfb = subprocess.Popen(["Xvfb", os.environ.get("DISPLAY", ":99"), "-screen", "0", "1280x1024x24", "-nolisten", "tcp", "-noreset"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    limite = time.monotonic() + 15
    while time.monotonic() < limite:
        if socket.exists(): return
        if _xvfb.poll() is not None:
            raise RuntimeError("XVFB_FAILED")
        time.sleep(.05)
    raise RuntimeError("XVFB_FAILED")

def run_inkstitch(svg: Path, dst: Path) -> float:
    ensure_display()
    started = time.perf_counter()
    with dst.open("wb") as output:
        result = subprocess.run([INKSTITCH, "--extension=output", "--format=dst", str(svg)], stdout=output, stderr=subprocess.PIPE, timeout=ENGINE_TIMEOUT, check=False, env=os.environ.copy())
    if result.returncode != 0 or not dst.exists() or dst.stat().st_size < 515: raise RuntimeError("ENGINE_FAILED")
    return round((time.perf_counter()-started)*1000, 1)


def process_design(design: dict[str, Any], design_hash: str, directory: Path, engine: Engine = run_inkstitch, canonical_hash_verified: bool = False) -> dict[str, Any]:
    validate_design(design, design_hash, canonical_hash_verified)
    status, confidence, issues = early_analysis(design)
    if status == "REJECTED": return {"status": status, "decision": "reject", "confidence": confidence, "issues": issues, "metrics": design.get("metrics", {}), "artifacts": {}}
    svg, dst, preview, metadata_path = directory/"geometry.svg", directory/"design.dst", directory/"preview.png", directory/"metadata.json"
    timings: dict[str, float | None] = {}
    started = time.perf_counter(); build_svg(design, svg); timings["svgGenerationMs"] = round((time.perf_counter()-started)*1000, 1)
    engine_ms = engine(svg, dst); timings["inkstitchProcessAndDigitizationMs"] = engine_ms
    # Ink/Stitch 3.3.0 no expone un corte confiable entre bootstrap del proceso
    # y digitización. Ambos se dejan null en lugar de repartir el total a ojo.
    timings["inkstitchInitializationMs"] = None; timings["inkstitchDigitizationMs"] = None
    started = time.perf_counter(); pattern, dst_metrics = analyze_dst(dst); timings["dstParsingMs"] = round((time.perf_counter()-started)*1000, 1)
    if dst_metrics["widthMm"] > float(design["physical"]["widthMm"]) + 1 or dst_metrics["heightMm"] > float(design["physical"]["heightMm"]) + 1:
        raise ValueError("DST_OUTSIDE_AREA")
    geometry_metrics = analyze_design_geometry(design, svg.stat().st_size)
    original_order = list(design["objects"]); optimized_order = ordered_objects(design)
    geometry_metrics["travelOrdering"] = {
        "beforeMm": estimated_object_travel(original_order),
        "afterMm": estimated_object_travel(optimized_order),
        "reordered": [item["id"] for item in original_order] != [item["id"] for item in optimized_order],
    }
    plan_metrics = analyze_stitch_plan(pattern)
    quality_reasons = quality_issues(design, geometry_metrics, plan_metrics)
    issues = [*issues, *quality_reasons]
    if quality_reasons and status == "READY": status, confidence = "REVIEW", min(confidence, .78)
    metrics = {**design.get("metrics", {}), **dst_metrics, "quality": {"geometry": geometry_metrics, "stitchPlan": plan_metrics}}
    started = time.perf_counter(); tajima = validate_tajima(dst, metrics); timings["tajimaValidationMs"] = round((time.perf_counter()-started)*1000, 1)
    started = time.perf_counter(); render_preview(pattern, [item["displayHex"] for item in design["colors"]], preview); timings["previewMs"] = round((time.perf_counter()-started)*1000, 1)
    embroidered = directory/"embroideredPreview.png"
    if design.get("profileVersion") in ("experimental-v3-2026-09-06", "experimental-hybrid-v4-2026-09-06"):
        render_embroidered_preview(pattern, [item["displayHex"] for item in design["colors"]], embroidered)
    decision = "review" if status == "REVIEW" else "accept"
    metadata = {"schemaVersion": 1, "designHash": design_hash, "profileVersion": design["profileVersion"], "engineVersion": design["engineVersion"], "decision": decision, "confidence": confidence, "issues": issues, "metrics": metrics, "timings": timings, "physicallyValidated": False, "validation": {"tajima": tajima}, "checksums": {"design.dst": sha256(dst), "preview.png": sha256(preview)}}
    if embroidered.exists():
        metadata["checksums"]["embroideredPreview.png"] = sha256(embroidered)
    metadata_path.write_text(json.dumps(metadata, sort_keys=True, separators=(",", ":")), encoding="utf-8")
    return {"status": status, "decision": decision, "confidence": confidence, "issues": issues, "metrics": metrics, "timings": timings, "engineMs": engine_ms, "artifacts": {"dst": dst, "preview": preview, "metadata": metadata_path}, "diagnostics": {"embroideredPreview": embroidered} if embroidered.exists() else {}, "hashes": {"dst": sha256(dst), "preview": sha256(preview), "metadata": sha256(metadata_path)}}


class AwsRuntime:
    def __init__(self) -> None:
        import boto3
        self.ddb = boto3.resource("dynamodb").Table(os.environ["KUSTTO_EMBROIDERY_JOBS_TABLE"]); self.s3 = boto3.client("s3"); self.bucket = os.environ["KUSTTO_EMBROIDERY_BUCKET"]
    def acquire(self, job_id: str, design_hash: str) -> dict[str, Any] | None:
        try:
            # Por alias tambien aqui, por la misma razon que en `finish`: hoy
            # ninguno de estos nombres es palabra reservada, pero la lista crece
            # y comprobarlo a mano es un trabajo que se olvida.
            result = self.ddb.update_item(
                Key={"pk": f"JOB#{job_id}"},
                UpdateExpression="SET #s=:processing, #startedAt=:now ADD #attempts :one",
                ConditionExpression="#s=:queued AND #designHash=:hash",
                ExpressionAttributeNames={"#s": "status", "#startedAt": "startedAt", "#attempts": "attempts", "#designHash": "designHash"},
                ExpressionAttributeValues={":processing":"PROCESSING",":queued":"QUEUED",":hash":design_hash,":now":time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),":one":1},
                ReturnValues="ALL_NEW",
            )
            return result["Attributes"]
        except self.ddb.meta.client.exceptions.ConditionalCheckFailedException: return None
    def input(self, key: str, design_hash: str) -> dict[str, Any]:
        head = self.s3.head_object(Bucket=self.bucket, Key=key)
        if head["ContentLength"] > MAX_INPUT_BYTES or head.get("ContentType") != "application/json": raise ValueError("INVALID_INPUT_MIME_OR_SIZE")
        raw = self.s3.get_object(Bucket=self.bucket, Key=key)["Body"].read(MAX_INPUT_BYTES+1)
        if len(raw) > MAX_INPUT_BYTES: raise ValueError("INPUT_TOO_LARGE")
        if hashlib.sha256(raw).hexdigest() != design_hash: raise ValueError("DESIGN_HASH_MISMATCH")
        return json.loads(raw)
    def publish(self, job: dict[str, Any], result: dict[str, Any]) -> dict[str, str]:
        prefix = f'embroidery/{job["designHash"]}/{job["jobId"]}'; staging = f'staging/{job["jobId"]}'
        names = {"dst":"design.dst", "preview":"preview.png", "metadata":"metadata.json"}; types = {"dst":"application/octet-stream", "preview":"image/png", "metadata":"application/json"}; keys = {}
        for kind, path in result["artifacts"].items():
            stage_key = f'{staging}/{names[kind]}'; final_key = f'{prefix}/{names[kind]}'
            checksum = result["hashes"][kind]
            self.s3.upload_file(str(path), self.bucket, stage_key, ExtraArgs={"ContentType":types[kind], "ServerSideEncryption":"AES256", "Metadata":{"sha256":checksum}})
            staged = self.s3.head_object(Bucket=self.bucket, Key=stage_key)
            if staged["ContentLength"] != path.stat().st_size or staged.get("Metadata",{}).get("sha256") != checksum: raise RuntimeError("UPLOAD_VERIFICATION_FAILED")
            try:
                self.s3.put_object(Bucket=self.bucket, Key=final_key, Body=path.read_bytes(), ContentType=types[kind], ServerSideEncryption="AES256", Metadata={"sha256":checksum}, IfNoneMatch="*")
            except ClientError as error:
                if error.response.get("ResponseMetadata",{}).get("HTTPStatusCode") != 412: raise
            final = self.s3.head_object(Bucket=self.bucket, Key=final_key)
            if final["ContentLength"] != path.stat().st_size or final.get("Metadata",{}).get("sha256") != checksum: raise RuntimeError("IMMUTABLE_OUTPUT_CONFLICT")
            self.s3.delete_object(Bucket=self.bucket, Key=stage_key); keys[kind] = final_key
        return keys
    def finish(self, job_id: str, result: dict[str, Any], keys: dict[str, str]) -> None:
        metrics = result["metrics"]
        values = {":status":result["status"],":decision":result["decision"],":confidence":result["confidence"],":issues":result["issues"],":metrics":metrics,":stitches":metrics.get("stitchCount",0),":colors":metrics.get("colorCount",0),":changes":metrics.get("colorChanges",0),":jumps":metrics.get("jumps",0),":trims":metrics.get("trims",0),":now":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),":dst":keys.get("dst"),":preview":keys.get("preview"),":metadata":keys.get("metadata"),":hashes":result.get("hashes",{}),":processing":"PROCESSING"}
        values = json.loads(json.dumps(values), parse_float=Decimal)
        # TODOS los nombres van por alias, no solo `status`.
        #
        # `metrics` es palabra reservada de DynamoDB y la escritura fallaba con
        # ValidationException DESPUES de que Ink/Stitch hubiera corrido: el
        # motor hacia su trabajo —hasta setenta y cinco segundos— y el job moria
        # en la ultima linea, con el DST ya generado. Se veia como WORKER_FAILED
        # sin ninguna pista de que el problema era el nombre de un atributo.
        #
        # Se ponen todos por alias y no solo el culpable: la lista de palabras
        # reservadas tiene cientos de entradas y crece, asi que "comprobar cual
        # lo es" es un trabajo que hay que repetir cada vez que se anade un
        # campo. Con alias, nunca.
        nombres = {"#s": "status"}
        asignaciones = []
        for alias, atributo, valor in (
            ("#decision", "decision", ":decision"),
            ("#confidence", "confidence", ":confidence"),
            ("#issues", "issues", ":issues"),
            ("#metrics", "metrics", ":metrics"),
            ("#stitchCount", "stitchCount", ":stitches"),
            ("#colorCount", "colorCount", ":colors"),
            ("#colorChanges", "colorChanges", ":changes"),
            ("#jumps", "jumps", ":jumps"),
            ("#trims", "trims", ":trims"),
            ("#completedAt", "completedAt", ":now"),
            ("#dstKey", "dstKey", ":dst"),
            ("#previewKey", "previewKey", ":preview"),
            ("#metadataKey", "metadataKey", ":metadata"),
            ("#hashes", "hashes", ":hashes"),
        ):
            nombres[alias] = atributo
            asignaciones.append(f"{alias}={valor}")
        nombres["#errorCode"] = "errorCode"
        self.ddb.update_item(
            Key={"pk": f"JOB#{job_id}"},
            UpdateExpression=f"SET #s=:status, {', '.join(asignaciones)} REMOVE #errorCode",
            ConditionExpression="#s=:processing",
            ExpressionAttributeNames=nombres,
            ExpressionAttributeValues=values,
        )
    def fail(self, job_id: str, code: str) -> None:
        self.ddb.update_item(Key={"pk":f"JOB#{job_id}"}, UpdateExpression="SET #s=:failed,#errorCode=:code,#completedAt=:now", ConditionExpression="#s=:processing", ExpressionAttributeNames={"#s":"status","#errorCode":"errorCode","#completedAt":"completedAt"}, ExpressionAttributeValues={":failed":"FAILED",":processing":"PROCESSING",":code":code,":now":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime())})


def handle_message(message: dict[str, Any], runtime: AwsRuntime) -> None:
    body = json.loads(message.get("body", "{}")); job_id, design_hash = body.get("jobId"), body.get("designHash")
    if not isinstance(job_id, str) or not re.fullmatch(r"emb_[a-f0-9]{40}", job_id) or not isinstance(design_hash, str) or not re.fullmatch(r"[a-f0-9]{64}", design_hash): raise ValueError("INVALID_MESSAGE")
    job = runtime.acquire(job_id, design_hash)
    if not job: return
    started = time.perf_counter(); directory = Path(tempfile.mkdtemp(prefix=f"embroidery-{job_id[-12:]}-", dir="/tmp"))
    try:
        log("processing", jobId=job_id, designHash=design_hash); design = runtime.input(job["inputKey"], design_hash); result = process_design(design, design_hash, directory, canonical_hash_verified=True)
        upload_started = time.perf_counter(); keys = runtime.publish(job, result) if result["artifacts"] else {}; result.setdefault("timings", {})["uploadMs"] = round((time.perf_counter()-upload_started)*1000, 1)
        runtime.finish(job_id, result, keys)
        total_ms=round((time.perf_counter()-started)*1000,1)
        log(result["status"].lower(), jobId=job_id, designHash=design_hash, totalMs=total_ms, engineMs=result.get("engineMs",0), timings=result.get("timings", {}), retries=max(0,int(job.get("attempts",1))-1), **result.get("metrics", {}))
        emit_metrics(result["status"].lower(), job_id, design_hash, result, total_ms)
    except Exception as error:
        # Un timeout del motor tiene su propio codigo. `TimeoutExpired` lleva el
        # comando en `args[0]`, asi que caia en el "WORKER_FAILED" generico y en
        # los registros no habia forma de distinguir "el motor tardo demasiado"
        # de "algo se rompio": el diseno del logo monocromo agotaba los setenta y
        # cinco segundos y parecia un error cualquiera. Es lo unico que dice si
        # hay que subir el presupuesto del motor o si hay un fallo de verdad.
        if isinstance(error, subprocess.TimeoutExpired):
            code = "ENGINE_TIMEOUT"
        else:
            code = error.args[0] if error.args and isinstance(error.args[0], str) and re.fullmatch(r"[A-Z_]+", error.args[0]) else "WORKER_FAILED"
        total_ms=round((time.perf_counter()-started)*1000,1)
        runtime.fail(job_id, code); log("failed", jobId=job_id, designHash=design_hash, errorCode=code, totalMs=total_ms, retries=max(0,int(job.get("attempts",1))-1)); emit_metrics("failed", job_id, design_hash, {}, total_ms); raise
    finally: shutil.rmtree(directory, ignore_errors=True)


def lambda_handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    if os.environ.get("KUSTTO_EMBROIDERY_ENABLED") != "true": raise RuntimeError("FEATURE_DISABLED")
    runtime = AwsRuntime()
    for record in event.get("Records", []): handle_message(record, runtime)
    return {"ok": True}
