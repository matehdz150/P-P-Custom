import type { ActiveSelection, Canvas, FabricObject } from "fabric";

interface EditableObject {
	isEditing: boolean;
}

export class KeyboardController {
	constructor(private canvas: Canvas) {
		this.bindEvents();
	}

	private bindEvents() {
		window.addEventListener("keydown", this.handleKeyDown);
	}

	private handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === "Delete" || e.key === "Backspace") {
			this.deleteSelected();
		}
	};

	private deleteSelected() {
		const canvas = this.canvas;
		const active = canvas.getActiveObject();
		if (!active) return;

		// ❌ NO borrar mientras se edita texto
		if ("isEditing" in active && (active as EditableObject).isEditing) {
			return;
		}

		// ----------------------------------------
		// ✅ Caso 1: ActiveSelection real
		// ----------------------------------------
		if (active.type === "activeSelection") {
			const selection = active as ActiveSelection;
			const items = selection.getObjects();

			items.forEach((obj: FabricObject) => {
				canvas.remove(obj);
			});

			canvas.discardActiveObject();
			canvas.requestRenderAll();
			return;
		}

		// ----------------------------------------
		// ✅ Caso 2: Fabric a veces crea selección múltiple
		//    pero NO la marca como ActiveSelection
		//    y expone _objects
		// ----------------------------------------
		const maybeGroup = active as FabricObject & {
			_objects?: FabricObject[];
		};

		if (Array.isArray(maybeGroup._objects)) {
			maybeGroup._objects.forEach((obj: FabricObject) => {
				canvas.remove(obj);
			});

			canvas.discardActiveObject();
			canvas.requestRenderAll();
			return;
		}

		// ----------------------------------------
		// ✅ Caso 3: un solo objeto
		// ----------------------------------------
		canvas.remove(active);
		canvas.discardActiveObject();
		canvas.requestRenderAll();
	}

	dispose() {
		window.removeEventListener("keydown", this.handleKeyDown);
	}
}
