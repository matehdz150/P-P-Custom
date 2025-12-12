"use client";

import { Layers, Palette, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import MobileAddMenu from "./MobileAddMenu";
import MobileDrawer from "./MobileDrawer";
import MobileLayersPanel from "./MobileLayersPanel";

export default function DesignerToolbarMobile() {
	const { getCanvas } = useDesigner();
	const [hasLayers, setHasLayers] = useState(false);

	// --------------------------------------------------
	// 🔥 Detectar si existen capas en el canvas
	// --------------------------------------------------
	useEffect(() => {
		const canvas = getCanvas();
		if (!canvas) return;

		const update = () => {
			const objs = canvas.getObjects().filter((o) => o.selectable !== false);
			setHasLayers(objs.length > 0);
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

	return (
		<div className="h-24 border-t bg-white flex items-start justify-around px-10">
			{/* Diseños */}
			<button
				type="button"
				className="flex flex-col items-center justify-center gap-1 mt-4"
			>
				<Palette size={32} strokeWidth={1.5} />
				<p className="text-l font-medium">Diseños</p>
			</button>

			{/* Agregar diseño (Drawer) */}
			<MobileDrawer
				trigger={
					<button
						type="button"
						className="w-16 h-16 flex items-center justify-center rounded-full bg-black text-white mt-1"
					>
						<Plus size={28} />
					</button>
				}
				title="Agregar diseño"
			>
				{({ closeDrawer }) => <MobileAddMenu closeDrawer={closeDrawer} />}
			</MobileDrawer>

			{/* Capas -> Drawer solo si hay layers */}
			{hasLayers ? (
				<MobileDrawer
					trigger={
						<button
							type="button"
							className="flex flex-col items-center justify-center gap-1 mt-4 text-black"
						>
							<Layers size={32} strokeWidth={1.5} className="text-black" />
							<p className="text-l font-medium text-black">Capas</p>
						</button>
					}
					title="Capas"
				>
					{() => <MobileLayersPanel />}
				</MobileDrawer>
			) : (
				// Botón deshabilitado
				<button
					type="button"
					disabled
					className="flex flex-col items-center justify-center gap-1 mt-4 opacity-40 cursor-not-allowed"
				>
					<Layers size={32} strokeWidth={1.5} className="text-gray-800" />
					<p className="text-l font-medium text-gray-800">Capas</p>
				</button>
			)}
		</div>
	);
}
