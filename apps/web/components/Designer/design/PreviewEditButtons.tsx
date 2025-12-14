"use client";

import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PreviewEditButtons({
	onOpenLayers,
	isLayersOpen,
}: {
	onOpenLayers: () => void;
	isLayersOpen: boolean;
}) {
	return (
		<div className="absolute top-1 right-4 flex items-center py-2 z-400 font-sora">
			<button
				type="button"
				className="px-10 py-2 rounded-l-[0.2rem] bg-black text-white border border-r-0"
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
				onClick={onOpenLayers}
				className={cn(
					"ml-3 px-2 py-2 border rounded-[0.2rem] cursor-pointer transition-colors",
					isLayersOpen
						? "bg-black text-white border-black"
						: "bg-white text-black hover:bg-gray-100",
				)}
			>
				<SlidersHorizontal size={22} />
			</button>
		</div>
	);
}
