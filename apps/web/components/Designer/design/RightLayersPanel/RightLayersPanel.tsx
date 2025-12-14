"use client";

import type { FabricObject } from "fabric";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import LayerItem from "./LayerItem";

export default function RightLayersPanel({
	open,
	onClose,
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
	const layerIds = new WeakMap<object, string>();
	let layerIdCounter = 0;

	function getLayerKey(obj: object) {
		let id = layerIds.get(obj);
		if (!id) {
			id = `layer-${++layerIdCounter}`;
			layerIds.set(obj, id);
		}
		return id;
	}

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
			{/* HEADER */}
			<div className="px-4 py-3 flex items-center justify-between">
				<h2 className="text-lg font-semibold text-black font-sora px-2 py-2">
					Variantes y capas
				</h2>

				<button
					type="button"
					onClick={onClose}
					className="p-1 hover:bg-gray-100 rounded-md"
				>
					<X size={22} className="text-gray-600" />
				</button>
			</div>

			{/* Variantes */}
			<div className="px-7 mt-1 flex flex-col gap-4 font-sora">
				{/* Título */}
				<span className="font-semibold text-base">Variantes</span>

				{/* Opciones */}
				<div className="flex gap-7 w-fullitems-center">
					<span className="text-sm">Color</span>
					<span className="text-sm">Talla</span>

					<button
						type="button"
						className="ml-auto border rounded-[0.2rem] px-2.5 py-1.5 text-sm font-semibold cursor-pointer"
					>
						Seleccionar variantes
					</button>
				</div>

				{/* Valores seleccionados */}
				<div className="flex gap-7">
					{/* Color */}
					<div className="h-10 w-10 rounded-full border-2 border-black bg-white" />

					{/* Talla */}
					<div className="h-10 w-10 rounded-full border-2 border-black flex items-center justify-center font-semibold">
						M
					</div>
				</div>
			</div>

			{/* LIST */}
			{hasLayers && (
				<div className="flex-1 overflow-y-auto px-7 py-4 flex flex-col gap-3 mt-2">
					<span className="font-semibold text-base shrink-0">Capas</span>

					{layers.map((obj) => (
						<LayerItem key={getLayerKey(obj)} obj={obj} />
					))}
				</div>
			)}
		</div>
	);
}
