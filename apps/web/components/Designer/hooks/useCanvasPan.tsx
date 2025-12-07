"use client";

import type { Canvas } from "fabric";
import { useEffect, useRef } from "react";

interface Props {
	fabricCanvas: Canvas | null;
	isPanning: boolean;
}

type FabricMouseEvent = {
	e: MouseEvent;
};

export function useCanvasPan({ fabricCanvas, isPanning }: Props) {
	const isDragging = useRef(false);
	const lastPos = useRef({ x: 0, y: 0 });

	useEffect(() => {
		if (!fabricCanvas) return;

		// Cursor según modo pan
		fabricCanvas.defaultCursor = isPanning ? "grab" : "default";

		const handleMouseDown = (opt: FabricMouseEvent) => {
			if (!isPanning) return;

			isDragging.current = true;
			const evt = opt.e;
			lastPos.current = { x: evt.clientX, y: evt.clientY };

			fabricCanvas.setCursor("grabbing");
		};

		const handleMouseMove = (opt: FabricMouseEvent) => {
			if (!isPanning || !isDragging.current) return;

			const evt = opt.e;
			const dx = evt.clientX - lastPos.current.x;
			const dy = evt.clientY - lastPos.current.y;

			const vp = fabricCanvas.viewportTransform;
			if (!vp) return;
			vp[4] += dx;
			vp[5] += dy;

			fabricCanvas.requestRenderAll();

			lastPos.current = { x: evt.clientX, y: evt.clientY };
		};

		const handleMouseUp = () => {
			if (!isPanning) return;

			isDragging.current = false;
			fabricCanvas.setCursor("grab");
		};

		fabricCanvas.on("mouse:down", handleMouseDown);
		fabricCanvas.on("mouse:move", handleMouseMove);
		fabricCanvas.on("mouse:up", handleMouseUp);

		return () => {
			fabricCanvas.off("mouse:down", handleMouseDown);
			fabricCanvas.off("mouse:move", handleMouseMove);
			fabricCanvas.off("mouse:up", handleMouseUp);
		};
	}, [fabricCanvas, isPanning]);
}
