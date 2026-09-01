"use client";

import type { FabricObject } from "fabric";
import { ChevronDown, ChevronUp, GripVertical, Trash } from "lucide-react";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import { useHistory } from "@/Contexts/HistoryContext";
import { RemoveObjectCommand } from "@/lib/history/commands/RemoveObjectCommand";
import { ReorderObjectCommand } from "@/lib/history/commands/ReorderObjectCommand";
import { getIcon, getLabel, getSubtitle } from "../RightLayersPanel/helpers";

const layerKeyMap = new WeakMap<FabricObject, string>();

function getLayerKey(obj: FabricObject): string {
	let key = layerKeyMap.get(obj);
	if (!key) {
		key = nanoid();
		layerKeyMap.set(obj, key);
	}
	return key;
}

export default function SidebarLayersPanel({ close }: { close: () => void }) {
	const { getCanvas, activeObject, setActiveObject } = useDesigner();
	const { execute } = useHistory();

	const [layers, setLayers] = useState<FabricObject[]>([]);
	const [dragKey, setDragKey] = useState<string | null>(null);
	const [overKey, setOverKey] = useState<string | null>(null);
	const sigRef = useRef<string>("");

	// lee capas seleccionables del canvas, frente → fondo (reversed)
	const readLayers = useCallback((): FabricObject[] => {
		const canvas = getCanvas();
		if (!canvas) return [];
		return canvas
			.getObjects()
			.filter((o) => o.selectable !== false)
			.slice()
			.reverse();
	}, [getCanvas]);

	const refresh = useCallback(() => {
		const next = readLayers();
		const sig = next.map((o) => getLayerKey(o)).join("|");
		if (sig !== sigRef.current) {
			sigRef.current = sig;
			setLayers(next);
		}
	}, [readLayers]);

	useEffect(() => {
		const canvas = getCanvas();
		if (!canvas) return;

		refresh();

		// after:render cubre cualquier cambio de orden (no emite object:*)
		const events = [
			"object:added",
			"object:removed",
			"object:modified",
			"selection:created",
			"selection:updated",
			"selection:cleared",
			"after:render",
		] as const;

		events.forEach((ev) => canvas.on(ev, refresh));
		return () => {
			events.forEach((ev) => canvas.off(ev, refresh));
		};
	}, [getCanvas, refresh]);

	const handleSelect = (obj: FabricObject) => {
		const canvas = getCanvas();
		if (!canvas) return;
		canvas.setActiveObject(obj);
		canvas.requestRenderAll();
		setActiveObject(obj);
	};

	const handleDelete = (obj: FabricObject) => {
		execute(new RemoveObjectCommand(obj));
		if (activeObject === obj) setActiveObject(null);
	};

	// Mueve el objeto a una posición visual `toVisual` (0 = más al frente)
	const moveToVisual = useCallback(
		(obj: FabricObject, toVisual: number) => {
			const canvas = getCanvas();
			if (!canvas) return;

			const all = canvas.getObjects();
			const floor = all.filter((o) => o.selectable === false).length;
			const n = all.length - floor; // # de capas seleccionables

			const clamped = Math.max(0, Math.min(n - 1, toVisual));
			// índice z final deseado en el array del canvas
			const target = floor + (n - 1 - clamped);
			const current = all.indexOf(obj);
			if (current === target) return;

			execute(new ReorderObjectCommand(obj, target));
			setActiveObject(obj);
			canvas.setActiveObject(obj);
			canvas.requestRenderAll();
			refresh();
		},
		[execute, getCanvas, refresh, setActiveObject],
	);

	const moveByArrow = (obj: FabricObject, dir: "front" | "back") => {
		const idx = layers.indexOf(obj);
		if (idx < 0) return;
		// front = subir en la lista (idx-1), back = bajar (idx+1)
		moveToVisual(obj, dir === "front" ? idx - 1 : idx + 1);
	};

	// ---- Drag & Drop ----
	const handleDrop = (targetObj: FabricObject) => {
		if (!dragKey) return;
		const fromIdx = layers.findIndex((o) => getLayerKey(o) === dragKey);
		const toIdx = layers.indexOf(targetObj);
		if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) {
			setDragKey(null);
			setOverKey(null);
			return;
		}
		const dragged = layers[fromIdx];
		moveToVisual(dragged, toIdx);
		setDragKey(null);
		setOverKey(null);
	};

	return (
		<div className="h-full flex flex-col">
			<div className="px-4 py-3 border-b flex items-center justify-between">
				<div>
					<h2 className="text-sm font-semibold text-[#3b3b2f]">
						Variants and layers
					</h2>
					<p className="text-xs text-gray-500">
						Arrastra para reordenar
					</p>
				</div>
				<button
					type="button"
					onClick={close}
					className="text-gray-500 hover:text-tinta text-sm"
				>
					✕
				</button>
			</div>

			<div className="flex-1 overflow-y-auto px-3 py-3">
				{layers.length === 0 && (
					<p className="text-xs text-gray-500">
						No hay capas en este lado todavía.
					</p>
				)}

				<div className="flex flex-col gap-2">
					{layers.map((obj, idx) => {
						const key = getLayerKey(obj);
						const isActive = obj === activeObject;
						const isOver = overKey === key && dragKey !== key;
						const isDragging = dragKey === key;
						const isTop = idx === 0;
						const isBottom = idx === layers.length - 1;

						return (
							<div
								role="button"
								tabIndex={0}
								key={key}
								draggable
								onDragStart={(e) => {
									setDragKey(key);
									e.dataTransfer.effectAllowed = "move";
								}}
								onDragOver={(e) => {
									e.preventDefault();
									e.dataTransfer.dropEffect = "move";
									if (overKey !== key) setOverKey(key);
								}}
								onDragLeave={() => {
									if (overKey === key) setOverKey(null);
								}}
								onDrop={(e) => {
									e.preventDefault();
									handleDrop(obj);
								}}
								onDragEnd={() => {
									setDragKey(null);
									setOverKey(null);
								}}
								onClick={() => handleSelect(obj)}
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault();
										handleSelect(obj);
									}
								}}
								className={`
                  w-full flex items-center justify-between gap-2
                  px-2 py-2 rounded-lg border text-left cursor-pointer
                  transition
                  ${isDragging ? "opacity-40" : ""}
                  ${
										isOver
											? "border-tinta border-2 bg-[#f3f3f1]"
											: isActive
												? "border-[#6b6b3a] bg-[#f6f5ee]"
												: "border-gray-200 hover:border-[#a3a380] hover:bg-[#f8f7f2]"
									}
                `}
							>
								<div className="flex items-center gap-2 min-w-0">
									<GripVertical
										size={16}
										className="text-gray-400 shrink-0 cursor-grab active:cursor-grabbing"
									/>

									<div
										className={`
                      w-9 h-9 rounded-lg flex items-center justify-center
                      border shrink-0
                      ${isActive ? "border-[#6b6b3a] bg-white" : "border-gray-200 bg-white"}
                    `}
									>
										{getIcon(obj)}
									</div>

									<div className="flex flex-col min-w-0">
										<span className="text-sm font-medium text-[#3b3b2f] truncate">
											{getLabel(obj)}
										</span>
										{getSubtitle(obj) && (
											<span className="text-xs text-gray-500 truncate">
												{getSubtitle(obj)}
											</span>
										)}
									</div>
								</div>

								<div className="flex items-center gap-0.5 shrink-0">
									<button
										type="button"
										disabled={isTop}
										onClick={(e) => {
											e.stopPropagation();
											moveByArrow(obj, "front");
										}}
										className="p-1 rounded hover:bg-[#eceadd] text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
										aria-label="Subir capa"
									>
										<ChevronUp size={16} />
									</button>

									<button
										type="button"
										disabled={isBottom}
										onClick={(e) => {
											e.stopPropagation();
											moveByArrow(obj, "back");
										}}
										className="p-1 rounded hover:bg-[#eceadd] text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
										aria-label="Bajar capa"
									>
										<ChevronDown size={16} />
									</button>

									<button
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											handleDelete(obj);
										}}
										className="p-1 rounded hover:bg-[#f3e9e4] text-gray-600"
										aria-label="Eliminar capa"
									>
										<Trash size={16} />
									</button>
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
