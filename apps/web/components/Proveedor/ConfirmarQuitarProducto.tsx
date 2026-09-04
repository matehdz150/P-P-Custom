"use client";

import Image from "next/image";
import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { ProductoDeTaller } from "@/lib/api/proveedores";

/**
 * Confirmar antes de quitar un producto del taller.
 *
 * DICE CUÁL DE LAS DOS COSAS VA A PASAR, y ésa es la razón de que exista en
 * vez de un cuadro genérico. Un borrador se borra y no vuelve; uno que ya se
 * publicó se archiva, porque los pedidos que lo mencionan siguen necesitando
 * saber su nombre. Las dos salen del mismo botón, y quien lo pulsa tiene
 * derecho a saber en cuál está antes de confirmar.
 *
 * SE ENSEÑA LA FOTO Y EL SKU. Un taller tiene ocho playeras negras que se
 * llaman casi igual —"Playera negra", "Playera negra 180g"— y el nombre solo
 * no distingue cuál se está a punto de quitar. El SKU es el que usan ellos
 * para pedir el blanco, así que es el identificador que reconocen.
 *
 * NO ES UN `confirm()` DEL NAVEGADOR: no puede enseñar la foto, no se puede
 * estilar, y en el móvil sale como un aviso del sistema —se lee como un error
 * de la página y no como una decisión que uno está tomando.
 */
export default function ConfirmarQuitarProducto({
	producto,
	onCerrar,
	onConfirmar,
}: {
	/** `null` con el cuadro cerrado: así no hay que sincronizar dos estados. */
	producto: ProductoDeTaller | null;
	onCerrar: () => void;
	/** Devuelve el mensaje si falló, o `null` si salió bien. */
	onConfirmar: (producto: ProductoDeTaller) => Promise<string | null>;
}) {
	const [quitando, setQuitando] = useState(false);
	const [fallo, setFallo] = useState<string | null>(null);

	/* Lo mismo que decide el servidor, y por las mismas razones. Aquí es sólo
	   para redactar el aviso: si el estado que tenemos estuviera viejo, manda
	   lo que conteste la API. */
	const seBorra = producto?.estado === "borrador";

	async function confirmar() {
		if (!producto) return;

		setQuitando(true);
		setFallo(null);

		const problema = await onConfirmar(producto);

		if (problema) {
			// Se queda abierto con el error dentro: cerrarlo dejaría a alguien
			// creyendo que se quitó cuando el producto sigue publicado.
			setFallo(problema);
			setQuitando(false);
			return;
		}

		setQuitando(false);
		onCerrar();
	}

	return (
		<Dialog
			open={!!producto}
			onOpenChange={(abierto) => {
				// Mientras trabaja no se cierra: el cuadro es lo único que dice que
				// hay algo en curso.
				if (!abierto && !quitando) {
					setFallo(null);
					onCerrar();
				}
			}}
		>
			<DialogContent className="sm:max-w-[440px]">
				<DialogHeader>
					<DialogTitle>
						{seBorra ? "¿Borrar este borrador?" : "¿Quitar este producto?"}
					</DialogTitle>
					<DialogDescription>
						{seBorra
							? "Nunca llegó al catálogo, así que se borra y no se puede recuperar."
							: "Sale del catálogo y deja de aparecer en tu lista. Los pedidos que ya tienes con él siguen igual, y sus existencias se quedan guardadas."}
					</DialogDescription>
				</DialogHeader>

				<div className="flex items-center gap-3.5 rounded-xl bg-gris p-3">
					<div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
						{producto?.images?.[0]?.url ? (
							<Image
								src={producto.images[0].url}
								alt=""
								width={80}
								height={100}
								className="max-h-[84%] w-auto max-w-[74%] object-contain"
							/>
						) : null}
					</div>

					<div className="min-w-0">
						<p className="truncate text-[15px] font-semibold text-tinta">
							{producto?.name}
						</p>
						<p className="font-mono truncate text-[13px] text-tinta/55">
							{producto?.sku || producto?.slug}
						</p>
					</div>
				</div>

				{/* Sólo para lo que se archiva: al borrador no se vuelve, así que
				    prometerle una vuelta sería mentira. */}
				{!seBorra && (
					<p className="text-[13px] leading-[20px] text-tinta/60">
						Si te arrepientes, ábrelo desde “Ver archivados” y mándalo otra vez
						a revisión.
					</p>
				)}

				{fallo && (
					<p
						role="alert"
						className="rounded-xl border border-[rgba(192,57,43,0.35)] bg-[rgba(192,57,43,0.07)] px-3.5 py-2.5 text-[13px] text-tinta"
					>
						{fallo}
					</p>
				)}

				<DialogFooter>
					<button
						type="button"
						onClick={onCerrar}
						disabled={quitando}
						className="inline-flex h-11 items-center justify-center rounded-lg px-4 text-[14px] font-semibold text-tinta/65 hover:text-tinta disabled:cursor-not-allowed disabled:opacity-50"
					>
						Cancelar
					</button>
					<button
						type="button"
						onClick={confirmar}
						disabled={quitando}
						aria-busy={quitando}
						className="inline-flex h-11 items-center justify-center rounded-lg bg-[#c0392b] px-5 text-[14px] font-semibold text-white transition-colors hover:bg-[#a63125] disabled:cursor-not-allowed disabled:opacity-60"
					>
						{quitando ? "Quitando…" : seBorra ? "Sí, borrarlo" : "Sí, quitarlo"}
					</button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
