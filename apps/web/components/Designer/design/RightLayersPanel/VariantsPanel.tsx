"use client";

import { X } from "lucide-react";

export default function VariantsPanel({
	onClose,
	mobile = false,
}: {
	onClose?: () => void;
	mobile?: boolean;
}) {
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
					<h2 className="text-lg font-semibold text-black">Variantes</h2>

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
				{/* Título */}
				<span className="font-semibold text-base">Opciones</span>

				{/* Labels */}
				<div className="flex items-center gap-6">
					<span className="text-sm">Color</span>
					<span className="text-sm">Talla</span>

					<button
						type="button"
						className="ml-auto border rounded-[0.2rem] px-2.5 py-1.5 text-sm font-semibold"
					>
						Seleccionar variantes
					</button>
				</div>

				{/* Valores */}
				<div className="flex gap-6">
					{/* Color */}
					<div className="h-10 w-10 rounded-full border-2 border-black bg-white" />

					{/* Talla */}
					<div className="h-10 w-10 rounded-full border-2 border-black flex items-center justify-center font-semibold">
						M
					</div>
				</div>
			</div>
		</div>
	);
}
