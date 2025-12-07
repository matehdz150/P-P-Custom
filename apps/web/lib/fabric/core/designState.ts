import type { Canvas, FabricObject } from "fabric";
import { util as FabricUtil } from "fabric";
import { getEditableArea } from "../product/productRenderer";

export interface DesignDocument {
	objects: Record<string, unknown>[];
}

export class DesignStateManager {
	private states: Record<"front" | "back", DesignDocument | null> = {
		front: null,
		back: null,
	};

	/** Guarda objetos del usuario (sin áreas ni clipPath) */
	save(side: "front" | "back", canvas: Canvas) {
		const all = canvas.getObjects();

		const userObjects = all.filter((o) => o.excludeFromExport !== true);

		const jsonObjects = userObjects.map((obj) => {
			const backupClip = obj.clipPath;
			obj.clipPath = undefined;

			const raw = obj.toObject(["designType", "curveConfig"]);

			// Restaurar clip en runtime (NO en JSON)
			obj.clipPath = backupClip;

			// aseguramos type/version
			if (!raw.type) raw.type = obj.type;
			if (!raw.version) raw.version = "6.9.0";

			return raw;
		});

		this.states[side] = {
			objects: jsonObjects,
		};
	}

	/** Restaura objetos del usuario */
	/** Restaura objetos del usuario */
	async load(side: "front" | "back", canvas: Canvas) {
		const state = this.states[side];

		// 1) eliminar objetos actuales del usuario
		canvas.getObjects().forEach((obj) => {
			if (obj.excludeFromExport !== true) {
				canvas.remove(obj);
			}
		});

		if (!state) {
			canvas.renderAll();
			return;
		}

		// 2) limpiar JSON (¡¡IMPORTANTE!!)
		const cleaned = state.objects.map((obj) => this.cleanFabricJSON(obj));

		// 3) enliven
		const restoredObjects = await new Promise<FabricObject[]>((resolve) => {
			FabricUtil.enlivenObjects(cleaned, (enlivened) => resolve(enlivened));
			console.log("RESTORED:", restoredObjects);
		});

		const editableArea = getEditableArea(canvas);

		// 4) reinsertar objetos
		restoredObjects.forEach((obj) => {
			if (editableArea) obj.clipPath = editableArea;
			canvas.add(obj);
		});

		canvas.renderAll();
	}

	/** Elimina propiedades internas que rompen enlivenObjects */
	private cleanFabricJSON(
		obj: Record<string, unknown>,
	): Record<string, unknown> {
		const blacklist = [
			"_cacheCanvas",
			"_cacheContext",
			"_fontSizeMult",
			"_fontSizeFraction",
			"__eventListeners",
			"ownMatrixCache",
			"_matrixCache",
			"__lineWidths",
			"__lineHeights",
			"__charBounds",
			"_chars",
			"_reNewline",
			"_reWords",
			"_reSpace",
			"_reSpacesAndTabs",
			"dirty",
			"path", // muy importante: path viene inválido en muchos objetos
		];

		const clone: Record<string, unknown> = {};

		for (const key in obj) {
			if (blacklist.includes(key)) continue;

			const value = obj[key];

			// recursión para objetos internos
			if (value && typeof value === "object" && !Array.isArray(value)) {
				clone[key] = this.cleanFabricJSON(value as Record<string, unknown>);
			} else {
				clone[key] = value;
			}
		}

		return clone;
	}
}
