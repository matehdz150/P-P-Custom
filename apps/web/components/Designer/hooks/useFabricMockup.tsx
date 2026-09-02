// hooks/useFabricMockup.ts
"use client";

import { type Canvas, FabricImage } from "fabric";
import { useEffect, useRef, useState } from "react";
import { recortarPrenda, tenirPrenda } from "@/lib/fabric/prenda";

export function useFabricMockup(
	getCanvas: () => Canvas | null,
	mockupUrl?: string,
	/** Hex del color de la prenda. Sin él, el mockup se pinta tal cual. */
	colorHex?: string | null,
	_debugDelayMs = 0,
) {
	const [isLoading, setIsLoading] = useState(false);
	const [reloadKey, setReloadKey] = useState(0);

	// fuerza recargar y reaplicar el mockup en el canvas actual
	const reload = () => setReloadKey((k) => k + 1);

	// evita bucle por identidad cambiante de getCanvas()
	const getCanvasRef = useRef(getCanvas);
	useEffect(() => {
		getCanvasRef.current = getCanvas;
	}, [getCanvas]);

	// Recortar el fondo es lo caro (un relleno sobre ~800k pixeles), y no
	// depende del color: se guarda por imagen y se reusa en cada cambio de
	// color. `canvas: null` significa "esta imagen no se puede teñir".
	const prendaRef = useRef<{
		url: string;
		canvas: HTMLCanvasElement | null;
	} | null>(null);

	useEffect(() => {
		if (!mockupUrl) return;

		let cancelled = false;
		let intervalId = 0;
		let htmlImg: HTMLImageElement | null = null;
		let appliedCanvas: Canvas | null = null;

		setIsLoading(true);

		const place = (canvas: Canvas) => {
			if (!htmlImg) return;

			// Sin color elegido no se toca la imagen: los productos sin colores
			// se comportan igual que antes.
			if (colorHex && prendaRef.current?.url !== mockupUrl) {
				prendaRef.current = { url: mockupUrl, canvas: recortarPrenda(htmlImg) };
			}
			const prenda = colorHex ? prendaRef.current?.canvas : null;
			const fuente =
				prenda && colorHex ? tenirPrenda(prenda, colorHex) : htmlImg;
			// FabricImage desde un elemento YA cargado → 100% síncrono,
			// sin fetch interno ni promesas que se queden colgadas.
			const fImg = new FabricImage(fuente, {
				originX: "center",
				originY: "center",
				selectable: false,
				evented: false,
			});
			fImg.scaleToWidth(700);
			fImg.set({
				left: canvas.getWidth() / 2,
				top: canvas.getHeight() / 2,
			});
			canvas.backgroundImage = fImg;
			canvas.requestRenderAll();
			requestAnimationFrame(() => {
				if (!cancelled) canvas.requestRenderAll();
			});
			appliedCanvas = canvas;
		};

		// garantiza que el canvas ACTUAL tenga el fondo; sobrevive a
		// recreaciones del canvas (navegación SPA / re-render del contexto)
		const ensure = () => {
			if (cancelled || !htmlImg) return;
			const canvas = getCanvasRef.current();
			if (!canvas) return;
			if (canvas !== appliedCanvas || !canvas.backgroundImage) {
				place(canvas);
			}
		};

		// watcher persistente desde ya: en cuanto haya imagen + canvas, pinta
		intervalId = window.setInterval(ensure, 200);

		// --- carga determinista con HTMLImageElement nativo ---
		const el = new window.Image();
		el.decoding = "async";
		el.onload = () => {
			if (cancelled) return;
			htmlImg = el;
			setIsLoading(false);
			ensure();
		};
		el.onerror = () => {
			if (cancelled) return;
			setIsLoading(false); // nunca dejes el overlay pegado
		};
		// sin crossOrigin: solo mostramos el mockup, no exportamos el canvas
		el.src = mockupUrl;
		// si ya estaba en caché y completó antes de asignar onload
		if (el.complete && el.naturalWidth > 0) {
			htmlImg = el;
			setIsLoading(false);
			ensure();
		}

		return () => {
			cancelled = true;
			if (intervalId) window.clearInterval(intervalId);
			el.onload = null;
			el.onerror = null;
		};
	}, [mockupUrl, colorHex, reloadKey]);

	return { isLoading, reload };
}
