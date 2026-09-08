"use client";

import { useEffect, useRef } from "react";
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
	const activo = useRef<HTMLButtonElement | null>(null);

	useEffect(() => {
		activo.current?.scrollIntoView({ block: "nearest", inline: "center" });
	}, []);

	return (
		/* Mismo tratamiento que en el teléfono. Aquí sobra ancho para cuatro
		   lados, pero no para una prenda con mangas y varias vistas en una
		   ventana estrecha, y sin esto el desbordamiento no se puede alcanzar:
		   no es que se vea apretado, es que el lado deja de existir. */
		<div
			className="
      absolute bottom-20 inset-x-0 z-10000
      overflow-x-auto overscroll-x-contain
      [scrollbar-width:none] [&::-webkit-scrollbar]:hidden
    "
		>
			<div className="flex w-max mx-auto gap-3 px-4 py-2">
				{sides.map((side) => {
					const label = product.sideLabels?.[side] ?? side; // 👈 usa el label amigable

					return (
						<button
							key={side}
							ref={currentSide === side ? activo : null}
							type="button"
							onClick={() => onChange(side)}
							className={`shrink-0 px-7 py-2 text-sm rounded-2xl border transition font-sora ${
								currentSide === side
									? "bg-tinta text-hueso-suave border-tinta"
									: "bg-white text-tinta border-gray-300 hover:bg-gray-100"
							}`}
						>
							{label}
						</button>
					);
				})}
			</div>
		</div>
	);
}
