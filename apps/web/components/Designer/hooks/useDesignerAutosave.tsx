"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/Contexts/AuthContext";
import { useDesigner } from "@/Contexts/DesignerContext";
import {
	getUserDesigns,
	saveUserDesign,
	type UserDesign,
} from "@/lib/api/user-designs";

export function useDesignerAutosave(productId: string) {
	const { user } = useAuth();
	const { sides, config } = useDesigner();

	const [saving, setSaving] = useState(false);
	const activeDesignId = useRef<string | null>(null);
	const debounceTimer = useRef<NodeJS.Timeout | null>(null);
	const isRestoring = useRef(false);

	// Mantener una referencia actualizada de 'sides' para evitar closures obsoletas en promesas asíncronas
	const sidesRef = useRef(sides);
	useEffect(() => {
		sidesRef.current = sides;
	}, [sides]);

	// 1. Guardar Borrador (función núcleo)
	const saveDraft = useCallback(
		async (manual = false, status: "draft" | "completed" = "draft") => {
			if (!user) return null;

			// Generar JSON del canvas de cada lado
			const canvasData: Record<string, any> = {};
			let hasObjects = false;

			for (const [side, state] of Object.entries(sidesRef.current)) {
				if (state.canvas && (state.canvas as any).contextContainer) {
					const c = state.canvas;

					// Desactivar edición de texto de forma segura
					try {
						const activeObj = c.getActiveObject();
						if (activeObj && typeof (activeObj as any).exitEditing === "function" && (activeObj as any).isEditing) {
							(activeObj as any).exitEditing();
						}
						const objects = c.getObjects();
						for (const obj of objects) {
							if (obj && typeof (obj as any).exitEditing === "function" && (obj as any).isEditing) {
								(obj as any).exitEditing();
							}
						}
					} catch (e) {
						console.warn("Error exiting text editing in saveDraft:", e);
					}

					try {
						const json = c.toJSON();
						canvasData[side] = json;

						// Validamos si hay elementos colocados por el usuario
						// (excludeFromExport: true hace que las áreas editables no aparezcan en 'objects')
						if (json.objects && json.objects.length > 0) {
							hasObjects = true;
						}
					} catch (err) {
						console.error(`Error serializing canvas to JSON for side ${side}:`, err);
					}
				}
			}

			// Si no hay objetos creados por el usuario y es autoguardado, no saturamos la DB
			if (!hasObjects && !manual) return null;

			// Generar capturas rápidas de cada lado
			const snapshots: Record<string, string> = {};
			for (const [side, state] of Object.entries(sidesRef.current)) {
				if (state.canvas && (state.canvas as any).contextContainer) {
					try {
						snapshots[side] = state.canvas.toDataURL({
							format: "png",
							multiplier: 0.25, // capturas de bajo tamaño para el dashboard
						});
					} catch {
						snapshots[side] = "";
					}
				}
			}

			setSaving(true);
			try {
				const res = await saveUserDesign({
					id: activeDesignId.current || undefined,
					productId,
					canvasData,
					snapshots,
					status,
					name: `${config?.name || "Diseño personalizado"}`,
				});

				activeDesignId.current = res.id;

				if (manual) {
					alert("¡Borrador guardado exitosamente!");
				}
				return res.id;
			} catch (err) {
				console.error("Error al guardar borrador:", err);
				return null;
			} finally {
				setSaving(false);
			}
		},
		[user, productId, config],
	);

	// 2. Restaurar Diseño desde la Base de Datos
	const restoreDesign = useCallback(async (design: UserDesign) => {
		if (!design.canvasData) return;
		isRestoring.current = true;

		activeDesignId.current = design.id;

		try {
			for (const [side, sideData] of Object.entries(design.canvasData)) {
				const state = sidesRef.current[side];
				if (
					state?.canvas &&
					(state.canvas as any).contextContainer &&
					sideData
				) {
					const c = state.canvas;
					c.discardActiveObject();

					// En Fabric.js v6, loadFromJSON retorna una promesa
					await c.loadFromJSON(sideData);

					// Verificar si el canvas sigue activo tras la espera asíncrona
					if ((c as any).contextContainer) {
						// Re-añadir las áreas editables al fondo del canvas (índice 0)
						if (state.editableAreas && state.editableAreas.length > 0) {
							c.insertAt(0, ...state.editableAreas);
						}
						c.requestRenderAll();
					}
				}
			}
		} catch (err) {
			console.error("Error al restaurar diseño:", err);
		} finally {
			isRestoring.current = false;
		}
	}, []);

	// 3. Buscar borradores existentes al iniciar
	const checkForExistingDraft = useCallback(async () => {
		if (!user) return null;
		try {
			const drafts = await getUserDesigns({ status: "draft", productId });
			return drafts.length > 0 ? drafts[0] : null;
		} catch (err) {
			console.error("Error al buscar borrador existente:", err);
			return null;
		}
	}, [user, productId]);

	// 4. Efecto de Autoguardado con Debounce (2 segundos) al modificar canvas
	useEffect(() => {
		if (!user) return;

		const handleCanvasChange = () => {
			if (isRestoring.current) return;

			if (debounceTimer.current) {
				clearTimeout(debounceTimer.current);
			}

			debounceTimer.current = setTimeout(() => {
				saveDraft(false, "draft");
			}, 2000);
		};

		const activeCanvases: { canvas: any; handler: () => void }[] = [];

		for (const [_, state] of Object.entries(sides)) {
			if (state.canvas) {
				state.canvas.on("object:added", handleCanvasChange);
				state.canvas.on("object:modified", handleCanvasChange);
				state.canvas.on("object:removed", handleCanvasChange);
				state.canvas.on("text:changed", handleCanvasChange);
				activeCanvases.push({
					canvas: state.canvas,
					handler: handleCanvasChange,
				});
			}
		}

		return () => {
			if (debounceTimer.current) {
				clearTimeout(debounceTimer.current);
			}
			for (const item of activeCanvases) {
				item.canvas.off("object:added", item.handler);
				item.canvas.off("object:modified", item.handler);
				item.canvas.off("object:removed", item.handler);
				item.canvas.off("text:changed", item.handler);
			}
		};
	}, [sides, user, saveDraft]);

	// 5. Autoguardado al cerrar pestaña (beforeunload)
	useEffect(() => {
		const handleUnload = () => {
			// Guardar instantáneamente al salir
			saveDraft(false, "draft");
		};

		window.addEventListener("beforeunload", handleUnload);
		return () => {
			window.removeEventListener("beforeunload", handleUnload);
		};
	}, [saveDraft]);

	return {
		saving,
		saveDraft,
		restoreDesign,
		checkForExistingDraft,
		activeDesignId: activeDesignId.current,
	};
}
