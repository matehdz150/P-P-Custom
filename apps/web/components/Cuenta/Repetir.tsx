"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
	armarRepeticion,
	ErrorCuenta,
	type LineaRepetida,
	type PedidoRepetido,
	repetirPedido,
} from "@/lib/api/cuenta";
import { useCarrito } from "@/lib/carrito/useCarrito";
import { fecha, pesos } from "./Pedidos";
import { Aviso, Cargando } from "./piezas";

/**
 * Volver a pedir lo mismo del mes pasado.
 *
 * POR QUÉ NO ES UN BOTÓN Y YA. La línea de un pedido CONGELA su precio, sus
 * medidas y su plazo; el catálogo es de hoy. Entre un mes y otro sube un
 * precio, se archiva un producto o se acaban los blancos. Copiar en silencio y
 * cobrar otra cifra es como se pierde a la empresa que pide cada mes: no por
 * el dinero, por la sorpresa.
 *
 * Así que esto enseña la diferencia ANTES de cobrar nada, deja elegir qué
 * líneas van y sólo entonces las mete al carrito. Lo que no cambió no pide
 * atención; lo que cambió, sí.
 *
 * NO CREA EL PEDIDO. Acaba en el carrito, y de ahí sale por el checkout de
 * siempre, con sus precios recalculados desde la tabla.
 */

const ETIQUETAS = {
	igual: { texto: "Igual", tono: "gris" },
	precio: { texto: "Cambió el precio", tono: "lavanda" },
	plazo: { texto: "Cambió el plazo", tono: "lavanda" },
	no_disponible: { texto: "Ya no se puede", tono: "rojo" },
} as const;

export default function Repetir() {
	const params = useSearchParams();
	const router = useRouter();
	const id = params.get("id") ?? "";

	const { agregarVarios } = useCarrito();

	const [datos, setDatos] = useState<PedidoRepetido | null>(null);
	const [fallo, setFallo] = useState<string | null>(null);
	const [fuera, setFuera] = useState<Set<string>>(new Set());
	const [mandando, setMandando] = useState(false);

	useEffect(() => {
		if (!id) {
			setFallo("Falta decir qué pedido quieres repetir.");
			return;
		}

		repetirPedido(id)
			.then(setDatos)
			.catch((error) =>
				setFallo(
					error instanceof ErrorCuenta && error.hayQueEntrar
						? "Tu sesión caducó. Vuelve a entrar."
						: "No pudimos preparar esa repetición.",
				),
			);
	}, [id]);

	if (fallo) {
		return (
			<div className="flex flex-col gap-4">
				<Aviso texto={fallo} />
				<Link
					href="/cuenta?s=pedidos"
					className="inline-flex h-11 w-fit items-center rounded-full border-[1.5px] border-tinta px-5 text-[15px] font-semibold text-tinta"
				>
					Volver a mis pedidos
				</Link>
			</div>
		);
	}

	if (!datos) return <Cargando />;

	/* Lo no disponible no se puede elegir, así que no cuenta para nada: ni
	   entra en el total, ni en el botón, ni se le puede quitar la palomita. */
	const elegibles = datos.lineas.filter((l) => l.estado !== "no_disponible");
	const elegidas = elegibles.filter((l) => !fuera.has(l.lineaId));

	const total = elegidas.reduce((n, l) => n + l.importe, 0);
	const antes = elegidas.reduce((n, l) => n + l.importeAntes, 0);
	const diferencia = total - antes;

	const talleres = new Set(elegidas.map((l) => l.proveedorId).filter(Boolean));

	function alternar(lineaId: string) {
		setFuera((antes) => {
			const siguiente = new Set(antes);
			if (siguiente.has(lineaId)) siguiente.delete(lineaId);
			else siguiente.add(lineaId);
			return siguiente;
		});
	}

	async function alCarrito() {
		setMandando(true);
		setFallo(null);

		try {
			const { articulos, descartadas } = await armarRepeticion(
				id,
				elegidas.map((l) => l.lineaId),
			);

			agregarVarios(
				articulos.map((a) => ({
					...a,
					proveedorNombre: a.proveedorNombre ?? null,
					// El id y la hora los pone el navegador: identifican la línea
					// DENTRO de este carrito y no significan nada en el servidor.
					id: crypto.randomUUID(),
					agregadoEn: Date.now(),
				})),
			);

			if (descartadas.length > 0) {
				// Se avisa y NO se navega: si algo se cayó entre que se miró la
				// pantalla y se pulsó, enterarse ya dentro del carrito es tarde.
				setFallo(
					`Metimos ${articulos.length} al carrito. Se quedaron fuera: ${descartadas
						.map((d) => d.producto)
						.join(", ")}.`,
				);
				setMandando(false);
				return;
			}

			router.push("/carrito");
		} catch (error) {
			setFallo(
				error instanceof Error
					? error.message
					: "No pudimos armar tu repetición.",
			);
			setMandando(false);
		}
	}

	const piezas = elegidas.reduce((n, l) => n + l.piezas, 0);

	return (
		<div className="max-w-[1180px]">
			{/* La cabecera lleva el resumen DENTRO.
			    Antes el total vivía en una barra pegada abajo, que se comía la
			    última tarjeta justo cuando había que decidir. Aquí la decisión y
			    su consecuencia se leen de un golpe. */}
			<section className="flex flex-col gap-6 rounded-2xl bg-tinta px-6 py-6 md:px-8 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
				<div className="min-w-0">
					<p className="text-[13px] text-hueso-suave/55">
						Del pedido #{datos.folio ?? "—"}
						{datos.hechoEn ? ` · ${fecha(datos.hechoEn)}` : ""}
					</p>

					<h2 className="pt-2 font-display text-[28px] font-semibold leading-9 tracking-[-0.035em] text-hueso md:text-[32px]">
						Elige qué quieres repetir
					</h2>
					<p className="max-w-[52ch] pt-1.5 text-[14px] leading-[23px] text-hueso-suave/65">
						Lo mismo, con los precios de hoy. Quita lo que no quieras — todavía
						no se cobra nada.
					</p>
				</div>

				<div className="flex shrink-0 items-center justify-between gap-6 lg:justify-end">
					<div className="lg:text-right">
						<p className="text-[12px] text-hueso-suave/55">
							{elegidas.length} {elegidas.length === 1 ? "diseño" : "diseños"} ·{" "}
							{piezas} {piezas === 1 ? "pieza" : "piezas"}
						</p>
						<p className="pt-0.5 font-display text-[30px] font-semibold leading-tight tracking-[-0.035em] tabular-nums text-lima md:text-[34px]">
							{pesos(total)}
						</p>
						{diferencia !== 0 && (
							<p
								className={`pt-0.5 text-[12px] tabular-nums ${
									diferencia > 0 ? "text-lavanda" : "text-lima/70"
								}`}
							>
								{diferencia > 0 ? "+" : "−"}
								{pesos(Math.abs(diferencia))} vs. entonces
							</p>
						)}
					</div>

					<button
						type="button"
						onClick={alCarrito}
						disabled={mandando || elegidas.length === 0}
						className="inline-flex h-[52px] shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-lima px-7 text-[15px] font-semibold text-tinta disabled:opacity-40"
					>
						{mandando ? "Preparando…" : "Pasar al carrito"}
					</button>
				</div>
			</section>

			<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pb-3.5 pt-7">
				<h3 className="font-display text-[19px] font-semibold tracking-[-0.02em] text-tinta">
					Qué se lleva
				</h3>
				<span className="text-[13px] text-tinta/55">
					{talleres.size > 1 && (
						// Se dice ANTES de pagar, no después: una compra con dos
						// talleres se parte en dos pedidos que llegan por separado, y
						// eso sorprende a quien esperaba una caja.
						<>
							{talleres.size} talleres, o sea {talleres.size} entregas ·{" "}
						</>
					)}
					el envío se cotiza al pagar
				</span>
			</div>

			{/* Rejilla, no lista: con la miniatura grande cada diseño se
			    reconoce sin leer, que es lo que se viene a hacer aquí. */}
			<ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
				{datos.lineas.map((linea) => (
					<li key={linea.lineaId}>
						<Tarjeta
							linea={linea}
							elegida={!fuera.has(linea.lineaId)}
							onAlternar={() => alternar(linea.lineaId)}
						/>
					</li>
				))}
			</ul>

			{fallo && (
				<div className="pt-5">
					<Aviso texto={fallo} />
				</div>
			)}

			<p className="pt-5 text-[13px] text-tinta/50">
				Los precios y plazos son los de hoy; se vuelven a comprobar al pasar al
				carrito.
			</p>
		</div>
	);
}

/**
 * Un diseño de la repetición, como tarjeta.
 *
 * Era una fila con la miniatura de 56 px y todo el detalle en texto corrido.
 * Aquí la prenda se ve —que es lo que alguien reconoce como suyo— y lo que
 * cambió va en una franja de color arriba, legible sin leer.
 *
 * La franja usa el tono de la marca, no rojo de alarma: que el taller
 * archivara un producto no es un error de quien compra, y el rojo compite con
 * lo que sí hay que mirar.
 */
function Tarjeta({
	linea,
	elegida,
	onAlternar,
}: {
	linea: LineaRepetida;
	elegida: boolean;
	onAlternar: () => void;
}) {
	const caida = linea.estado === "no_disponible";
	const etiqueta = ETIQUETAS[linea.estado];

	const tallas = linea.tallas
		.filter((t) => t.piezas > 0)
		.map((t) => `${t.size}×${t.piezas}`)
		.join("  ");

	const franja = caida
		? "bg-tinta/8 text-tinta/60"
		: linea.estado === "igual"
			? "bg-gris text-tinta/60"
			: "bg-lavanda text-tinta";

	return (
		<article
			className={`flex h-full flex-col overflow-hidden rounded-2xl border transition-opacity ${
				caida
					? "border-tinta/10 bg-gris"
					: elegida
						? "border-tinta/12 bg-white"
						: "border-tinta/12 bg-white opacity-45"
			}`}
		>
			<div
				className={`flex items-center justify-between gap-3 px-4 py-2.5 ${franja}`}
			>
				<span className="truncate text-[12px] font-semibold">
					{etiqueta.texto}
				</span>

				{/* Sin casilla cuando no se puede pedir: un control desactivado
				    invita a pelearse con él para entender por qué. */}
				{!caida && (
					<Checkbox
						checked={elegida}
						onCheckedChange={onAlternar}
						aria-label={`Incluir ${linea.producto}`}
						className="size-[19px] shrink-0 border-tinta/30 data-[state=checked]:border-tinta data-[state=checked]:bg-tinta data-[state=checked]:text-lima"
					/>
				)}
			</div>

			<div
				className={`flex h-[184px] items-center justify-center border-b border-tinta/8 bg-hueso ${
					caida ? "opacity-40" : ""
				}`}
			>
				<Miniatura src={linea.miniatura} />
			</div>

			<div className="flex flex-1 flex-col gap-1 p-4">
				<span className="font-display text-[16px] font-semibold text-tinta">
					{linea.producto}
				</span>

				{caida ? (
					<span className="text-[13px] leading-[20px] text-tinta/55">
						{linea.porque ?? "El taller lo quitó del catálogo"}
					</span>
				) : (
					<>
						<span className="text-[13px] text-tinta/60">
							{linea.colorPrenda ? `${linea.colorPrenda} · ` : ""}
							{linea.lados.length} {linea.lados.length === 1 ? "lado" : "lados"}{" "}
							· {linea.piezas} {linea.piezas === 1 ? "pieza" : "piezas"}
						</span>

						{tallas && (
							<span className="font-mono text-[12px] text-tinta/55">
								{tallas}
							</span>
						)}

						{/* El plazo sólo cuando cambió: repetir "sigue igual" en cada
						    tarjeta entrena a la gente a no leer nada. */}
						{linea.estado === "plazo" && linea.dias !== null && (
							<span className="text-[13px] text-tinta/70">
								Ahora tarda {linea.dias} {linea.dias === 1 ? "día" : "días"}
								{linea.diasAntes !== null && ` (antes ${linea.diasAntes})`}
							</span>
						)}

						<div className="mt-auto flex items-baseline justify-between gap-3 border-t border-tinta/10 pt-3">
							<span className="text-[13px] text-tinta/55">
								{linea.estado === "precio" &&
								linea.unitario !== undefined &&
								linea.unitarioAntes !== undefined ? (
									<>
										<span className="text-tinta/40 line-through">
											{pesos(linea.unitarioAntes)}
										</span>{" "}
										→{" "}
										<span className="font-semibold text-tinta">
											{pesos(linea.unitario)}
										</span>{" "}
										c/u
									</>
								) : linea.unitario !== undefined ? (
									`${pesos(linea.unitario)} c/u`
								) : (
									""
								)}
							</span>
							<span className="font-display text-[19px] font-semibold tabular-nums text-tinta">
								{pesos(linea.importe)}
							</span>
						</div>
					</>
				)}
			</div>
		</article>
	);
}

function Miniatura({ src }: { src: string | null }) {
	if (!src) return <div className="size-24 rounded-xl bg-gris" />;

	return (
		// biome-ignore lint/performance/noImgElement: export estático
		<img
			src={src}
			alt=""
			className="max-h-[152px] max-w-[70%] object-contain"
			loading="lazy"
		/>
	);
}
