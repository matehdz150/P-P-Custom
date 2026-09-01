"use client";

import { X } from "lucide-react";
import { useDesigner } from "@/Contexts/DesignerContext";
import SelectorColorPrenda from "../SelectorColorPrenda";

export default function VariantsPanel({
	onClose,
	mobile = false,
}: {
	onClose?: () => void;
	mobile?: boolean;
}) {
	const { colores } = useDesigner();

	return (
		<div
			className={`
        flex flex-col font-sora
        ${mobile ? "pb-6" : ""}
      `}
		>
			{/* HEADER (solo si viene onClose, o sea drawer) */}
			{onClose && (
				<div className="px-4 py-3 flex items-center justify-between border-b">
					<h2 className="text-lg font-semibold text-tinta">Variantes</h2>

					<button
						type="button"
						onClick={onClose}
						className="p-1 hover:bg-gray-100 rounded-md"
					>
						<X size={22} className="text-gray-600" />
					</button>
				</div>
			)}

			{/* CONTENIDO */}
			<div className="px-6 mt-4 flex flex-col gap-5">
				<span className="font-semibold text-base">Opciones</span>

				{colores.length > 0 && (
					<div className="flex flex-col gap-3">
						<span className="text-sm">Color</span>
						<SelectorColorPrenda />
					</div>
				)}

				<div className="flex flex-col gap-3">
					<span className="text-sm">Talla</span>
					<div className="h-10 w-10 rounded-full border-2 border-tinta flex items-center justify-center font-semibold">
						M
					</div>
				</div>
			</div>
		</div>
	);
}
