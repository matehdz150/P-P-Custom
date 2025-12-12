import type { Canvas, TPointerEventInfo } from "fabric";
import { useCallback, useEffect, useState } from "react";

export function useCanvasZoom(canvas: Canvas | null) {
	const [zoom, setZoom] = useState(1);
	const clampZoom = useCallback(
		(value: number) => Math.min(Math.max(value, 0.3), 3),
		[],
	);

	const zoomIn = () => setZoom((z) => clampZoom(z + 0.1));
	const zoomOut = () => setZoom((z) => clampZoom(z - 0.1));

	// ---------------------------
	// 🔵 Sync zoom when canvas changes
	// ---------------------------
	useEffect(() => {
		if (!canvas) return;
		canvas.setZoom(zoom);
		canvas.requestRenderAll();
	}, [canvas, zoom]);

	// ---------------------------
	// 🖱️ 1. ZOOM WITH MOUSE WHEEL
	// ---------------------------
	useEffect(() => {
		if (!canvas) return;

		const handleWheel = (opt: TPointerEventInfo<WheelEvent>) => {
			const evt = opt.e;
			const delta = evt.deltaY;

			let newZoom = zoom - delta / 800;
			newZoom = clampZoom(newZoom);

			setZoom(newZoom);

			evt.preventDefault();
			evt.stopPropagation();
		};

		canvas.on("mouse:wheel", handleWheel);

		return () => {
			canvas.off("mouse:wheel", handleWheel);
		};
	}, [canvas, clampZoom, zoom]);

	// ---------------------------
	// 🤏 2. PINCH TO ZOOM (TOUCH)
	// ---------------------------
	useEffect(() => {
		if (!canvas) return;

		let lastDistance = 0;

		const getDistance = (touches: TouchList) => {
			const [t1, t2] = [touches[0], touches[1]];
			const dx = t2.clientX - t1.clientX;
			const dy = t2.clientY - t1.clientY;
			return Math.sqrt(dx * dx + dy * dy);
		};

		const handleTouchMove = (e: TouchEvent) => {
			if (e.touches.length === 2) {
				const distance = getDistance(e.touches);

				if (lastDistance === 0) {
					lastDistance = distance;
					return;
				}

				let newZoom = zoom * (distance / lastDistance);
				newZoom = clampZoom(newZoom);

				setZoom(newZoom);
				lastDistance = distance;

				e.preventDefault();
			}
		};

		const reset = () => {
			lastDistance = 0;
		};

		const container = canvas.upperCanvasEl;

		container.addEventListener("touchmove", handleTouchMove, {
			passive: false,
		});
		container.addEventListener("touchend", reset);

		return () => {
			container.removeEventListener("touchmove", handleTouchMove);
			container.removeEventListener("touchend", reset);
		};
	}, [canvas, clampZoom, zoom]);

	return { zoom, setZoom, zoomIn, zoomOut };
}
