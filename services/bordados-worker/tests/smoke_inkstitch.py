"""Smoke manual del subprocess real dentro de la imagen de producción."""
from __future__ import annotations

import hashlib
import json
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import worker

# El perfil que emite el editor hoy. Si se promueve otro, esta linea es la
# que avisa de que el smoke se quedo atras.
PERFIL_ACTIVO = "experimental-hybrid-v4-2026-09-06"

design = {
    "schemaVersion": 1, "sourceSnapshotHash": "a" * 64, "productId": "smoke", "sideId": "front",
    "physical": {"widthMm": 90, "heightMm": 60}, "bounds": {"xMm": 20, "yMm": 10, "widthMm": 50, "heightMm": 40},
    "colors": [{"id": "black", "sourceHex": "#111111", "displayHex": "#111111", "order": 0}],
    "objects": [{"id": "ring", "sourceObjectId": "ring", "sourceType": "vector", "classification": "logo", "colorId": "black", "geometry": {"kind": "path", "d": "M20 10H70V50H20Z M30 20V40H60V20Z", "fillRule": "evenodd"}, "stitch": {"type": "fill", "underlay": True}, "bounds": {"xMm": 20, "yMm": 10, "widthMm": 50, "heightMm": 40}, "nodeCount": 8}],
    "metrics": {"componentCount": 1, "nodeCount": 8}, "profileVersion": PERFIL_ACTIVO, "engineVersion": "inkstitch-3.3.0",
}
canonical = json.dumps(design, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
design_hash = hashlib.sha256(canonical.encode()).hexdigest()
with tempfile.TemporaryDirectory(dir="/tmp") as directory:
    result = worker.process_design(design, design_hash, Path(directory))
    # El smoke comprueba que Ink/Stitch CORRE en esta imagen y produce un DST
    # valido, no que este diseno concreto salga READY: es un relleno tatami, y
    # el tatami dispara `SHARP_DIRECTION_CHANGE` por construccion —cada vuelta
    # de fila es un cambio de direccion—, asi que su estado legitimo es REVIEW.
    assert result["status"] in ("READY", "REVIEW"), result["status"]
    assert result["metrics"]["stitchCount"] > 0
    assert result["artifacts"]["preview"].exists()
    assert result["artifacts"]["dst"].exists()
    assert json.loads(result["artifacts"]["metadata"].read_text())["validation"]["tajima"]["passed"]
    print(json.dumps({"status": result["status"], "stitchCount": result["metrics"]["stitchCount"], "tajima": json.loads(result["artifacts"]["metadata"].read_text())["validation"]["tajima"]["passed"]}))
