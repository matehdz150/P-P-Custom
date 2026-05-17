"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import { useHistory } from "@/Contexts/HistoryContext";
import { CurvedText } from "@/lib/fabric/CurvedText";
import { ChangePropertyCommand } from "@/lib/history/commands/ChangePropertyCommand";

interface EditState {
	obj: CurvedText;
	x: number;
	y: number;
}

export default function CurvedTextEditor() {
	const { getCanvas } = useDesigner();
	const { execute } = useHistory();

	const [edit, setEdit] = useState<EditState | null>(null);
	const [value, setValue] = useState("");
	const originalRef = useRef("");
	const inputRef = useRef<HTMLInputElement | null>(null);

	// posición en pantalla: centrado en X, justo ENCIMA del texto
	const screenPos = useCallback(
		(obj: CurvedText) => {
			const canvas = getCanvas();
			if (!canvas) return { x: 0, y: 0 };
			const el = canvas.upperCanvasEl;
			const vpt = canvas.viewportTransform;
			if (!el || !vpt) return { x: 0, y: 0 };

			// vpt opera en unidades lógicas (CSS) — NO dividir por retina,
			// el rect del canvas ya está en px CSS.
			const center = obj.getCenterPoint();
			const vx = center.x * vpt[0] + vpt[4];
			const vy = center.y * vpt[3] + vpt[5];

			// media altura del objeto en pantalla → para subir el input
			const halfH =
				(obj.height * (obj.scaleY ?? 1) * Math.abs(vpt[3])) / 2;

			const rect = el.getBoundingClientRect();
			return {
				x: rect.left + vx,
				y: rect.top + vy - halfH - 14, // 14px de margen arriba
			};
		},
		[getCanvas],
	);

	// escucha doble click en el canvas
	useEffect(() => {
		const canvas = getCanvas();
		if (!canvas) return;

		const onDbl = (opt: { target?: unknown }) => {
			const target = opt.target;
			if (!(target instanceof CurvedText)) return;
			originalRef.current = target.text;
			setValue(target.text);
			const p = screenPos(target);
			setEdit({ obj: target, x: p.x, y: p.y });
		};

		canvas.on("mouse:dblclick", onDbl);
		return () => {
			canvas.off("mouse:dblclick", onDbl);
		};
	}, [getCanvas, screenPos]);

	// autofocus al abrir
	useEffect(() => {
		if (edit && inputRef.current) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [edit]);

	const liveUpdate = (v: string) => {
		setValue(v);
		if (!edit) return;
		edit.obj.set({ text: v.length ? v : " " });
		getCanvas()?.requestRenderAll();
	};

	const commit = () => {
		if (!edit) return;
		const obj = edit.obj;
		const finalText = value.trim().length ? value : "Texto";
		// dejar el objeto en su valor original y aplicar el cambio vía
		// comando → un solo paso de undo limpio
		obj.set({ text: originalRef.current });
		execute(new ChangePropertyCommand(obj, "text", finalText));
		getCanvas()?.requestRenderAll();
		setEdit(null);
	};

	const cancel = () => {
		if (!edit) return;
		edit.obj.set({ text: originalRef.current });
		getCanvas()?.requestRenderAll();
		setEdit(null);
	};

	if (!edit) return null;

	return (
		<input
			ref={inputRef}
			value={value}
			onChange={(e) => liveUpdate(e.target.value)}
			onBlur={commit}
			onKeyDown={(e) => {
				e.stopPropagation();
				if (e.key === "Enter") {
					e.preventDefault();
					commit();
				} else if (e.key === "Escape") {
					e.preventDefault();
					cancel();
				}
			}}
			style={{
				position: "fixed",
				left: edit.x,
				top: edit.y,
				transform: "translate(-50%, -100%)",
				zIndex: 400,
			}}
			className="px-3 py-2 text-center text-sm font-medium
				bg-white border-2 border-[#fe6241] rounded-md shadow-lg
				outline-none min-w-[180px]"
		/>
	);
}
