"use client";

import type { FabricObject } from "fabric";
import { useEffect, useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import LayerItem from "../design/RightLayersPanel/LayerItem"; // 👈 ajusta el path si es distinto

export default function MobileLayersPanel() {
	const { getCanvas } = useDesigner();
	const [layers, setLayers] = useState<FabricObject[]>([]);

	useEffect(() => {
		const canvas = getCanvas();
		if (!canvas) return;

		const update = () => {
			const objs = canvas.getObjects().filter((o) => o.selectable !== false);
			// misma lógica que desktop: primero el de arriba
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

	if (!layers.length) {
		return (
			<p className="text-sm text-gray-500 px-1 pb-4">
				Aún no hay capas. Agrega texto o imágenes para verlas aquí.
			</p>
		);
	}

	return (
		<div className="flex flex-col gap-3 pb-6">
			{layers.map((obj) => (
				<LayerItem
					key={String(
						(obj as { id?: string | number }).id ?? obj.type ?? obj.toString(),
					)}
					obj={obj}
				/>
			))}
		</div>
	);
}
