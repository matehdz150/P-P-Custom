"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import type { DesignerProductTemplate } from "@/lib/api/products";
import { exportarParaPedido } from "@/lib/designer/exportarParaPedido";
import { guardarBorrador } from "@/lib/pedido/borrador";

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
			// La exportación vive en lib/designer: la comparten esta pantalla y
			// "agregar al carrito", y es la parte del editor que menos conviene
			// tener duplicada.
			const { archivos, diseno } = await exportarParaPedido(
				sides,
				producto,
				colorPrenda,
			);

			await guardarBorrador({
				productoId: producto.id,
				colorPrenda: colorPrenda?.name ?? null,
				lados: archivos,
				// Sólo los objetos del cliente: las guías las repone el editor.
				diseno,
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
