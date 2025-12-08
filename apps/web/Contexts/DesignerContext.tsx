"use client";

import type { Canvas, Object as FabricObject, Rect } from "fabric";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useState,
} from "react";

interface SideState {
	canvas: Canvas | null;
	editableAreas: Rect[];
}

interface DesignerContextType {
	activeSide: string;
	setActiveSide: (side: string) => void;

	sides: Record<string, SideState>;
	initSides: (sides: string[]) => void;

	registerCanvas: (side: string, canvas: Canvas) => void;
	setEditableAreas: (side: string, areas: Rect[]) => void;

	getCanvas: () => Canvas | null;
	getEditableAreas: () => Rect[];

	activeObject: FabricObject | null;
	setActiveObject: (obj: FabricObject | null) => void;
}

const DesignerContext = createContext<DesignerContextType>(
	{} as DesignerContextType,
);

export function DesignerProvider({ children }: { children: ReactNode }) {
	const [activeSide, setActiveSide] = useState<string>("front");

	const [sides, setSides] = useState<Record<string, SideState>>({});

	// Inicializa sides desde la plantilla del producto
	const initSides = useCallback((sidesList: string[]) => {
		const obj: Record<string, SideState> = {};

		sidesList.forEach((side) => {
			obj[side] = { canvas: null, editableAreas: [] };
		});

		setSides(obj);
		setActiveSide(sidesList[0]); // primer lado por default
	}, []);

	// Guarda el canvas en su side — NO CAUSA LOOPS
	const registerCanvas = useCallback((side: string, canvas: Canvas) => {
		setSides((prev) => {
			if (prev[side]?.canvas === canvas) return prev; // evita ciclos
			return { ...prev, [side]: { ...prev[side], canvas } };
		});
	}, []);

	const setEditableAreas = useCallback((side: string, areas: Rect[]) => {
		setSides((prev) => ({
			...prev,
			[side]: { ...prev[side], editableAreas: areas },
		}));
	}, []);

	const [activeObject, setActiveObject] = useState<FabricObject | null>(null);

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
