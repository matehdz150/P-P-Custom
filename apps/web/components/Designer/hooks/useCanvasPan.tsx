import type { Canvas } from "fabric";
import { useEffect, useRef } from "react";

export function useCanvasPan({
	fabricCanvas,
	isPanning,
}: {
	fabricCanvas: Canvas | null;
	isPanning: boolean;
}) {
	const isDragging = useRef(false);
	const lastPos = useRef({ x: 0, y: 0 });

	useEffect(() => {
		if (!fabricCanvas) return;

		const onMouseDown = (opt: any) => {
			if (!isPanning) return;

			isDragging.current = true;

			const evt = opt.e;
			lastPos.current = { x: evt.clientX, y: evt.clientY };

			fabricCanvas.setCursor("grabbing");
		};

		const onMouseMove = (opt: any) => {
			if (!isDragging.current || !isPanning) return;

			const evt = opt.e;
			const vpt = fabricCanvas.viewportTransform!;

			const dx = evt.clientX - lastPos.current.x;
			const dy = evt.clientY - lastPos.current.y;

			vpt[4] += dx;
			vpt[5] += dy;

			fabricCanvas.setViewportTransform(vpt);

			lastPos.current = { x: evt.clientX, y: evt.clientY };
		};

		const onMouseUp = () => {
			if (!isDragging.current) return;

			isDragging.current = false;
			fabricCanvas.setCursor("default");
		};

		fabricCanvas.on("mouse:down", onMouseDown);
		fabricCanvas.on("mouse:move", onMouseMove);
		fabricCanvas.on("mouse:up", onMouseUp);

		return () => {
			fabricCanvas.off("mouse:down", onMouseDown);
			fabricCanvas.off("mouse:move", onMouseMove);
			fabricCanvas.off("mouse:up", onMouseUp);
		};
	}, [fabricCanvas, isPanning]);
}
