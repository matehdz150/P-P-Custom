"use client";

import Image from "next/image";
import type { EditableShape } from "@/lib/products/types";

/**
 * Previsualización del área imprimible con la geometría REAL del editor.
 *
 * No es un dibujo aproximado: reproduce exactamente lo que hace el canvas de
 * Fabric en `useFabricCanvas` y `useFabricMockup`, para que lo que el
 * proveedor ve aquí sea lo que el cliente va a ver allá.
 *
 *   - el lienzo mide 1445 × 825 fijos
 *   - el mockup entra con `scaleToWidth(700)` y se centra
 *   - las áreas editables usan coordenadas absolutas de ese lienzo
 *
 * Si alguno de esos tres números cambia en el editor, tiene que cambiar aquí.
 */
const LIENZO_W = 1445;
const LIENZO_H = 825;
const MOCKUP_W = 700;

const pct = (n: number, total: number) => `${(n / total) * 100}%`;

/** La caja que ocupa una figura, sea rect, elipse, triángulo o círculo. */
function caja(shape: EditableShape) {
	if (shape.type === "circle") {
		return {
			left: shape.cx - shape.radius,
			top: shape.cy - shape.radius,
			width: shape.radius * 2,
			height: shape.radius * 2,
			redondo: true,
		};
	}
	return {
		left: shape.left,
		top: shape.top,
		width: shape.width,
		height: shape.height,
		redondo: shape.type === "ellipse",
	};
}

export default function Previsualizacion({
	mockupUrl,
	areas,
	anchoCm,
	altoCm,
}: {
	mockupUrl?: string;
	areas: EditableShape[];
	anchoCm?: number;
	altoCm?: number;
}) {
	return (
		<div
			className="relative w-full overflow-hidden rounded-[10px] border border-tinta/14 bg-hueso"
			style={{ aspectRatio: `${LIENZO_W} / ${LIENZO_H}` }}
		>
			{mockupUrl ? (
				// El ancho es el mismo 700 del canvas, en proporción; el alto lo
				// pone la imagen. Centrado, como `scaleToWidth` + centro del lienzo.
				<div
					className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
					style={{ width: pct(MOCKUP_W, LIENZO_W) }}
				>
					<Image
						src={mockupUrl}
						alt=""
						width={MOCKUP_W}
						height={LIENZO_H}
						className="h-auto w-full"
					/>
				</div>
			) : (
				<span className="absolute inset-0 flex items-center justify-center text-[13px] text-tinta/40">
					Esta plantilla no trae mockup de este lado
				</span>
			)}

			{areas.map((a) => {
				const c = caja(a);
				return (
					<div
						key={a.id}
						className={`absolute border-[1.5px] border-dashed border-tinta bg-lima/35 ${
							c.redondo ? "rounded-full" : ""
						}`}
						style={{
							left: pct(c.left, LIENZO_W),
							top: pct(c.top, LIENZO_H),
							width: pct(c.width, LIENZO_W),
							height: pct(c.height, LIENZO_H),
						}}
					/>
				);
			})}

			{areas.length > 0 && anchoCm && altoCm && (
				<span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-md bg-tinta px-2.5 py-1 font-mono text-[11px] text-lima">
					{anchoCm} × {altoCm} cm
				</span>
			)}
		</div>
	);
}
