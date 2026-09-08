"use client";

import { useEffect, useRef } from "react";
import type { ProductTemplate } from "@/lib/products/types";

interface Props {
	currentSide: string;
	sides: string[];
	onChange: (side: string) => void;
	product: ProductTemplate;
}

export default function DesignerSideSwitcher({
	currentSide,
	sides,
	onChange,
	product,
}: Props) {
	const activo = useRef<HTMLButtonElement | null>(null);

	/* Con las mangas puestas hay cuatro lados y no caben: el elegido puede
	   quedarse fuera de la parte visible, y entonces el conmutador enseña
	   "Delante · Detrás" mientras se está editando la manga derecha. */
	useEffect(() => {
		activo.current?.scrollIntoView({ block: "nearest", inline: "center" });
	}, []);

	return (
		/* DESBORDA EN CUANTO HAY MANGAS. Medido en un iPhone de 390 px: los
		   cuatro botones ocupan 516 px, así que 126 px se salían de la pantalla
		   en un flex sin `wrap` ni scroll —simplemente no se podía llegar a la
		   manga derecha—. El interior va `w-max mx-auto`: cuando cabe queda
		   centrado como antes, y cuando no, se desplaza. */
		<div
			className="
        absolute top-25 inset-x-0 z-10
        overflow-x-auto overscroll-x-contain
        [scrollbar-width:none] [&::-webkit-scrollbar]:hidden
      "
		>
			<div className="flex w-max mx-auto gap-3 px-4 py-2">
				{sides.map((side) => {
					// ✔ Usa exactamente el label definido en sideLabels SIN alterar nada
					const label = product.sideLabels?.[side] ?? side;

					return (
						<button
							key={side}
							ref={currentSide === side ? activo : null}
							type="button"
							onClick={() => onChange(side)}
							className={`
              shrink-0 px-7 py-2 text-l rounded-2xl border transition
              ${
								currentSide === side
									? "bg-tinta text-hueso-suave border-tinta"
									: "bg-white text-tinta border-gray-300 hover:bg-gray-100"
							}
            `}
						>
							{label}
						</button>
					);
				})}
			</div>
		</div>
	);
}
