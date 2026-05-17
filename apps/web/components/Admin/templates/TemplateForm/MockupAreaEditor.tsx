"use client";

import { useCallback, useRef, useState } from "react";
import type { EditableArea } from "@/lib/api/templates";

// Debe coincidir EXACTO con el diseñador (useFabricCanvas / useFabricMockup)
export const CANVAS_W = 1445;
export const CANVAS_H = 825;
export const MOCKUP_W = 700;

type Handle =
	| "move"
	| "nw"
	| "ne"
	| "sw"
	| "se"
	| "n"
	| "s"
	| "e"
	| "w";

type Props = {
	mockup?: string;
	areas: EditableArea[];
	selectedId: string | null;
	onSelect: (id: string) => void;
	onChange: (id: string, patch: Partial<EditableArea>) => void;
};

export function MockupAreaEditor({
	mockup,
	areas,
	selectedId,
	onSelect,
	onChange,
}: Props) {
	const boxRef = useRef<HTMLDivElement | null>(null);
	const [natRatio, setNatRatio] = useState(1); // natH / natW

	// rect del mockup en unidades de canvas
	const mW = MOCKUP_W;
	const mH = MOCKUP_W * natRatio;
	const mLeft = CANVAS_W / 2 - mW / 2;
	const mTop = CANVAS_H / 2 - mH / 2;

	const px = (v: number, axis: "x" | "y") =>
		`${(v / (axis === "x" ? CANVAS_W : CANVAS_H)) * 100}%`;

	const drag = useRef<{
		handle: Handle;
		id: string;
		startX: number;
		startY: number;
		area: EditableArea;
	} | null>(null);

	const clamp = useCallback((a: EditableArea): EditableArea => {
		const width = Math.max(20, Math.min(a.width, CANVAS_W));
		const height = Math.max(20, Math.min(a.height, CANVAS_H));
		const left = Math.max(0, Math.min(a.left, CANVAS_W - width));
		const top = Math.max(0, Math.min(a.top, CANVAS_H - height));
		return {
			...a,
			left: Math.round(left),
			top: Math.round(top),
			width: Math.round(width),
			height: Math.round(height),
		};
	}, []);

	const onPointerDown = (
		e: React.PointerEvent,
		handle: Handle,
		area: EditableArea,
	) => {
		e.stopPropagation();
		e.preventDefault();
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
		onSelect(area.id);
		drag.current = {
			handle,
			id: area.id,
			startX: e.clientX,
			startY: e.clientY,
			area: { ...area },
		};
	};

	const onPointerMove = (e: React.PointerEvent) => {
		const d = drag.current;
		const box = boxRef.current;
		if (!d || !box) return;

		const rect = box.getBoundingClientRect();
		const dxCu = ((e.clientX - d.startX) / rect.width) * CANVAS_W;
		const dyCu = ((e.clientY - d.startY) / rect.height) * CANVAS_H;

		let { left, top, width, height } = d.area;

		switch (d.handle) {
			case "move":
				left += dxCu;
				top += dyCu;
				break;
			case "nw":
				left += dxCu;
				top += dyCu;
				width -= dxCu;
				height -= dyCu;
				break;
			case "ne":
				top += dyCu;
				width += dxCu;
				height -= dyCu;
				break;
			case "sw":
				left += dxCu;
				width -= dxCu;
				height += dyCu;
				break;
			case "se":
				width += dxCu;
				height += dyCu;
				break;
			case "n":
				top += dyCu;
				height -= dyCu;
				break;
			case "s":
				height += dyCu;
				break;
			case "e":
				width += dxCu;
				break;
			case "w":
				left += dxCu;
				width -= dxCu;
				break;
		}

		onChange(d.id, clamp({ ...d.area, left, top, width, height }));
	};

	const onPointerUp = (e: React.PointerEvent) => {
		if (drag.current) {
			(e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
			drag.current = null;
		}
	};

	const HANDLES: { h: Handle; cls: string }[] = [
		{ h: "nw", cls: "-top-1.5 -left-1.5 cursor-nwse-resize" },
		{ h: "ne", cls: "-top-1.5 -right-1.5 cursor-nesw-resize" },
		{ h: "sw", cls: "-bottom-1.5 -left-1.5 cursor-nesw-resize" },
		{ h: "se", cls: "-bottom-1.5 -right-1.5 cursor-nwse-resize" },
		{ h: "n", cls: "-top-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize" },
		{ h: "s", cls: "-bottom-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize" },
		{ h: "e", cls: "-right-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize" },
		{ h: "w", cls: "-left-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize" },
	];

	return (
		<div
			ref={boxRef}
			className="relative w-full rounded-md overflow-hidden border bg-[#f2f3ea] select-none"
			style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
		>
			{/* MOCKUP */}
			{mockup ? (
				// eslint-disable-next-line @next/next/no-img-element
				<img
					src={mockup}
					alt="mockup"
					draggable={false}
					onLoad={(e) => {
						const el = e.currentTarget;
						if (el.naturalWidth)
							setNatRatio(el.naturalHeight / el.naturalWidth);
					}}
					style={{
						position: "absolute",
						left: px(mLeft, "x"),
						top: px(mTop, "y"),
						width: px(mW, "x"),
						height: px(mH, "y"),
						objectFit: "fill",
						pointerEvents: "none",
					}}
				/>
			) : (
				<div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">
					Sube un mockup para empezar
				</div>
			)}

			{/* ÁREAS */}
			{areas.map((a) => {
				const active = a.id === selectedId;
				return (
					<div
						key={a.id}
						onPointerDown={(e) => onPointerDown(e, "move", a)}
						className={`absolute ${
							active
								? "border-2 border-[#fe6241] bg-[#fe6241]/15 z-20 cursor-move"
								: "border border-[#fe6241]/50 bg-[#fe6241]/5 z-10 cursor-pointer"
						}`}
						style={{
							left: px(a.left, "x"),
							top: px(a.top, "y"),
							width: px(a.width, "x"),
							height: px(a.height, "y"),
							borderRadius:
								a.type === "ellipse" ? "50%" : undefined,
							clipPath:
								a.type === "triangle"
									? "polygon(50% 0%, 100% 100%, 0% 100%)"
									: undefined,
						}}
					>
						<span
							className={`absolute -top-5 left-0 text-[10px] font-semibold px-1 rounded ${
								active
									? "bg-[#fe6241] text-white"
									: "bg-[#fe6241]/40 text-white"
							}`}
						>
							{a.id}
						</span>

						{active &&
							HANDLES.map(({ h, cls }) => (
								<div
									key={h}
									onPointerDown={(e) => onPointerDown(e, h, a)}
									className={`absolute w-3 h-3 bg-white border-2 border-[#fe6241] rounded-sm ${cls}`}
								/>
							))}
					</div>
				);
			})}
		</div>
	);
}
