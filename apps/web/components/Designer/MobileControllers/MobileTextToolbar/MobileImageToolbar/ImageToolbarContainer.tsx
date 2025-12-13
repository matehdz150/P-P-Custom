"use client";

import { Image as FabricImage } from "fabric";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import MobileImageToolbar from "./MobileImageToolbar";

export default function MobileImageToolbarContainer() {
	const { activeObject, getCanvas } = useDesigner();
	const canvas = getCanvas();

	const image = activeObject instanceof FabricImage ? activeObject : undefined;

	// 🔒 hooks siempre arriba
	const toolbarRef = useRef<HTMLDivElement | null>(null);
	const [pos, setPos] = useState({ x: 0, y: 0 });

	const updatePosition = useCallback(() => {
		if (!canvas || !image || !toolbarRef.current) return;

		const el = canvas.upperCanvasEl;
		if (!el) return;

		const center = image.getCenterPoint();
		const vpt = canvas.viewportTransform;
		if (!vpt) return;

		const retina =
			typeof canvas.getRetinaScaling === "function"
				? canvas.getRetinaScaling()
				: 1;

		const vx = (center.x * vpt[0] + vpt[4]) / retina;
		const vy = (center.y * vpt[3] + vpt[5]) / retina;

		const rect = el.getBoundingClientRect();
		const toolbarHeight = toolbarRef.current.offsetHeight;

		setPos({
			x: rect.left + vx,
			y: rect.top + vy - toolbarHeight - 8,
		});
	}, [canvas, image]);

	useEffect(() => {
		if (!canvas || !image) return;

		updatePosition();
		const sync = () => updatePosition();

		canvas.on("object:moving", sync);
		canvas.on("object:scaling", sync);
		canvas.on("object:rotating", sync);
		canvas.on("object:modified", sync);
		canvas.on("after:render", sync);

		window.addEventListener("resize", sync);

		return () => {
			canvas.off("object:moving", sync);
			canvas.off("object:scaling", sync);
			canvas.off("object:rotating", sync);
			canvas.off("object:modified", sync);
			canvas.off("after:render", sync);
			window.removeEventListener("resize", sync);
		};
	}, [canvas, image, updatePosition]);

	const apply = (props: Record<string, unknown>) => {
		if (!canvas || !image) return;
		image.set(props);
		canvas.requestRenderAll();
	};

	const remove = () => {
		if (!canvas || !image) return;
		canvas.remove(image);
		canvas.discardActiveObject();
		canvas.requestRenderAll();
	};

	// 🔚 guard clause FINAL
	if (!canvas || !image) return null;

	return (
		<div
			ref={toolbarRef}
			style={{
				position: "fixed",
				left: pos.x + 10,
				top: pos.y,
				zIndex: 100,
				touchAction: "none",
			}}
			onPointerDown={(e) => e.stopPropagation()}
			onPointerUp={(e) => e.stopPropagation()}
		>
			<MobileImageToolbar image={image} apply={apply} onRemove={remove} />
		</div>
	);
}
