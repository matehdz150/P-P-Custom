"use client";

import { useEffect, useRef, useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import { subirArteDePlantilla } from "@/lib/api/cuenta";
import type { DesignerProductTemplate } from "@/lib/api/products";
import { miniaturaPequena } from "@/lib/carrito/almacen";
import { exportarParaPedido } from "@/lib/designer/exportarParaPedido";
import { guardarEnBorrador } from "@/lib/plantillas/borrador";

/**
 * Guarda lo diseñado en la plantilla que se está armando.
 *
 * ES EL GEMELO DE `AgregarAlCarrito`, con otro destino: el arte sube a
 * `medios/plantillas/`, que no caduca, en vez de a `carritos/`, que se limpia
 * a los 30 días. Esa es toda la diferencia, y es la que permite que una
 * plantilla siga sirviendo dentro de un año.
 *
 * NO GUARDA LA PLANTILLA EN EL SERVIDOR. Deja el ítem en el borrador local y
 * devuelve a quien la está armando: la plantilla se guarda entera cuando la
 * persona termina, no producto a producto. Así se puede abandonar a medias sin
 * dejar plantillas de un solo ítem por ahí.
 */
export default function AgregarAPlantilla({
	producto,
	clave,
	onListo,
	onCancelar,
}: {
	producto: DesignerProductTemplate;
	/** A qué fila del borrador vuelve. Nula: se añade una nueva. */
	clave: string | null;
	onListo: () => void;
	onCancelar: () => void;
}) {
	const { sides, colorPrenda } = useDesigner();
	const [fallo, setFallo] = useState<string | null>(null);
	const yaCorrio = useRef(false);

	// biome-ignore lint/correctness/useExhaustiveDependencies: corre una sola vez, a propósito
	useEffect(() => {
		if (yaCorrio.current) return;
		yaCorrio.current = true;

		// NO cancelar este temporizador en la limpieza: con el guardia de arriba,
		// hacerlo mata la única ejecución y el aviso se queda girando. Ya pasó
		// con el carrito, y es el mismo patrón.
		setTimeout(() => {
			void guardar();
		}, 30);
	}, []);

	async function guardar() {
		try {
			const { archivos, diseno } = await exportarParaPedido(
				sides,
				producto,
				colorPrenda,
			);

			const { itemId } = await subirArteDePlantilla([
				...archivos.flatMap((a) => [
					{ tipo: "arte" as const, lado: a.lado, cuerpo: a.arte },
					...(a.colocacion
						? [
								{
									tipo: "colocacion" as const,
									lado: a.lado,
									cuerpo: a.colocacion,
								},
							]
						: []),
					/* La prenda REAL con el diseño encima, si el taller subió la
					   foto de ese lado en ese color. Va además de `colocacion`, no
					   en su lugar: aquélla es el mockup y sirve para cuadrar; ésta
					   es lo que el cliente vio. */
					...(a.prenda
						? [{ tipo: "prenda" as const, lado: a.lado, cuerpo: a.prenda }]
						: []),
				]),
				{
					tipo: "diseno" as const,
					cuerpo: new Blob([JSON.stringify(diseno)], {
						type: "application/json",
					}),
				},
			]);

			guardarEnBorrador(clave, {
				productoId: producto.id,
				nombre: producto.name ?? "Producto",
				colorPrenda: colorPrenda?.name ?? null,
				origen: null,
				itemId,
				lados: archivos.map((a) => ({
					lado: a.lado,
					anchoPx: a.anchoPx,
					sangradoCm: a.sangradoCm,
					altoPx: a.altoPx,
					dpi: a.dpi,
				})),
				// Una pieza de arranque, y sólo si la fila es nueva: al editar una
				// que ya estaba, `guardarEnBorrador` conserva sus tallas. Las
				// cantidades se deciden en la plantilla, donde se ve el conjunto.
				tallas: [{ size: producto.sizes?.[0]?.size ?? "M", piezas: 1 }],
				miniatura: await miniaturaPequena(archivos[0]?.miniaturaPrenda ?? null),
			});

			onListo();
		} catch (error) {
			setFallo(
				error instanceof Error
					? error.message
					: "No pudimos guardar tu diseño en la plantilla.",
			);
		}
	}

	return (
		<div className="fixed inset-0 z-[80] flex items-center justify-center bg-tinta/50 px-6">
			<div className="flex w-full max-w-[420px] flex-col items-center gap-3 rounded-2xl bg-white px-7 py-9 text-center">
				{fallo ? (
					<>
						<p className="font-display text-[19px] font-semibold text-tinta">
							No se pudo guardar
						</p>
						<p className="text-[15px] leading-[24px] text-tinta/65">{fallo}</p>
						<button
							type="button"
							onClick={onCancelar}
							className="mt-3 inline-flex h-11 items-center rounded-full bg-tinta px-5 text-[15px] font-semibold text-lima"
						>
							Volver al editor
						</button>
					</>
				) : (
					<>
						<div
							className="size-8 animate-spin rounded-full border-[3px] border-tinta/15 border-t-tinta"
							aria-hidden
						/>
						<p
							aria-live="polite"
							className="font-display pt-1 text-[19px] font-semibold text-tinta"
						>
							Guardando en tu plantilla
						</p>
						<p className="text-[15px] leading-[24px] text-tinta/65">
							Estamos subiendo los archivos de producción. Tarda unos segundos.
						</p>
					</>
				)}
			</div>
		</div>
	);
}
