"use client";

import type { FabricObject } from "fabric";
import { PanelRightOpen, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import LayerItem from "./LayerItem";

export default function RightLayersPanel() {
	const { getCanvas } = useDesigner();

	const [layers, setLayers] = useState<FabricObject[]>([]);
	const [isOpen, setIsOpen] = useState(true);

	// -----------------------------------------
	// LISTEN FOR CANVAS UPDATES
	// -----------------------------------------
	useEffect(() => {
		const canvas = getCanvas();
		if (!canvas) return;

		const update = () => {
			const objs = canvas.getObjects().filter((o) => o.selectable !== false);
			setLayers(objs.reverse());
		};

		update();

		const events = [
			"object:added",
			"object:removed",
			"object:modified",
			"selection:created",
			"selection:updated",
			"selection:cleared",
		] as const;

		for (const ev of events) {
			canvas.on(ev, update);
		}
		return () => {
			for (const ev of events) {
				canvas.off(ev, update);
			}
		};
	}, [getCanvas]);

	// -----------------------------------------
	// IF PANEL IS CLOSED → ONLY SHOW OPENER TAB
	// -----------------------------------------
	if (!isOpen) {
		return (
			<button
				type="button"
				onClick={() => setIsOpen(true)}
				className="
          fixed right-0 top-1/2 -translate-y-1/2
          px-3 py-2 bg-white border border-r-0
          rounded-l-lg shadow-sm
          flex items-center gap-2
          hover:bg-gray-100 transition
          z-50
        "
			>
				<PanelRightOpen size={18} className="text-gray-700" />
				<span className="text-sm font-medium text-gray-700">Layers</span>
			</button>
		);
	}

	// -----------------------------------------
	// OPEN PANEL VIEW
	// -----------------------------------------
	return (
		<div
			className="
        fixed right-0 top-20 h-full w-[400px]
        bg-white border-l z-60 flex flex-col shadow-xl
      "
		>
			{/* HEADER */}
			<div className="px-4 py-3 border-b flex items-center justify-between">
				<h2 className="text-sm font-semibold text-[#3b3b2f]">Layers</h2>

				{/* CLOSE BUTTON */}
				<button
					type="button"
					onClick={() => setIsOpen(false)}
					className="p-1 hover:bg-gray-100 rounded-md"
				>
					<X size={18} className="text-gray-600" />
				</button>
			</div>

			{/* LIST OF LAYERS */}
			<div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-3">
				{layers.map((obj) => (
					<LayerItem
						key={String(
							(obj as { id?: string | number }).id ??
								obj.type ??
								obj.toString(),
						)}
						obj={obj}
					/>
				))}
			</div>
		</div>
	);
}
