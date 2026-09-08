"use client";

import { useEffect, useRef, useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import { subirAlCarrito, subirAlEvento } from "@/lib/api/carrito";
import type { DesignerProductTemplate } from "@/lib/api/products";
import { subirArteDePlantilla } from "@/lib/api/cuenta";
import {
	type ArticuloDeCarrito,
	miniaturaPequena,
} from "@/lib/carrito/almacen";
import { useCarrito } from "@/lib/carrito/useCarrito";
import { exportarParaPedido } from "@/lib/designer/exportarParaPedido";
import { guardarDisenoDeEvento } from "@/lib/eventos/borrador";

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
	evento,
	onListo,
	onCancelar,
}: {
	producto: DesignerProductTemplate;
	evento?: {
		codigo: string;
		itemId: string;
		eventoId?: string;
		organizador?: boolean;
		personalizacion?: "libre" | "bloqueada" | "sin_personalizacion";
	};
	onListo: (articulo: ArticuloDeCarrito) => void | Promise<void>;
	onCancelar: () => void;
}) {
	const esDisenoBase = Boolean(evento?.organizador);
	const { sides, colorPrenda, tecnicas, bordados } = useDesigner();
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
			/* La última red antes de cobrar. El panel ya avisa, pero avisar no es
			   impedir: sin esto, un diseño que la máquina no puede coser llegaba al
			   carrito igual y el comprador acababa pagando por él. */
			const pendientes = Object.keys(tecnicas).filter(
				(lado) =>
					tecnicas[lado] === "bordado" &&
					sides[lado]?.canvas &&
					bordados[lado]?.status !== "READY" &&
					bordados[lado]?.status !== "REVIEW",
			);
			if (pendientes.length) {
				const rechazado = pendientes.find(
					(lado) => bordados[lado]?.status === "REJECTED",
				);
				/* «Prepáralo tú» ya no es una instrucción válida: el bordado se
				   prepara solo y no hay botón que pulsar. Decirle eso al comprador
				   sería mandarlo a buscar algo que no existe, así que se distingue
				   entre las tres razones reales por las que puede estar frenado. */
				const enCurso = pendientes.some(
					(lado) =>
						bordados[lado]?.status === "PROCESSING" ||
						bordados[lado]?.status === "QUEUED",
				);
				const vacio = pendientes.filter((lado) => !bordados[lado]);
				throw new Error(
					rechazado
						? (bordados[rechazado]?.mensaje ??
								"Uno de tus bordados no se puede fabricar. Cámbialo para continuar.")
						: enCurso
							? "Estamos preparando tu bordado. Espera unos segundos y vuelve a intentarlo."
							: vacio.length
								? "Agrega un texto o un logo al lado que va bordado."
								: "No pudimos preparar tu bordado. Cambia algo del diseño para intentarlo otra vez.",
				);
			}

			const { archivos, diseno } = await exportarParaPedido(
				sides,
				producto,
				colorPrenda,
			);

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
					/* La prenda REAL con el diseño encima, si el taller subió la
					   foto de ese lado en ese color. Va además de `colocacion`, no
					   en su lugar: aquélla es el mockup y sirve para cuadrar; ésta
					   es lo que el cliente vio. */
					...(a.prenda
						? [{ tipo: "prenda" as const, lado: a.lado, cuerpo: a.prenda }]
						: []),
					/* El arte en trazos, sólo en los lados que se graban. Va ADEMÁS
					   del PNG, no en su lugar: al taller el PNG le sirve para ver de
					   un vistazo qué le pidieron, y el SVG es lo que recorre la
					   máquina. */
					...(a.vector
						? [{ tipo: "vector" as const, lado: a.lado, cuerpo: a.vector }]
						: []),
				]),
				{
					tipo: "diseno" as const,
					cuerpo: new Blob([JSON.stringify(diseno)], {
						type: "application/json",
					}),
				},
			];

			let carritoId: string;
			if (evento?.organizador) {
				const subida = await subirArteDePlantilla(paraSubir);
				carritoId = subida.itemId;
			} else if (evento) {
				const subida = await subirAlEvento(
					evento.codigo,
					evento.itemId,
					paraSubir,
				);
				carritoId = subida.carritoId;
			} else {
				const subida = await subirAlCarrito(paraSubir);
				carritoId = subida.carritoId;
			}

			const articulo: ArticuloDeCarrito = {
				id: crypto.randomUUID(),
				carritoId,
				productoId: producto.id,
				nombre: producto.name ?? "Producto",
				proveedorId: producto.proveedorId ?? "",
				proveedorNombre: producto.proveedorNombre ?? null,
				colorPrenda: colorPrenda?.name ?? null,
				// Sólo los dos estados que permiten comprar. `QUEUED`, `PROCESSING` y
				// `FAILED` no son "bordado listo con reservas": son "todavía no se
				// sabe", y ya los frena el guardia de arriba.
				bordados: Object.entries(bordados).flatMap(([lado, estado]) =>
					estado && (estado.status === "READY" || estado.status === "REVIEW")
						? [
								{
									lado,
									jobId: estado.jobId,
									designHash: estado.designHash,
									status: estado.status,
									incidencias: estado.incidencias,
								},
							]
						: [],
				),
				lados: archivos.map((a) => ({
					lado: a.lado,
					anchoPx: a.anchoPx,
					sangradoCm: a.sangradoCm,
					altoPx: a.altoPx,
					dpi: a.dpi,
				})),
				// Se arranca con una pieza: la cantidad se decide en el carrito,
				// donde se ve el total, y no aquí, que es donde se diseña.
				tallas: [{ size: producto.sizes?.[0]?.size ?? "M", piezas: 1 }],
				precioUnitario: producto.pricing?.basePrice ?? 0,
				miniatura: await miniaturaPequena(archivos[0]?.miniaturaPrenda ?? null),
				agregadoEn: Date.now(),
			};

			if (evento && !evento.organizador) {
				guardarDisenoDeEvento(evento.codigo, evento.itemId, articulo);
			} else if (!evento) {
				agregar(articulo);
			}

			await onListo(articulo);
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
							{esDisenoBase
								? "No pudimos guardar el diseño base"
								: "No se pudo agregar"}
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
							{esDisenoBase
								? "Guardando el diseño base…"
								: "Guardando tu diseño…"}
						</h2>
						<p className="pt-2 text-sm leading-[22px] text-tinta/70">
							{esDisenoBase
								? "Al terminar volverás al evento para seguir configurándolo."
								: "Estamos preparando el archivo de impresión. Tarda unos segundos."}
						</p>
					</>
				)}
			</div>
		</div>
	);
}
