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

export type PrendaColor = { name: string; hex: string };

export interface DesignerProductConfig {
	name?: string;
	rules: {
		allowText: boolean;
		allowImages: boolean;
		maxDesigns?: number;
		maxColorsPerDesign?: number;
	};
	pricing: {
		basePrice: number;
		perSidePrice?: number;
		perDesignPrice?: number;
		perColorPrice?: number;
		embroideryExtra?: number;
	};
}

interface DesignerContextType {
	activeSide: string;
	setActiveSide: (side: string) => void;

	config: DesignerProductConfig | null;
	setConfig: (c: DesignerProductConfig) => void;

	notice: { title: string; message: string } | null;
	showNotice: (title: string, message: string) => void;
	clearNotice: () => void;

	sides: Record<string, SideState>;
	initSides: (sides: string[]) => void;

	registerCanvas: (side: string, canvas: Canvas) => void;
	setEditableAreas: (side: string, areas: FabricObject[]) => void;

	getCanvas: () => Canvas | null;
	getEditableAreas: () => FabricObject[];

	activeObject: FabricObject | null;
	setActiveObject: (obj: FabricObject | null) => void;

	/** Colores en que se puede pedir la prenda, y el elegido. */
	colores: PrendaColor[];
	setColores: (c: PrendaColor[]) => void;
	colorPrenda: PrendaColor | null;
	setColorPrenda: (c: PrendaColor | null) => void;

	/**
	 * Si está abierto el panel para pedir.
	 *
	 * Vive aquí y no en cada shell porque el botón que lo abre está en dos
	 * sitios —la barra de abajo en escritorio, la cabecera en móvil— y el
	 * panel se monta en uno solo. Pasarlo por props obligaría a hilar el
	 * callback por toda la jerarquía de cada shell.
	 */
	pidiendo: boolean;
	setPidiendo: (v: boolean) => void;

	/** Si está en marcha "agregar al carrito". Mismo motivo que `pidiendo`. */
	agregando: boolean;
	setAgregando: (v: boolean) => void;
}

const DesignerContext = createContext<DesignerContextType>(
	{} as DesignerContextType,
);

export function DesignerProvider({ children }: { children: ReactNode }) {
	const [activeSide, _setActiveSide] = useState<string>("front");

	const [config, setConfig] = useState<DesignerProductConfig | null>(null);

	const [notice, setNotice] = useState<{
		title: string;
		message: string;
	} | null>(null);
	const showNotice = useCallback(
		(title: string, message: string) => setNotice({ title, message }),
		[],
	);
	const clearNotice = useCallback(() => setNotice(null), []);

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

	const [colores, _setColores] = useState<PrendaColor[]>([]);
	const [colorPrenda, setColorPrenda] = useState<PrendaColor | null>(null);

	// Al cargar el producto, el primer color de la lista es el que se ve.
	const setColores = useCallback((lista: PrendaColor[]) => {
		_setColores(lista);
		setColorPrenda(lista[0] ?? null);
	}, []);

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

	const [pidiendo, setPidiendo] = useState(false);
	const [agregando, setAgregando] = useState(false);

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
				colores,
				setColores,
				colorPrenda,
				setColorPrenda,
				pidiendo,
				setPidiendo,
				agregando,
				setAgregando,
				config,
				setConfig,
				notice,
				showNotice,
				clearNotice,
			}}
		>
			{children}
		</DesignerContext.Provider>
	);
}

export function useDesigner() {
	return useContext(DesignerContext);
}
