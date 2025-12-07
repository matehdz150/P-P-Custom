"use client";

import type { Canvas } from "fabric";
import { useCallback, useEffect, useState } from "react";

export function useCanvasZoom(fabricCanvas: Canvas | null) {
	const [zoom, setZoom] = useState(1);

	const zoomIn = () => {
		if (!fabricCanvas) return;
		const newZoom = Math.min(zoom + 0.1, 3);
		fabricCanvas.setZoom(newZoom);
		setZoom(newZoom);
		fabricCanvas.requestRenderAll();
	};

	const zoomOut = () => {
		if (!fabricCanvas) return;
		const newZoom = Math.max(zoom - 0.1, 0.3);
		fabricCanvas.setZoom(newZoom);
		setZoom(newZoom);
		fabricCanvas.requestRenderAll();
	};

	const zoomByDelta = useCallback(
		(deltaY: number) => {
			if (!fabricCanvas) return;

			let newZoom = zoom - deltaY * 0.001;
			newZoom = Math.max(0.3, Math.min(newZoom, 3));

			fabricCanvas.setZoom(newZoom);
			setZoom(newZoom);
			fabricCanvas.requestRenderAll();
		},
		[fabricCanvas, zoom],
	);

	// zoom con scroll de mouse
	useEffect(() => {
		if (!fabricCanvas) return;

		const wheelHandler = (opt: { e: WheelEvent }) => {
			zoomByDelta(opt.e.deltaY);
			opt.e.preventDefault();
			opt.e.stopPropagation();
		};

		fabricCanvas.on("mouse:wheel", wheelHandler);

		return () => fabricCanvas.off("mouse:wheel", wheelHandler);
	}, [fabricCanvas, zoomByDelta]);

	return { zoom, zoomIn, zoomOut, zoomByDelta };
}
