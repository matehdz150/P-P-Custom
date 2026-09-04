"use client";

import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

/**
 * Confirmar antes de borrar un diseño.
 *
 * POR QUÉ EXISTE. Antes el bote de basura borraba en el primer clic, sin
 * preguntar y sin deshacer: el diseño se va de S3 y no vuelve. En una rejilla
 * donde ese botón mide 36 px y está pegado a "Volver a pedir", un dedo torcido
 * en el teléfono costaba un diseño que alguien tardó media hora en hacer.
 *
 * SE ENSEÑA LA MINIATURA, no sólo el nombre. Los nombres de los diseños se
 * parecen entre sí —"Logo v2", "Logo final"— y la imagen es lo que de verdad
 * distingue cuál se está a punto de perder.
 *
 * NO ES UN `confirm()` DEL NAVEGADOR: ése no puede enseñar la imagen, no se
 * puede estilar y en móvil sale como un aviso del sistema, que se lee como un
 * error de la página y no como una decisión que uno está tomando.
 */
export default function ConfirmarBorrado({
	abierto,
	onAbrir,
	nombre,
	producto,
	imagen,
	onConfirmar,
}: {
	abierto: boolean;
	onAbrir: (abierto: boolean) => void;
	nombre: string;
	producto: string;
	imagen: string | null;
	/** Devuelve el mensaje si falló, o `null` si salió bien. */
	onConfirmar: () => Promise<string | null>;
}) {
	const [borrando, setBorrando] = useState(false);
	const [fallo, setFallo] = useState<string | null>(null);

	async function confirmar() {
		setBorrando(true);
		setFallo(null);

		const problema = await onConfirmar();

		if (problema) {
			// Se queda abierto con el error dentro: cerrarlo dejaría a alguien
			// creyendo que se borró cuando el diseño sigue ahí.
			setFallo(problema);
			setBorrando(false);
			return;
		}

		setBorrando(false);
		onAbrir(false);
	}

	return (
		<Dialog
			open={abierto}
			onOpenChange={(v) => {
				// Mientras borra no se cierra: el cuadro es lo único que dice que
				// hay algo en curso.
				if (!borrando) onAbrir(v);
			}}
		>
			<DialogContent className="sm:max-w-[420px]">
				<DialogHeader>
					<DialogTitle>¿Quitar este diseño?</DialogTitle>
					<DialogDescription>
						Se borra de tus diseños guardados y no se puede deshacer. Los
						pedidos que ya hiciste con él no cambian.
					</DialogDescription>
				</DialogHeader>

				<div className="flex items-center gap-3.5 rounded-xl bg-gris p-3">
					<div className="size-16 shrink-0 overflow-hidden rounded-lg bg-white">
						{imagen && (
							// biome-ignore lint/performance/noImgElement: export estático
							<img
								src={imagen}
								alt=""
								className="size-full object-contain p-1"
							/>
						)}
					</div>
					<div className="min-w-0">
						<p className="truncate text-[15px] font-semibold text-tinta">
							{nombre}
						</p>
						<p className="truncate text-[13px] text-tinta/55">{producto}</p>
					</div>
				</div>

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
						onClick={() => onAbrir(false)}
						disabled={borrando}
						className="inline-flex h-11 items-center justify-center rounded-full px-4 text-[14px] font-semibold text-tinta/65 hover:text-tinta disabled:cursor-not-allowed disabled:opacity-50"
					>
						Cancelar
					</button>
					<button
						type="button"
						onClick={confirmar}
						disabled={borrando}
						aria-busy={borrando}
						className="inline-flex h-11 items-center justify-center rounded-full bg-[#c0392b] px-5 text-[14px] font-semibold text-white transition-colors hover:bg-[#a63125] disabled:cursor-not-allowed disabled:opacity-60"
					>
						{borrando ? "Quitando…" : "Sí, quitarlo"}
					</button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
