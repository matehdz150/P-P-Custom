"use client";

import type { EmbroideryStatus } from "@kustto/bordado";
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
	/**
	 * El recargo de cada lado, por `sideKey`.
	 *
	 * Baja hasta aquí por lo mismo que `tecnicas`: el dato ya existía en
	 * `printSides` y se quedaba en `ProductDesigner`, así que el desglose que
	 * ve el comprador mientras diseña no podía saber que una manga cuesta menos
	 * que una espalda — y enseñaba el recargo general para las dos.
	 */
	lados?: { sideKey: string; recargo?: number | null }[];
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

	/**
	 * Para qué se está diseñando: nulo es lo normal —un producto que va al
	 * carrito—, y con valor se está armando una plantilla.
	 *
	 * Cambia LOS BOTONES DE SALIDA, no el editor: en una plantilla no existe
	 * "pedir este diseño" porque la plantilla entera se pide después, junta.
	 * `clave` dice a qué fila del borrador vuelve el arte; nula, se añade una.
	 */
	plantilla: { clave: string | null } | null;
	setPlantilla: (p: { clave: string | null } | null) => void;

	/** Evento público al que regresará el diseño al terminar. */
	evento: {
		codigo: string;
		itemId: string;
		eventoId?: string;
		organizador?: boolean;
		personalizacion?: "libre" | "bloqueada" | "sin_personalizacion";
	} | null;
	setEvento: (
		e: {
			codigo: string;
			itemId: string;
			eventoId?: string;
			organizador?: boolean;
			personalizacion?: "libre" | "bloqueada" | "sin_personalizacion";
		} | null,
	) => void;

	/**
	 * Con qué se estampa cada lado, por `sideKey`.
	 *
	 * VIVE AQUÍ porque quien la necesita es el hook que agrega imágenes, y ése
	 * está a cuatro niveles del componente que carga la ficha. El dato existía
	 * ya en `printSides`, pero se quedaba en `ProductDesigner`: el lienzo nunca
	 * llegó a saber si lo que está diseñando se imprime o se graba.
	 */
	tecnicas: Record<string, string | undefined>;
	setTecnicas: (t: Record<string, string | undefined>) => void;
	/**
	 * Cómo quedó la preparación de bordado de cada lado, por `sideKey`.
	 *
	 * VIVE AQUÍ Y NO EN EL PANEL porque quien tiene que consultarlo es el paso
	 * de agregar al carrito, que está en otra rama del árbol. Sin esto, el panel
	 * sabía que un diseño había sido rechazado y el carrito se lo llevaba igual:
	 * el comprador acababa pagando un bordado que la máquina no puede coser.
	 */
	bordados: Record<string, EstadoDeBordado | undefined>;
	setBordado: (lado: string, estado: EstadoDeBordado | null) => void;
}

/** Lo que el editor necesita saber del bordado de un lado. */
export type EstadoDeBordado = {
	jobId: string;
	designHash: string;
	status: EmbroideryStatus;
	/** Qué se le enseña al comprador si no se puede continuar. */
	mensaje: string | null;
	/** Códigos de incidencia, para el taller. No se enseñan. */
	incidencias: string[];
};

const DesignerContext = createContext<DesignerContextType>(
	{} as DesignerContextType,
);

export function DesignerProvider({ children }: { children: ReactNode }) {
	/* El lado de arranque es una SUPOSICIÓN, no un dato: `"front"` sólo existe
	   en una prenda. Una taza tiene un lado y se llama `wrap`, así que aquí el
	   editor arrancaba pidiendo un lienzo que no existe y se veía en blanco
	   hasta que alguien pulsaba "Envoltura".
	
	   Lo corrige `ProductDesigner` en cuanto sabe los lados del producto. No se
	   arranca vacío porque nadie llama a `initSides`: sin corrector, el editor
	   se quedaría sin lado para siempre. */
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
	const [plantilla, setPlantilla] = useState<{ clave: string | null } | null>(
		null,
	);
	const [evento, setEvento] = useState<{
		codigo: string;
		itemId: string;
		eventoId?: string;
		organizador?: boolean;
		personalizacion?: "libre" | "bloqueada" | "sin_personalizacion";
	} | null>(null);
	const [tecnicas, setTecnicas] = useState<Record<string, string | undefined>>(
		{},
	);
	const [bordados, setBordados] = useState<
		Record<string, EstadoDeBordado | undefined>
	>({});
	const setBordado = useCallback(
		(lado: string, estado: EstadoDeBordado | null) => {
			setBordados((previo) => {
				if (previo[lado] === undefined && estado === null) return previo;
				const siguiente = { ...previo };
				if (estado === null) delete siguiente[lado];
				else siguiente[lado] = estado;
				return siguiente;
			});
		},
		[],
	);

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
				plantilla,
				setPlantilla,
				evento,
				setEvento,
				tecnicas,
				setTecnicas,
				bordados,
				setBordado,
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
