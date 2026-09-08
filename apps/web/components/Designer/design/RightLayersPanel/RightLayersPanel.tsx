"use client";

import type { FabricObject } from "fabric";
import { useEffect, useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import { claveDeCapa } from "./helpers";
import LayerItem from "./LayerItem";
import VariantsPanel from "./VariantsPanel";

export default function RightLayersPanel({
	open,
}: {
	open: boolean;
	onClose: () => void;
}) {
	const { getCanvas } = useDesigner();
	const [layers, setLayers] = useState<FabricObject[]>([]);

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

	if (!open) return null;

	const hasLayers = layers.length > 0;

	return (
		<div
			className={`
    fixed right-0 top-20 w-[400px]
    bg-white border z-60
    flex flex-col
    transition-[height] duration-200 ease-out pb-5
    ${hasLayers ? "h-[calc(100vh-7rem)]" : "h-60"}
  `}
		>
			<VariantsPanel />

			{/* LIST */}
			{hasLayers && (
				<div className="flex-1 overflow-y-auto px-7 py-4 flex flex-col gap-3 mt-2">
					<span className="font-semibold text-base shrink-0">Capas</span>

					{layers.map((obj) => (
						<LayerItem key={claveDeCapa(obj)} obj={obj} />
					))}
				</div>
			)}
		</div>
	);
}
