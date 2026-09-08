from __future__ import annotations

import hashlib
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "services" / "bordados-worker"))
import worker


CASES = {
    "text": ("01-texto-simple", "text", "READY"),
    "mono": ("02-logo-monocromo", "logo", "READY"),
    "color": ("03-logo-cuatro-colores", "logo", "READY"),
    "illustration": ("04-ilustracion", "illustration", "REVIEW"),
}


# El perfil que emite el editor hoy. Las pruebas van contra el ULTIMO, no
# contra cualquiera: si se anade uno nuevo y se olvida esta linea, aqui se ve.
PERFIL_PROBADO = "experimental-v2-2026-09-06"


def design(classification: str, colors: int = 1) -> dict:
    palette = ["#171717", "#2457d6", "#f05a3f", "#acd633"][:colors]
    return {
        "schemaVersion": 1, "sourceSnapshotHash": "a" * 64, "productId": "p1", "sideId": "front",
        "physical": {"widthMm": 90, "heightMm": 60}, "bounds": {"xMm": 5, "yMm": 5, "widthMm": 70, "heightMm": 40},
        "colors": [{"id": f"c{i}", "sourceHex": color, "displayHex": color, "order": i} for i, color in enumerate(palette)],
        "objects": [{"id": "shape", "sourceObjectId": "shape", "sourceType": "text" if classification == "text" else "vector", "classification": classification, "colorId": "c0", "geometry": {"kind": "path", "d": "M10 10 L70 10 L70 40 L10 40 Z", "fillRule": "evenodd"}, "stitch": {"type": "satin" if classification == "text" else "fill", "strokeWidthMm": 2.2}, "bounds": {"xMm": 10, "yMm": 10, "widthMm": 60, "heightMm": 30}, "nodeCount": 4}],
        "metrics": {"componentCount": 1, "nodeCount": 4}, "profileVersion": PERFIL_PROBADO, "engineVersion": "inkstitch-3.3.0",
    }

def design_hash(candidate: dict) -> str:
    return hashlib.sha256(json.dumps(candidate, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()


class WorkerCases(unittest.TestCase):
    def run_case(self, slug: str, classification: str, expected: str, colors: int = 1):
        source = ROOT / "pruebas" / "bordado" / "casos" / slug / "diseno.dst"
        with tempfile.TemporaryDirectory() as tmp:
            def fixture_engine(_svg: Path, dst: Path) -> float:
                shutil.copyfile(source, dst); return 12.5
            candidate = design(classification, colors)
            result = worker.process_design(candidate, design_hash(candidate), Path(tmp), fixture_engine)
            self.assertEqual(result["status"], expected)
            self.assertTrue(result["artifacts"]["preview"].exists())
            self.assertTrue(result["artifacts"]["metadata"].exists())
            self.assertTrue(worker.validate_tajima(result["artifacts"]["dst"], result["metrics"])["passed"])
            for kind, path in result["artifacts"].items():
                self.assertEqual(result["hashes"][kind], hashlib.sha256(path.read_bytes()).hexdigest())

    def test_text_ready(self): self.run_case(*CASES["text"])
    def test_mono_logo_ready(self): self.run_case(*CASES["mono"])
    def test_color_logo_ready(self): self.run_case(*CASES["color"], colors=4)
    def test_illustration_review(self): self.run_case(*CASES["illustration"], colors=4)

    def test_raster_preparado_se_acepta(self):
        """Un raster con bloque de preparacion pasa; sin el, no.

        Es el contrato que hay que mantener a la par con `validation.ts`. Cuando
        el worker rechazaba todo `raster` de plano, TODOS los disenos con imagen
        —la mitad del producto— morian en FAILED sin llegar al motor, y el E2E
        fue lo unico que lo destapo.
        """
        candidate = design("logo")
        candidate["objects"][0]["sourceType"] = "raster"

        with self.assertRaises(ValueError) as sin:
            worker.validate_design(candidate, design_hash(candidate))
        self.assertEqual(str(sin.exception), "RASTER_NOT_PREPARED")

        candidate["preparation"] = {
            "profileVersion": PERFIL_PROBADO,
            "raster": {"sourceColorCount": 120, "reducedColorCount": 2, "quantizationDeltaE": .4,
                       "classification": "logo", "removedRegions": 3, "removedAreaMm2": .9,
                       "hadAlpha": False, "mmPorPx": .05},
            "issues": [],
        }
        worker.validate_design(candidate, design_hash(candidate))

    def test_preparacion_de_otra_version_se_rechaza(self):
        candidate = design("logo")
        candidate["preparation"] = {"profileVersion": "experimental-v1-2026-09-05", "issues": []}
        with self.assertRaises(ValueError) as error:
            worker.validate_design(candidate, design_hash(candidate))
        self.assertEqual(str(error.exception), "PREPARATION_MISMATCH")

    def test_degradado_en_grafico_va_a_revision_no_a_rechazo(self):
        """Un grafico con degradado se revisa; una foto con degradado se rechaza.

        El logo Discovery daba 0.1906 de `gradientRatio` contra un tope de 0.18
        —un 6 % de exceso— y acababa RECHAZADO siendo un logo bordable. En una
        fotografia el degradado si es motivo de rechazo, pero eso ya lo dice
        `PHOTO`.
        """
        grafico = design("logo")
        grafico["metrics"]["gradientRatio"] = .19
        status, _, issues = worker.early_analysis(grafico)
        self.assertEqual(status, "REVIEW")
        self.assertIn("COMPLEX_GRADIENT", [i["code"] for i in issues])

        foto = design("photo")
        foto["metrics"]["gradientRatio"] = .19
        status, _, issues = worker.early_analysis(foto)
        self.assertEqual(status, "REJECTED")
        self.assertEqual(
            sorted(i["code"] for i in issues), ["COMPLEX_GRADIENT", "PHOTO"]
        )

    def test_complex_image_rejected_before_engine(self):
        candidate = design("photo"); candidate["metrics"].update({"componentCount": 1222, "colorEntropy": 7.4, "texture": .8, "gradientRatio": .7})
        with tempfile.TemporaryDirectory() as tmp:
            result = worker.process_design(candidate, design_hash(candidate), Path(tmp), lambda *_: self.fail("Ink/Stitch must not run"))
        self.assertEqual(result["status"], "REJECTED")
        self.assertEqual(result["artifacts"], {})

    def test_claimed_component_metric_cannot_hide_complex_geometry(self):
        candidate = design("logo")
        component_count = worker.PROFILES[PERFIL_PROBADO]["maxComponents"] + 1
        candidate["objects"][0]["geometry"]["d"] = " ".join(f"M{i / 10} 10L{i / 10 + .01} 10" for i in range(component_count))
        candidate["objects"][0]["nodeCount"] = 2 * component_count
        candidate["metrics"]["componentCount"] = 1
        with tempfile.TemporaryDirectory() as tmp:
            result = worker.process_design(candidate, design_hash(candidate), Path(tmp), lambda *_: self.fail("Ink/Stitch must not run"))
        self.assertEqual(result["status"], "REJECTED")

    def test_v3_manual_satin_uses_rails_without_stroke_width(self):
        candidate = design("text")
        candidate["profileVersion"] = "experimental-v3-2026-09-06"
        candidate["objects"][0]["geometry"]["d"] = "M10 10L10 40M13 10L13 40M9.8 10L13.2 10M9.8 25L13.2 25M9.8 40L13.2 40"
        candidate["objects"][0]["stitch"] = {"type": "satin", "satinMode": "rails", "spacingMm": .42}
        candidate["objects"][0]["nodeCount"] = 10
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "rails.svg"
            worker.build_svg(candidate, target)
            svg = target.read_text()
        self.assertIn('inkstitch:satin_column="true"', svg)
        self.assertNotIn('stroke-width=', svg)

    def test_v3_quality_guardrail_marks_review_not_reject(self):
        candidate = design("text")
        candidate["profileVersion"] = "experimental-v3-2026-09-06"
        issues = worker.quality_issues(
            candidate,
            {"satin": {"maxWidthMm": 7}},
            {"maxStitchLengthMm": 7, "overlapDensity": .1, "maxLocalDensity": 8,
             "stitchCount": 100, "numberOfSharpDirectionChanges": 1, "jumps": 0},
        )
        self.assertEqual({issue["code"] for issue in issues}, {"SATIN_TOO_WIDE", "STITCH_TOO_LONG"})
        self.assertTrue(all(issue["severity"] == "review" for issue in issues))

    def test_v3_travel_only_reorders_non_overlapping_same_color(self):
        candidate = design("logo")
        candidate["profileVersion"] = "experimental-v3-2026-09-06"
        base = candidate["objects"][0]
        candidate["objects"] = []
        for name, x in (("far", 70), ("near", 5), ("middle", 35)):
            item = json.loads(json.dumps(base))
            item["id"] = name
            item["bounds"] = {"xMm": x, "yMm": 5, "widthMm": 5, "heightMm": 5}
            candidate["objects"].append(item)
        self.assertEqual([item["id"] for item in worker.ordered_objects(candidate)], ["near", "middle", "far"])

        candidate["objects"][1]["bounds"] = candidate["objects"][0]["bounds"]
        self.assertEqual([item["id"] for item in worker.ordered_objects(candidate)], ["far", "near", "middle"])


class LocalVerticalIntegration(unittest.TestCase):
    def test_post_queue_worker_artifacts_get_contract(self):
        """In-memory transport, real worker validators and artifact generation."""
        queue = []; jobs = {}; snapshot = design("logo")
        canonical = json.dumps(snapshot, sort_keys=True, separators=(",", ":")); design_hash = hashlib.sha256(canonical.encode()).hexdigest(); job_id = "emb_" + hashlib.sha256(("owner\0" + design_hash).encode()).hexdigest()[:40]
        jobs[job_id] = {"jobId": job_id, "designHash": design_hash, "ownerId": "owner", "status": "QUEUED"}; queue.append({"jobId": job_id, "designHash": design_hash})
        message = queue.pop(0); jobs[job_id]["status"] = "PROCESSING"
        source = ROOT / "pruebas" / "bordado" / "casos" / "02-logo-monocromo" / "diseno.dst"
        with tempfile.TemporaryDirectory() as tmp:
            result = worker.process_design(snapshot, message["designHash"], Path(tmp), lambda _svg, dst: (shutil.copyfile(source, dst), 1.0)[1])
            jobs[job_id].update(result); jobs[job_id]["status"] = result["status"]
            public = {key: jobs[job_id].get(key) for key in ("jobId", "designHash", "status", "decision", "confidence")}
            self.assertEqual(public["status"], "READY"); self.assertEqual(public["designHash"], design_hash)
            self.assertGreater(result["metrics"]["stitchCount"], 0)
            self.assertTrue(json.loads(result["artifacts"]["metadata"].read_text())["validation"]["tajima"]["passed"])


if __name__ == "__main__": unittest.main()
