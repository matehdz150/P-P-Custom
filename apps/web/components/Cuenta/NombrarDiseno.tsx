"use client";

import { useEffect, useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

/**
 * Ponerle nombre a un diseño, guardando o renombrando.
 *
 * POR QUÉ UN DIÁLOGO Y NO UN CAMPO EN LA TARJETA. El campo suelto obligaba a
 * escribir a ciegas en una casilla de 120 px, sin ver bien cuál de las cuatro
 * miniaturas se estaba nombrando, y se cerraba al perder el foco — o sea que
 * un clic en cualquier sitio tiraba lo escrito. Aquí se ve el diseño en grande
 * mientras se le pone nombre, que es exactamente lo que hace falta para
 * elegirlo.
 *
 * ES EL MISMO PARA LAS DOS COSAS. Guardar y renombrar sólo se diferencian en
 * el texto y en a quién se llama; separarlos daría dos cuadros parecidos que
 * se irían distanciando con el tiempo.
 */
export default function NombrarDiseno({
	abierto,
	onAbrir,
	titulo,
	explica,
	valorInicial,
	imagen,
	producto,
	textoBoton,
	onGuardar,
}: {
	abierto: boolean;
	onAbrir: (v: boolean) => void;
	titulo: string;
	explica: string;
	valorInicial: string;
	imagen: string | null;
	producto: string;
	textoBoton: string;
	/** Devuelve el mensaje de error, o null si salió bien. */
	onGuardar: (nombre: string) => Promise<string | null>;
}) {
	const [nombre, setNombre] = useState(valorInicial);
	const [guardando, setGuardando] = useState(false);
	const [fallo, setFallo] = useState<string | null>(null);

	// Al abrirlo se vuelve al valor de partida: si alguien escribió algo, se
	// arrepintió y cerró, no debería encontrárselo la próxima vez.
	useEffect(() => {
		if (abierto) {
			setNombre(valorInicial);
			setFallo(null);
		}
	}, [abierto, valorInicial]);

	async function enviar(e: React.FormEvent) {
		e.preventDefault();

		const limpio = nombre.trim();
		if (!limpio) {
			setFallo("Ponle un nombre para poder encontrarlo.");
			return;
		}

		setGuardando(true);
		const problema = await onGuardar(limpio);
		setGuardando(false);

		// Sólo se cierra si salió bien. Cerrar con un error dentro deja a la
		// persona mirando la rejilla sin saber si se guardó.
		if (problema) setFallo(problema);
		else onAbrir(false);
	}

	return (
		<Dialog open={abierto} onOpenChange={onAbrir}>
			<DialogContent className="gap-0 border-tinta/12 bg-hueso p-0 sm:max-w-[420px]">
				<DialogHeader className="px-6 pt-6">
					<DialogTitle className="font-display text-[20px] font-semibold tracking-[-0.02em] text-tinta">
						{titulo}
					</DialogTitle>
					<DialogDescription className="text-[14px] leading-[21px] text-tinta/65">
						{explica}
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={enviar} className="flex flex-col">
					<div className="flex items-center gap-4 px-6 pt-5">
						<div className="size-[72px] shrink-0 overflow-hidden rounded-xl border border-tinta/12 bg-gris">
							{imagen && (
								// biome-ignore lint/performance/noImgElement: export estático
								<img src={imagen} alt="" className="size-full object-contain" />
							)}
						</div>

						<div className="min-w-0 flex-1">
							<label
								htmlFor="nombre-diseno"
								className="text-[13px] font-medium text-tinta/60"
							>
								Nombre
							</label>
							<input
								id="nombre-diseno"
								value={nombre}
								onChange={(e) => setNombre(e.target.value)}
								placeholder="Logo de la empresa"
								maxLength={60}
								/* El foco va aquí y no en la X de cerrar, que es lo que
								   Radix enfoca por su cuenta al abrir: el diálogo se abrió
								   para escribir un nombre, y es su único campo. */
								autoFocus
								className="mt-1 h-11 w-full rounded-lg border-[1.5px] border-tinta/15 bg-white px-3 text-[15px] text-tinta outline-none placeholder:text-tinta/40 focus:border-tinta focus:shadow-[0_0_0_3px_rgba(174,255,110,0.55)]"
							/>
							<p className="truncate pt-1.5 text-[12px] text-tinta/50">
								{producto}
							</p>
						</div>
					</div>

					{fallo && (
						<p
							role="alert"
							className="mx-6 mt-4 rounded-lg border border-[rgba(192,57,43,0.35)] bg-[rgba(192,57,43,0.07)] px-3 py-2 text-[14px] text-tinta"
						>
							{fallo}
						</p>
					)}

					<DialogFooter className="mt-6 flex-row justify-end gap-2 border-t border-tinta/12 px-6 py-4">
						<button
							type="button"
							onClick={() => onAbrir(false)}
							className="inline-flex h-11 items-center rounded-full px-4 text-[15px] font-medium text-tinta/60 hover:text-tinta"
						>
							Cancelar
						</button>
						<button
							type="submit"
							disabled={guardando}
							className="inline-flex h-11 items-center rounded-full bg-tinta px-5 text-[15px] font-semibold text-lima disabled:opacity-50"
						>
							{guardando ? "Guardando…" : textoBoton}
						</button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
