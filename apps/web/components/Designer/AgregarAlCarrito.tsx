"use client";

import { useEffect, useRef, useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import { subirAlCarrito } from "@/lib/api/carrito";
import type { DesignerProductTemplate } from "@/lib/api/products";
import { miniaturaPequena } from "@/lib/carrito/almacen";
import { useCarrito } from "@/lib/carrito/useCarrito";
import { exportarParaPedido } from "@/lib/designer/exportarParaPedido";

/**
 * Agregar el diseño al carrito.
 *
 * A diferencia de "pedir ahora", aquí el arte SE SUBE en este momento: el
 * carrito guarda rutas, no archivos, porque un PNG de producción son varios MB
 * y el navegador no aguanta tres. Lo subido caduca a los 30 días si nadie
 * compra, y al pedir la API lo saca de ese prefijo.
 *
 * Exportar bloquea el hilo mientras rinde, así que primero se pinta el aviso.
 */
export default function AgregarAlCarrito({
	producto,
	onListo,
	onCancelar,
}: {
	producto: DesignerProductTemplate;
	onListo: () => void;
	onCancelar: () => void;
}) {
	const { sides, colorPrenda } = useDesigner();
	const { agregar } = useCarrito();
	const [fallo, setFallo] = useState<string | null>(null);

	/** Igual que en la salida a pedir: en modo estricto el efecto corre dos veces. */
	const yaCorrio = useRef(false);

	// biome-ignore lint/correctness/useExhaustiveDependencies: corre una sola vez, a propósito
	useEffect(() => {
		if (yaCorrio.current) return;
		yaCorrio.current = true;

		// NO cancelar este temporizador en la limpieza: con el guardia de arriba,
		// hacerlo mata la única ejecución y el aviso se queda girando. Ya pasó.
		setTimeout(() => {
			void guardar();
		}, 30);
	}, []);

	async function guardar() {
		try {
			const { archivos, diseno } = await exportarParaPedido(sides, producto);

			// Un archivo por lado más el diseño editable, que va como JSON.
			const paraSubir = [
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
				]),
				{
					tipo: "diseno" as const,
					cuerpo: new Blob([JSON.stringify(diseno)], {
						type: "application/json",
					}),
				},
			];

			const { carritoId } = await subirAlCarrito(paraSubir);

			agregar({
				id: crypto.randomUUID(),
				carritoId,
				productoId: producto.id,
				nombre: producto.name ?? "Producto",
				proveedorId: producto.proveedorId ?? "",
				proveedorNombre: producto.proveedorNombre ?? null,
				colorPrenda: colorPrenda?.name ?? null,
				lados: archivos.map((a) => ({
					lado: a.lado,
					anchoPx: a.anchoPx,
					altoPx: a.altoPx,
					dpi: a.dpi,
				})),
				// Se arranca con una pieza: la cantidad se decide en el carrito,
				// donde se ve el total, y no aquí, que es donde se diseña.
				tallas: [{ size: producto.sizes?.[0]?.size ?? "M", piezas: 1 }],
				precioUnitario: producto.pricing?.basePrice ?? 0,
				miniatura: await miniaturaPequena(archivos[0]?.miniaturaPrenda ?? null),
				agregadoEn: Date.now(),
			});

			onListo();
		} catch (error) {
			setFallo(
				error instanceof Error
					? error.message
					: "No pudimos agregar tu diseño al carrito.",
			);
		}
	}

	return (
		<div className="fixed inset-0 z-[80] flex items-center justify-center bg-tinta/50 px-6">
			<div className="w-full max-w-[420px] rounded-2xl bg-hueso p-7 text-center">
				{fallo ? (
					<>
						<h2 className="font-display text-[20px] font-semibold text-tinta">
							No se pudo agregar
						</h2>
						<p className="pt-2 text-sm leading-[22px] text-tinta/70">{fallo}</p>
						<button
							type="button"
							onClick={onCancelar}
							className="mt-5 h-11 w-full rounded-lg border-[1.5px] border-tinta text-[15px] font-semibold text-tinta"
						>
							Volver al editor
						</button>
					</>
				) : (
					<>
						<h2 className="font-display text-[20px] font-semibold text-tinta">
							Guardando tu diseño…
						</h2>
						<p className="pt-2 text-sm leading-[22px] text-tinta/70">
							Estamos preparando el archivo de impresión. Tarda unos segundos.
						</p>
					</>
				)}
			</div>
		</div>
	);
}
