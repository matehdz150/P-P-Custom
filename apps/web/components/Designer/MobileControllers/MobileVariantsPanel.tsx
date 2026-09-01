"use client";

import { useDesigner } from "@/Contexts/DesignerContext";
import SelectorColorPrenda from "../design/SelectorColorPrenda";

export default function MobileVariantsPanel() {
	const { colores } = useDesigner();

	return (
		<div className="flex flex-col font-sora px-6 pb-24">
			{/* COLOR */}
			{colores.length > 0 && (
				<div className="mt-4">
					<span className="text-lg font-medium text-tinta font-sora">
						Color
					</span>
					<SelectorColorPrenda className="mt-3" tamano={48} />
				</div>
			)}

			{/* TALLA */}
			<div className="mt-8">
				<span className="text-lg font-medium text-tinta">Talla</span>

				<div className="flex gap-3 mt-3 flex-wrap">
					{["XS", "S", "M", "L", "XL"].map((size) => (
						<button
							key={size}
							type="button"
							className={`
                px-4 py-2 rounded-[0.2rem] text-base font-medium
                border
                ${
									size === "M"
										? "bg-tinta text-hueso-suave border-tinta"
										: "bg-white text-tinta border-gray-300"
								}
              `}
						>
							{size}
						</button>
					))}
				</div>
			</div>
		</div>
	);
}
