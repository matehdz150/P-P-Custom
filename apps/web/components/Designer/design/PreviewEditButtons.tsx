"use client";

import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PreviewEditButtons({
	onToggleLayers,
	isLayersOpen,
}: {
	onToggleLayers: () => void;
	isLayersOpen: boolean;
}) {
	return (
		<div className="absolute top-1 right-4 flex items-center py-2 z-400 font-sora">
			<button
				type="button"
				className="px-10 py-2 rounded-l-[0.2rem] bg-tinta text-hueso-suave border border-r-0"
			>
				<span className="font-semibold">Editar</span>
			</button>

			<button
				type="button"
				className="px-10 py-2 bg-white border border-l-0 rounded-r-[0.2rem]"
			>
				<span className="font-semibold">Probar</span>
			</button>

			<button
				type="button"
				onClick={onToggleLayers}
				aria-expanded={isLayersOpen}
				aria-label={isLayersOpen ? "Cerrar opciones" : "Abrir opciones"}
				title={isLayersOpen ? "Cerrar opciones" : "Abrir opciones"}
				className={cn(
					"ml-3 px-2 py-2 border rounded-[0.2rem] cursor-pointer transition-colors",
					isLayersOpen
						? "bg-tinta text-hueso-suave border-tinta"
						: "bg-white text-tinta hover:bg-gray-100",
				)}
			>
				<SlidersHorizontal size={22} />
			</button>
		</div>
	);
}
