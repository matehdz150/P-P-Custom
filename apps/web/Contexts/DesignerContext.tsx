"use client";

import type { Canvas, FabricObject, TMat2D } from "fabric";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useState,
} from "react";

interface SideState {
	canvas: Canvas | null;
	editableAreas: FabricObject[];
}

interface DesignerContextType {
	activeSide: string;
	setActiveSide: (side: string) => void;

	sides: Record<string, SideState>;
	initSides: (sides: string[]) => void;

	registerCanvas: (side: string, canvas: Canvas) => void;
	setEditableAreas: (side: string, areas: FabricObject[]) => void;

	getCanvas: () => Canvas | null;
	getEditableAreas: () => FabricObject[];

	activeObject: FabricObject | null;
	setActiveObject: (obj: FabricObject | null) => void;
}

const DesignerContext = createContext<DesignerContextType>(
	{} as DesignerContextType,
);

export function DesignerProvider({ children }: { children: ReactNode }) {
	const [activeSide, _setActiveSide] = useState<string>("front");

	const [sides, setSides] = useState<Record<string, SideState>>({});

	// Inicializar los lados
	const initSides = useCallback((sidesList: string[]) => {
		const obj: Record<string, SideState> = {};

		sidesList.forEach((side) => {
			obj[side] = { canvas: null, editableAreas: [] };
		});

		setSides(obj);
		_setActiveSide(sidesList[0]);
	}, []);

	// Registrar canvas
	const registerCanvas = useCallback((side: string, canvas: Canvas) => {
		setSides((prev) => {
			if (prev[side]?.canvas === canvas) return prev;
			return { ...prev, [side]: { ...prev[side], canvas } };
		});
	}, []);

	// Guardar editable areas
	const setEditableAreas = useCallback(
		(side: string, areas: FabricObject[]) => {
			setSides((prev) => ({
				...prev,
				[side]: { ...prev[side], editableAreas: areas },
			}));
		},
		[],
	);

	const [activeObject, setActiveObject] = useState<FabricObject | null>(null);

	// --------------------------------------------------
	// ⚡ SET ACTIVE SIDE — des-selecciona al cambiar side
	// --------------------------------------------------

	const setActiveSide = useCallback(
		(newSide: string) => {
			const currentCanvas = sides[activeSide]?.canvas;

			if (currentCanvas) {
				// 1. Quitar selección actual
				currentCanvas.discardActiveObject();

				// 2. Resetear PAN pero conservar el zoom
				const vt = currentCanvas.viewportTransform;
				if (vt) {
					const next: TMat2D = [
						vt[0], // scaleX
						vt[1], // skewY
						vt[2], // skewX
						vt[3], // scaleY
						0, // tx reset
						0, // ty reset
					];

					currentCanvas.setViewportTransform(next);
				}

				// 3. Re-render
				currentCanvas.requestRenderAll();
			}

			// 4. Limpiar selección global
			setActiveObject(null);

			// 5. Cambiar de lado
			_setActiveSide(newSide);
		},
		[activeSide, sides],
	);

	// Helpers
	const getCanvas = () => sides[activeSide]?.canvas ?? null;
	const getEditableAreas = () => sides[activeSide]?.editableAreas ?? [];

	return (
		<DesignerContext.Provider
			value={{
				activeSide,
				setActiveSide,
				sides,
				initSides,
				registerCanvas,
				setEditableAreas,
				getCanvas,
				getEditableAreas,
				activeObject,
				setActiveObject,
			}}
		>
			{children}
		</DesignerContext.Provider>
	);
}

export function useDesigner() {
	return useContext(DesignerContext);
}
