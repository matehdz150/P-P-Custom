"use client";

import { useDesigner } from "@/Contexts/DesignerContext";

/**
 * Los colores en que se puede pedir la prenda. Al elegir uno se tiñe el
 * mockup del canvas — no es una etiqueta, cambia lo que se ve.
 */
export default function SelectorColorPrenda({
	className,
	tamano = 40,
}: {
	className?: string;
	tamano?: number;
}) {
	const { colores, colorPrenda, setColorPrenda } = useDesigner();

	if (colores.length === 0) return null;

	return (
		<div className={`flex flex-wrap items-center gap-3 ${className ?? ""}`}>
			{colores.map((c) => {
				const activo = colorPrenda?.hex === c.hex;
				return (
					<button
						key={c.hex + c.name}
						type="button"
						onClick={() => setColorPrenda(c)}
						title={c.name}
						aria-label={c.name}
						aria-pressed={activo}
						style={{ backgroundColor: c.hex, width: tamano, height: tamano }}
						className={`rounded-full border border-gray-300 ${
							activo ? "ring-2 ring-tinta ring-offset-2" : ""
						}`}
					/>
				);
			})}

			{colorPrenda && (
				<span className="text-sm text-tinta">{colorPrenda.name}</span>
			)}
		</div>
	);
}
