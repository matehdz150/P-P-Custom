"use client";

import { Textbox } from "fabric";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import MobileTextToolbar from "./MobileTextToolbar";

export default function MobileTextToolbarContainer({
	openFontDrawer,
}: {
	openFontDrawer: () => void;
}) {
	const { activeObject, getCanvas } = useDesigner();
	const canvas = getCanvas();

	const text = activeObject instanceof Textbox ? activeObject : undefined;

	// 🔒 Hooks SIEMPRE arriba
	const toolbarRef = useRef<HTMLDivElement | null>(null);
	const [pos, setPos] = useState({ x: 0, y: 0 });

	// -------------------------
	// Posicionar arriba del texto
	// -------------------------
	const updatePosition = useCallback(() => {
		if (!canvas || !text || !toolbarRef.current) return;

		const el = canvas.upperCanvasEl;
		if (!el) return;

		const center = text.getCenterPoint();
		const vpt = canvas.viewportTransform;
		if (!vpt) return;

		const retina =
			typeof canvas.getRetinaScaling === "function"
				? canvas.getRetinaScaling()
				: 1;

		// 🔥 Canvas coords → viewport → CSS px
		const vx = (center.x * vpt[0] + vpt[4]) / retina;
		const vy = (center.y * vpt[3] + vpt[5]) / retina;

		const rect = el.getBoundingClientRect();
		const toolbarHeight = toolbarRef.current.offsetHeight;

		setPos({
			x: rect.left + vx,
			y: rect.top + vy - toolbarHeight - 8, // margen arriba del texto
		});
	}, [canvas, text]);

	// -------------------------
	// Sync con canvas
	// -------------------------
	useEffect(() => {
		if (!canvas || !text) return;

		updatePosition();
		const sync = () => updatePosition();

		canvas.on("object:moving", sync);
		canvas.on("object:scaling", sync);
		canvas.on("object:rotating", sync);
		canvas.on("object:modified", sync);

		canvas.on("selection:created", sync);
		canvas.on("selection:updated", sync);

		canvas.on("after:render", sync);
		window.addEventListener("resize", sync);

		return () => {
			canvas.off("object:moving", sync);
			canvas.off("object:scaling", sync);
			canvas.off("object:rotating", sync);
			canvas.off("object:modified", sync);

			canvas.off("selection:created", sync);
			canvas.off("selection:updated", sync);

			canvas.off("after:render", sync);
			window.removeEventListener("resize", sync);
		};
	}, [canvas, text, updatePosition]);

	// -------------------------
	// Acciones sobre el texto
	// -------------------------
	const apply = (props: Record<string, unknown>) => {
		if (!canvas || !text) return;
		text.set(props);
		canvas.requestRenderAll();
	};

	const duplicate = async () => {
		if (!canvas || !text) return;
		const clone = (await text.clone()) as Textbox;
		clone.set({
			left: (text.left ?? 0) + 16,
			top: (text.top ?? 0) + 16,
		});
		canvas.add(clone);
		canvas.setActiveObject(clone);
		canvas.requestRenderAll();
	};

	const remove = () => {
		if (!canvas || !text) return;
		canvas.remove(text);
		canvas.discardActiveObject();
		canvas.requestRenderAll();
	};

	// -------------------------
	// Guard clause FINAL
	if (!canvas || !text) return null;

	return (
		<div
			ref={toolbarRef}
			style={{
				position: "fixed",
				left: pos.x - 90,
				top: pos.y + 40,
				zIndex: 100,
				touchAction: "none", // 👈 CLAVE
			}}
			onPointerDown={(e) => {
				e.stopPropagation();
			}}
			onPointerUp={(e) => {
				e.stopPropagation();
			}}
		>
			<MobileTextToolbar
				text={text}
				openFontDrawer={openFontDrawer}
				apply={apply}
				onDuplicate={duplicate}
				onRemove={remove}
			/>
		</div>
	);
}
