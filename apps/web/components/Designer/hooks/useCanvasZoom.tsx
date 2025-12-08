import type { Canvas } from "fabric";
import { useCallback, useEffect, useState } from "react";

export function useCanvasZoom(canvas: Canvas | null) {
	const [zoom, setZoom] = useState(1);

	// cuando cambia el canvas, sincronizamos zoom
	useEffect(() => {
		if (!canvas) return;

		canvas.setZoom(zoom);
		canvas.requestRenderAll();
	}, [canvas, zoom]);

	const zoomIn = useCallback(() => {
		if (!canvas) return;
		const newZoom = Math.min(zoom + 0.1, 3);
		setZoom(newZoom);
	}, [canvas, zoom]);

	const zoomOut = useCallback(() => {
		if (!canvas) return;
		const newZoom = Math.max(zoom - 0.1, 0.3);
		setZoom(newZoom);
	}, [canvas, zoom]);

	return { zoom, zoomIn, zoomOut };
}
