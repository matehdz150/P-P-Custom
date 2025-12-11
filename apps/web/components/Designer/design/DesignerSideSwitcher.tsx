"use client";

import type { ProductTemplate } from "@/lib/products/types";

interface Props {
	currentSide: string;
	sides: string[];
	onChange: (side: string) => void;
	product: ProductTemplate; // 👈 agregar
}

export default function DesignerSideSwitcher({
	currentSide,
	sides,
	onChange,
	product,
}: Props) {
	return (
		<div
			className="
      absolute bottom-20 left-1/2 -translate-x-1/2
      flex gap-3 bg-transparent
      px-4 py-2 rounded-full z-10000
    "
		>
			{sides.map((side) => {
				const label = product.sideLabels?.[side] ?? side; // 👈 usa el label amigable

				return (
					<button
						key={side}
						type="button"
						onClick={() => onChange(side)}
						className={`px-7 py-2 text-sm rounded-2xl border transition ${
							currentSide === side
								? "bg-black text-white border-black"
								: "bg-white text-black border-gray-300 hover:bg-gray-100"
						}`}
					>
						{label}
					</button>
				);
			})}
		</div>
	);
}
