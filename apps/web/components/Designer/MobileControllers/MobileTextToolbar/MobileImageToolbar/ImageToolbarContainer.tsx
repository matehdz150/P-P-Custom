"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import { useAccionesDeGrafico } from "@/components/Designer/hooks/useAccionesDeGrafico";
import { esObjetoGrafico } from "@/lib/fabric/esObjetoGrafico";
import MobileImageToolbar from "./MobileImageToolbar";

export default function MobileImageToolbarContainer() {
	const { activeObject, getCanvas } = useDesigner();
	const canvas = getCanvas();

	const image = esObjetoGrafico(activeObject) ? activeObject : undefined;

	const { aplicar, duplicar, borrar } = useAccionesDeGrafico(image);

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

		const rect = el.getBoundingClientRect();
		const toolbarHeight = toolbarRef.current.offsetHeight;
		const toolbarWidth = toolbarRef.current.offsetWidth;
		// El viewport de Fabric ya está en píxeles lógicos; sólo falta la escala CSS.
		const vx =
			((center.x * vpt[0] + center.y * vpt[2] + vpt[4]) * rect.width) /
			canvas.getWidth();
		const vy =
			((center.x * vpt[1] + center.y * vpt[3] + vpt[5]) * rect.height) /
			canvas.getHeight();
		setPos({
			x: Math.max(
				8,
				Math.min(
					rect.left + vx - toolbarWidth / 2,
					window.innerWidth - toolbarWidth - 8,
				),
			),
			y: Math.max(
				8,
				Math.min(
					rect.top + vy - toolbarHeight - 8,
					window.innerHeight - toolbarHeight - 8,
				),
			),
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

	// 🔚 guard clause FINAL
	if (!canvas || !image) return null;

	return (
		<div
			ref={toolbarRef}
			style={{
				position: "fixed",
				left: pos.x,
				top: pos.y,
				zIndex: 100,
				touchAction: "pan-x",
			}}
			onPointerDown={(e) => e.stopPropagation()}
			onPointerUp={(e) => e.stopPropagation()}
		>
			<MobileImageToolbar
				image={image}
				apply={aplicar}
				onDuplicate={duplicar}
				onRemove={borrar}
			/>
		</div>
	);
}
