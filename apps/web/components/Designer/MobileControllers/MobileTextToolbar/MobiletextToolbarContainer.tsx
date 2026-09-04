"use client";

import { Textbox } from "fabric";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import { useHistory } from "@/Contexts/HistoryContext";
import { CurvedText } from "@/lib/fabric/CurvedText";
import { ReplaceObjectCommand } from "@/lib/history/commands/ReplaceObjectCommand";
import MobileTextToolbar from "./MobileTextToolbar";

export default function MobileTextToolbarContainer({
	openFontDrawer,
}: {
	openFontDrawer: () => void;
}) {
	const { activeObject, getCanvas, setActiveObject } = useDesigner();
	const { execute } = useHistory();
	const canvas = getCanvas();

	// Accept both Textbox and CurvedText
	const text =
		activeObject instanceof Textbox || activeObject instanceof CurvedText
			? (activeObject as Textbox | CurvedText)
			: undefined;

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

	const toggleCurved = () => {
		if (!canvas || !text) return;
		const ORANGE = "#2b2812";
		const applyStyle = (obj: CurvedText | Textbox) =>
			obj.set({
				transparentCorners: false,
				cornerColor: "#ffffff",
				cornerStrokeColor: ORANGE,
				borderColor: ORANGE,
				cornerSize: 8,
				cornerStyle: "rect",
			} as never);

		if (text instanceof Textbox) {
			const curved = new CurvedText({
				text: text.text ?? "Texto",
				left: text.left,
				top: text.top,
				fontSize: text.fontSize,
				fontFamily: text.fontFamily,
				fontWeight: text.fontWeight as string,
				fontStyle: text.fontStyle as string,
				fill: typeof text.fill === "string" ? text.fill : "#000000",
				angle: text.angle,
				opacity: text.opacity,
				curvature: -50,
				clipPath: text.clipPath as never,
			} as never);
			applyStyle(curved);
			execute(new ReplaceObjectCommand(text, curved));
			setActiveObject(curved);
		} else if (text instanceof CurvedText) {
			const tb = new Textbox((text as unknown as CurvedText).text, {
				left: text.left,
				top: text.top,
				fontSize: (text as unknown as CurvedText).fontSize,
				fontFamily: (text as unknown as CurvedText).fontFamily,
				fontWeight: (text as unknown as CurvedText).fontWeight as string,
				fontStyle: (text as unknown as CurvedText).fontStyle as string,
				fill: typeof text.fill === "string" ? text.fill : "#000000",
				angle: text.angle,
				opacity: text.opacity,
				width: 300,
				clipPath: text.clipPath as never,
			});
			applyStyle(tb);
			execute(new ReplaceObjectCommand(text as never, tb));
			setActiveObject(tb);
		}
	};

	// -------------------------
	// Guard clause FINAL
	if (!canvas || !text) return null;

	return (
		<div
			ref={toolbarRef}
			style={{
				position: "fixed",
				left: "50%",
				top: pos.y + 40, // 👈 sigues usando la Y del texto
				transform: "translateX(-50%)",
				zIndex: 100,
				touchAction: "none",
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
				isCurved={text instanceof CurvedText}
				openFontDrawer={openFontDrawer}
				apply={apply}
				onToggleCurved={toggleCurved}
				onDuplicate={duplicate}
				onRemove={remove}
			/>
		</div>
	);
}
