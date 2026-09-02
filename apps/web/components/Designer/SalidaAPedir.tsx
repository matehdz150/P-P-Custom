"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import type { DesignerProductTemplate } from "@/lib/api/products";
import { conDpi } from "@/lib/designer/dpi";
import {
	exportarArteDeLado,
	exportarColocacion,
	exportarMiniaturaDelArte,
} from "@/lib/designer/exportarArte";
import { type ArchivoDeLado, guardarBorrador } from "@/lib/pedido/borrador";

/**
 * La salida del editor.
 *
 * Antes esto era un modal encima del lienzo. Ahora el pedido se captura en su
 * propia pantalla, así que aquí sólo pasa una cosa: se exporta el arte —que
 * sólo existe mientras el lienzo esté montado— se guarda, y se navega.
 *
 * Exportar toma su tiempo con lados grandes a 300 DPI y bloquea el hilo, por
 * eso hay un aviso en pantalla: sin él, la interfaz se queda muda justo
 * después de apretar el botón.
 */
export default function SalidaAPedir({
	producto,
	onCancelar,
}: {
	producto: DesignerProductTemplate;
	onCancelar: () => void;
}) {
	const router = useRouter();
	const { sides, colorPrenda } = useDesigner();
	const [fallo, setFallo] = useState<string | null>(null);

	/** Exportar y navegar pasa UNA vez: en modo estricto el efecto corre dos. */
	const yaCorrio = useRef(false);

	/*
	 * Corre una sola vez al montarse, a propósito. `salir` lee el lienzo tal
	 * como está en ese instante; volver a dispararlo porque cambió una
	 * dependencia exportaría el arte dos veces y navegaría encima de sí mismo.
	 *
	 * NO CANCELES EL TEMPORIZADOR EN LA LIMPIEZA. En modo estricto —que es el
	 * de desarrollo por defecto— React monta, limpia y vuelve a montar. Como
	 * el guardia de arriba impide el segundo arranque, un `clearTimeout` aquí
	 * mata la ÚNICA ejecución programada y la exportación no ocurre nunca: el
	 * aviso "Preparando tu pedido" se queda girando para siempre. Ya pasó.
	 */
	// biome-ignore lint/correctness/useExhaustiveDependencies: ver arriba
	useEffect(() => {
		if (yaCorrio.current) return;
		yaCorrio.current = true;

		// Un tick para que el aviso llegue a pintarse antes de que la
		// exportación —que es síncrona y pesada— congele el hilo.
		setTimeout(() => {
			void salir();
		}, 30);
	}, []);

	async function salir() {
		try {
			// Se aplana a { lado, canvas, areas } en vez de quedarse con las
			// entradas crudas para que `canvas` deje de ser opcional: dentro del
			// bucle ya está comprobado, pero el tipo no lo sabe.
			const conDiseno = Object.entries(sides).flatMap(([lado, estado]) => {
				const canvas = estado.canvas;
				if (!canvas) return [];

				const hayDiseno = canvas
					.getObjects()
					.some((o) => !estado.editableAreas.includes(o));

				return hayDiseno ? [{ lado, canvas, areas: estado.editableAreas }] : [];
			});

			if (conDiseno.length === 0) {
				setFallo("Todavía no has puesto nada en la prenda.");
				return;
			}

			/* Por cada lado salen DOS archivos y una miniatura de cada uno:
			   el arte de producción y la referencia de colocación. Se generan
			   juntos, en el mismo recorrido, para no rendir el lienzo dos veces
			   por lado. */
			const archivos: ArchivoDeLado[] = [];

			for (const { lado, canvas, areas } of conDiseno) {
				const medidas = producto.printSides?.find((s) => s.sideKey === lado);

				const arte = exportarArteDeLado(lado, canvas, areas, {
					widthCm: medidas?.widthCm ?? 28,
					heightCm: medidas?.heightCm ?? 35,
					dpi: medidas?.dpi,
				});

				if (!arte) continue;

				const colocacion = exportarColocacion(canvas, areas);

				archivos.push({
					lado,
					/* Con su resolución escrita dentro. `toDataURL` no la pone, y sin
					   ella el archivo se abre a 72 dpi: 116 cm en vez de 28. */
					arte: await conDpi(arte.blob, arte.dpi),
					colocacion: colocacion?.blob ?? null,
					miniaturaArte: exportarMiniaturaDelArte(canvas, areas),
					miniaturaPrenda: colocacion?.dataUrl ?? null,
					anchoPx: arte.anchoPx,
					altoPx: arte.altoPx,
					dpi: arte.dpi,
				});
			}

			if (archivos.length === 0) {
				setFallo("No encontramos nada dibujado que mandar.");
				return;
			}

			await guardarBorrador({
				productoId: producto.id,
				colorPrenda: colorPrenda?.name ?? null,
				lados: archivos,
				// Sólo los objetos del cliente: las guías las repone el editor.
				diseno: Object.fromEntries(
					conDiseno.map(({ lado, canvas, areas }) => [
						lado,
						canvas
							.getObjects()
							.filter((o) => !areas.includes(o))
							.map((o) => o.toObject()),
					]),
				),
				creadoEn: Date.now(),
			});

			router.push("/pedir");
		} catch (error) {
			setFallo(
				error instanceof Error
					? error.message
					: "No pudimos preparar tu diseño para pedirlo.",
			);
		}
	}

	return (
		<div className="fixed inset-0 z-[80] flex items-center justify-center bg-tinta/50 px-6">
			<div className="w-full max-w-[360px] rounded-2xl bg-hueso p-6 text-center">
				{fallo ? (
					<>
						<p className="font-display text-[17px] font-semibold text-tinta">
							{fallo}
						</p>
						<button
							type="button"
							onClick={onCancelar}
							className="mt-4 h-11 w-full rounded-lg bg-tinta text-[15px] font-semibold text-lima"
						>
							Volver al editor
						</button>
					</>
				) : (
					<>
						<div
							className="mx-auto h-8 w-8 animate-spin rounded-full border-[3px] border-tinta/15 border-t-tinta"
							aria-hidden
						/>
						<p className="pt-4 font-display text-[17px] font-semibold text-tinta">
							Preparando tu pedido
						</p>
						<p className="pt-1 text-sm text-tinta/60">
							Estamos generando los archivos de producción.
						</p>
						{/* Esta pantalla tapa el editor entero. Si algo se atora, sin esto
						    la única salida es recargar y perder el diseño. */}
						<button
							type="button"
							onClick={onCancelar}
							className="mt-5 text-[13px] font-semibold text-tinta/55 underline underline-offset-4"
						>
							Cancelar
						</button>
					</>
				)}
			</div>
		</div>
	);
}
