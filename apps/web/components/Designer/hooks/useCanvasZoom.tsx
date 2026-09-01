import {
	type Canvas,
	Point,
	type TPointerEvent,
	type TPointerEventInfo,
} from "fabric";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Escala real del canvas cuando el usuario ve "100%". Las plantillas entran
 * demasiado acercadas a escala 1:1, así que el 100% de la interfaz es en
 * realidad un 77% de la imagen. `zoom` es siempre lo que se le muestra a la
 * persona; lo que recibe Fabric va multiplicado por esta base.
 */
const BASE = 0.77;

export function useCanvasZoom(canvas: Canvas | null) {
	const [zoom, setZoom] = useState(1);

	const clampZoom = useCallback(
		(value: number) => Math.min(Math.max(value, 0.3), 3),
		[],
	);

	const zoomIn = () => setZoom((z) => clampZoom(z + 0.1));
	const zoomOut = () => setZoom((z) => clampZoom(z - 0.1));

	// La rueda y el pellizco ya aplicaron el zoom anclado al puntero. Sin esta
	// bandera el efecto de abajo volvería a centrarlo y se perdería el anclaje.
	const anclado = useRef(false);

	// ---------------------------------
	// 🔵 Sync zoom → canvas
	// ---------------------------------
	useEffect(() => {
		if (!canvas) return;

		if (anclado.current) {
			anclado.current = false;
			return;
		}

		// `setZoom` escala desde el origen (0,0), así que con una base menor a 1
		// la prenda se recorre hacia la esquina. Anclando al centro del lienzo
		// se queda donde está, tanto al montar como con los botones + / −.
		const centro = new Point(canvas.getWidth() / 2, canvas.getHeight() / 2);
		canvas.zoomToPoint(centro, zoom * BASE);
		canvas.requestRenderAll();
	}, [canvas, zoom]);

	// ---------------------------------
	// 🖱️ Mouse wheel zoom
	// ---------------------------------
	useEffect(() => {
		if (!canvas) return;

		const handleWheel = (opt: TPointerEventInfo<WheelEvent>) => {
			const evt = opt.e;

			let newZoom = zoom - evt.deltaY / 800;
			newZoom = clampZoom(newZoom);

			const pointer = canvas.getPointer(evt);
			canvas.zoomToPoint(pointer, newZoom * BASE);

			anclado.current = true;
			setZoom(newZoom);

			evt.preventDefault();
			evt.stopPropagation();
		};

		canvas.on("mouse:wheel", handleWheel);

		return () => {
			canvas.off("mouse:wheel", handleWheel);
		};
	}, [canvas, clampZoom, zoom]);

	// ---------------------------------
	// 🤏 Pinch zoom (touch)
	// ---------------------------------
	useEffect(() => {
		if (!canvas) return;

		const container = canvas.upperCanvasEl;
		if (!container) return; // 🔑 CLAVE: evita crash

		let lastDistance = 0;

		const getDistance = (touches: TouchList) => {
			const [t1, t2] = [touches[0], touches[1]];
			return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
		};

		const handleTouchMove = (e: TouchEvent) => {
			if (e.touches.length !== 2) return;

			const distance = getDistance(e.touches);

			if (!lastDistance) {
				lastDistance = distance;
				return;
			}

			let newZoom = zoom * (distance / lastDistance);
			newZoom = clampZoom(newZoom);

			const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
			const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

			const pe = new PointerEvent("pointermove", {
				clientX: midX,
				clientY: midY,
				pointerType: "touch",
			});

			const pointer = canvas.getPointer(pe as TPointerEvent);
			canvas.zoomToPoint(pointer, newZoom * BASE);

			anclado.current = true;
			setZoom(newZoom);
			lastDistance = distance;

			e.preventDefault();
		};

		const reset = () => {
			lastDistance = 0;
		};

		container.addEventListener("touchmove", handleTouchMove, {
			passive: false,
		});
		container.addEventListener("touchend", reset);
		container.addEventListener("touchcancel", reset);

		return () => {
			container.removeEventListener("touchmove", handleTouchMove);
			container.removeEventListener("touchend", reset);
			container.removeEventListener("touchcancel", reset);
		};
	}, [canvas, clampZoom, zoom]);

	return {
		zoom,
		setZoom,
		zoomIn,
		zoomOut,
	};
}
