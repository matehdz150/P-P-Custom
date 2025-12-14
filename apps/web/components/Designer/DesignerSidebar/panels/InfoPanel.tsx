"use client";

import { Download, Info, X } from "lucide-react";

export default function InfoPanel({ close }: { close: () => void }) {
	return (
		<div className="h-[80%] flex flex-col font-sora bg-white">
			{/* HEADER */}
			<div className="p-6 pb-2 flex justify-between items-center">
				<h2 className="font-semibold text-lg text-black">
					Información del producto
				</h2>
				<button type="button" onClick={close}>
					<X size={22} />
				</button>
			</div>

			{/* CONTENT */}
			<div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
				{/* PRODUCT TITLE */}
				<h3 className="font-semibold text-sm text-black">
					Unisex Garment-Dyed T-shirt
				</h3>

				{/* PRODUCT CARD */}
				<div className="flex gap-4">
					<div className="bg-gray-200 h-36 w-36 rounded-[0.2rem] shrink-0" />

					<div className="flex flex-col gap-2 text-xs text-[#5b5b4a]">
						<span>Comfort Colors® · 1717</span>
						<span>Fulfilled by Printify Choice</span>
						<span>41 of 410 disponibles</span>

						<button
							type="button"
							className="text-sm font-medium underline text-black w-fit"
						>
							Ver detalles
						</button>
					</div>
				</div>

				{/* MAIN ACTION */}
				<button
					type="button"
					className="
            flex items-center gap-3
            border rounded-[0.2rem]
            px-4 py-3
            font-semibold text-sm
            hover:bg-gray-50
          "
				>
					<Download size={18} />
					Descargar plantilla de diseño
				</button>

				{/* TECH INFO */}
				<div className="flex flex-col gap-3 text-sm">
					<div className="flex justify-between">
						<span className="font-medium">Costo de producción</span>
						<span className="text-[#5b5b4a]">USD 12.41 – 17.66</span>
					</div>

					<div className="flex justify-between">
						<span className="font-medium">Área de impresión</span>
						<span className="text-[#5b5b4a]">4494 × 5097 px</span>
					</div>
				</div>

				{/* MATERIAL & FIT */}
				<div className="bg-[#f4f4ee] rounded-[0.2rem] p-4 flex gap-3">
					<div className="w-1 bg-black/70 rounded-full" />

					<div className="flex flex-col gap-2 text-sm">
						<span className="font-semibold text-black">Material y ajuste</span>

						<ul className="text-[#5b5b4a] space-y-1">
							<li>• 100% algodón ring-spun</li>
							<li>• Tela teñida en prenda (garment-dyed)</li>
							<li>• Fit unisex regular</li>
						</ul>
					</div>
				</div>

				{/* DESIGN RECOMMENDATIONS */}
				<div className="bg-[#f4f4ee] rounded-[0.2rem] p-4 flex gap-3">
					<div className="w-1 bg-black/70 rounded-full" />

					<div className="flex flex-col gap-2 text-sm">
						<span className="font-semibold text-black">
							Recomendaciones de diseño
						</span>

						<ul className="text-[#5b5b4a] space-y-1">
							<li>• Resolución mínima: 300 DPI</li>
							<li>• Usar archivos PNG con fondo transparente</li>
							<li>• Evitar líneas muy delgadas</li>
						</ul>
					</div>
				</div>

				{/* PRINT METHOD */}
				<div className="bg-[#efefe8] rounded-[0.2rem] p-4 flex gap-3">
					<Info size={20} className="shrink-0 mt-1" />

					<div className="flex flex-col gap-2">
						<span className="font-semibold text-sm">Método de impresión</span>

						<p className="text-sm text-[#5b5b4a] leading-relaxed">
							Impresión DTG con tintas base agua. Ideal para ilustraciones
							detalladas y degradados suaves.
						</p>
					</div>
				</div>

				{/* CARE */}
				<div className="bg-[#f4f4ee] rounded-[0.2rem] p-4 flex gap-3">
					<div className="w-1 bg-black/70 rounded-full" />

					<div className="flex flex-col gap-2 text-sm">
						<span className="font-semibold text-black">
							Cuidado de la prenda
						</span>

						<ul className="text-[#5b5b4a] space-y-1">
							<li>• Lavar en frío</li>
							<li>• No usar secadora</li>
							<li>• Planchar del reverso</li>
						</ul>
					</div>
				</div>
			</div>
		</div>
	);
}
