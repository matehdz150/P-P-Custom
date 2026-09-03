"use client";

import Link from "next/link";
import type { PedidoEnSeguimiento } from "@/lib/api/pedir";

/**
 * El detalle de un pedido, tal como lo ve quien lo compró.
 *
 * VIVE APARTE PORQUE LO PINTAN DOS SITIOS: la página pública `/pedido`, a la
 * que se llega con el token del correo sin tener cuenta, y el panel, donde se
 * abre sin salir del dashboard. Es la MISMA pantalla, y tenerla dos veces
 * garantizaba que un arreglo cayera sólo en una — normalmente en la que se
 * mira, y no en la que le llega al cliente por correo.
 *
 * No trae `<main>` ni cabecera: quien lo usa decide el envoltorio, que es
 * justo lo único que de verdad cambia entre los dos sitios.
 */

export const PASOS = [
	{
		estado: "nuevo",
		etiqueta: "Recibido",
		explica: "El taller ya lo tiene y va a confirmarte precio y fecha.",
	},
	{
		estado: "produccion",
		etiqueta: "En producción",
		explica: "Lo están fabricando ahora mismo.",
	},
	{
		estado: "listo",
		etiqueta: "Listo",
		explica: "Terminado y listo para salir.",
	},
	{
		estado: "enviado",
		etiqueta: "En camino",
		explica: "Va con la paquetería. Abajo tienes el número para rastrearlo.",
	},
	{ estado: "entregado", etiqueta: "Entregado", explica: "Se entregó." },
];

/**
 * Los pasos que se enseñan, según cómo se entrega.
 *
 * Quien recoge en el taller no pasa por "En camino": enseñarle un paso que
 * nunca se va a marcar deja la barra a medias para siempre y da la impresión
 * de que algo se atoró.
 */
export function pasosDe(metodo: string | undefined) {
	return metodo === "recoger"
		? PASOS.filter((p) => p.estado !== "enviado")
		: PASOS;
}

const pesos = (n: number) =>
	new Intl.NumberFormat("es-MX", {
		style: "currency",
		currency: "MXN",
		maximumFractionDigits: 0,
	}).format(n);

export default function DetalleDePedido({
	pedido,
	conCuenta,
	accionTrasTotal,
}: {
	pedido: PedidoEnSeguimiento;
	/** Con cuenta no se ofrece guardar el enlace: ya hay dónde volver. */
	conCuenta: boolean;
	accionTrasTotal?: React.ReactNode;
}) {
	const cancelado = pedido.estado === "cancelado";
	const entrega = pedido.entrega;
	const pasos = pasosDe(entrega?.metodo);
	const pasoActual = pasos.findIndex((p) => p.estado === pedido.estado);

	return (
		<>
			{/* La cabecera del estado: lo primero que alguien viene a saber.
			    A partir de `lg` los pasos se van al lado del titular en vez de
			    debajo: en un monitor, apilados dejan la banda alta y vacía. */}
			<section
				className={`rounded-2xl px-6 py-7 md:px-[34px] md:py-[30px] lg:flex lg:items-end lg:gap-12 ${
					cancelado ? "bg-gris" : "bg-tinta"
				}`}
			>
				<div className="lg:min-w-0 lg:flex-1">
					<span
						className={`font-mono text-[13px] ${cancelado ? "text-tinta/55" : "text-hueso-suave/60"}`}
					>
						Pedido #{pedido.folio}
					</span>
					<h2
						className={`pt-1 font-display text-[28px] font-semibold leading-9 tracking-[-0.032em] md:text-[34px] ${
							cancelado ? "text-tinta" : "text-lima"
						}`}
					>
						{cancelado ? "Pedido cancelado" : pasos[pasoActual]?.etiqueta}
					</h2>
					<p
						className={`max-w-[46ch] pt-2 text-[15px] leading-[25px] ${
							cancelado ? "text-tinta/70" : "text-hueso-suave/75"
						}`}
					>
						{cancelado
							? "Este pedido se canceló. Si crees que es un error, escríbenos con tu folio."
							: pasos[pasoActual]?.explica}
					</p>
				</div>

				{!cancelado && (
					<ol className="flex gap-1.5 pt-7 lg:w-[520px] lg:shrink-0 lg:pt-0">
						{pasos.map((paso, i) => (
							<li key={paso.estado} className="flex flex-1 flex-col gap-2">
								<span
									className={`h-1.5 rounded-full ${
										i <= pasoActual ? "bg-lima" : "bg-hueso-suave/20"
									}`}
								/>
								<span
									className={`text-[11px] leading-tight md:text-xs ${
										i === pasoActual
											? "font-semibold text-hueso-suave"
											: i < pasoActual
												? "text-hueso-suave"
												: "text-hueso-suave/45"
									}`}
								>
									{paso.etiqueta}
								</span>
							</li>
						))}
					</ol>
				)}
			</section>

			{/* Dos columnas a partir de `lg`.
			    La colocación va explícita para que el orden en teléfono no
			    cambie: apilado sigue siendo lo pedido, el rastreo, la dirección
			    y al final la bitácora — que es como estaba y funciona. */}
			<div className="mt-7 lg:grid lg:grid-cols-[minmax(0,1fr)_372px] lg:items-start lg:gap-7">
				<section className="lg:col-start-1 lg:row-start-1">
					<h3 className="pb-3 font-display text-[19px] font-semibold tracking-[-0.02em] text-tinta">
						Lo que pediste
					</h3>
					<div className="flex flex-col gap-3">
						{pedido.lineas.map((l) => (
							<article
								key={l.id}
								className="flex items-center gap-4 rounded-xl border border-tinta/12 bg-white p-4"
							>
								<div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gris">
									{/* La colocación —la prenda con el diseño encima— antes que la
							    foto de catálogo: es lo que la persona reconoce como suyo. */}
									{/* biome-ignore lint/performance/noImgElement: export estático */}
									<img
										src={l.arte?.[0]?.colocacion ?? l.imagen ?? ""}
										alt=""
										className="h-full w-full object-contain"
									/>
								</div>
								<div className="flex min-w-0 flex-1 flex-col gap-1">
									<span className="text-[15px] font-semibold text-tinta">
										{l.producto}
									</span>
									<span className="text-sm text-tinta/65">
										{l.colorPrenda ? `${l.colorPrenda} · ` : ""}
										{l.tallas.map((t) => `${t.size}×${t.piezas}`).join(", ")}
									</span>
									<span className="text-sm text-tinta/65">
										{l.lados.length} {l.lados.length === 1 ? "lado" : "lados"}{" "}
										con diseño
									</span>
								</div>
								<span className="shrink-0 font-display text-[17px] font-semibold tracking-[-0.02em] tabular-nums text-tinta">
									{pesos(l.importe)}
								</span>
							</article>
						))}

						{/* El desglose vive aquí en teléfono y se repite arriba en la
				    columna de la derecha en escritorio: son dos sitios distintos
				    en pantallas distintas, nunca los dos a la vez. */}
						<div className="flex flex-col gap-3 lg:hidden">
							<div className="flex flex-col gap-2 rounded-[14px] bg-gris px-5 py-[18px]">
								<Desglose pedido={pedido} />
							</div>
							{accionTrasTotal}
						</div>
					</div>
				</section>

				{/* La columna de consulta: lo que se mira de un vistazo.
			    En escritorio se pega arriba mientras se baja por la lista. */}
				<aside className="flex flex-col gap-3.5 lg:sticky lg:top-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
					{/* El rastreo, en cuanto el taller compra la guía.

			    Va ANTES de la dirección porque es lo que alguien viene a mirar
			    cuando su pedido ya salió: la dirección ya la escribió él. */}
					{pedido.guia?.rastreo && (
						<section className="rounded-[14px] bg-tinta px-[22px] py-5">
							<span className="text-[11px] font-bold uppercase tracking-[0.12em] text-hueso-suave/55">
								Rastrea tu paquete
							</span>
								<p className="pt-3 text-[14px] text-hueso-suave/70">
									Lo lleva{" "}
									<span className="font-semibold text-hueso-suave">
										{pedido.guia.paqueteria ??
											pedido.envio?.paqueteria ??
											"la paquetería"}
									</span>
								</p>

								<p className="pt-1.5 font-mono text-[20px] font-semibold text-lima">
									{pedido.guia.rastreo}
								</p>

								{pedido.guia.rastreoUrl && (
									<a
										href={pedido.guia.rastreoUrl}
										target="_blank"
										rel="noreferrer"
										className="mt-4 inline-flex h-11 items-center justify-center rounded-[10px] bg-lima px-[22px] text-[15px] font-semibold text-tinta"
									>
										Ver dónde va
									</a>
								)}

								<p className="pt-3 text-[12px] leading-[18px] text-hueso-suave/45">
									La paquetería puede tardar unas horas en mostrar movimiento.
								</p>
						</section>
					)}

					{entrega && (
						<section className="rounded-[14px] border border-tinta/12 bg-white px-5 py-[18px]">
							<span className="text-[11px] font-bold uppercase tracking-[0.12em] text-tinta/45">
								{entrega.metodo === "recoger"
									? "Recoges con el taller"
									: "Envío a"}
							</span>
							<div className="pt-2.5 text-[15px] leading-6 text-tinta/80">
								{entrega.metodo === "recoger" ? (
									<p>El taller se pone de acuerdo contigo por WhatsApp.</p>
								) : entrega.direccion ? (
									<p>
										{entrega.direccion.calle} {entrega.direccion.numero}
										{entrega.direccion.interior
											? ` int. ${entrega.direccion.interior}`
											: ""}
										<br />
										{entrega.direccion.colonia}, {entrega.direccion.ciudad}
										<br />
										{entrega.direccion.estado}, C.P. {entrega.direccion.cp}
										{entrega.direccion.referencias && (
											<>
												<br />
												<span className="text-tinta/55">
													{entrega.direccion.referencias}
												</span>
											</>
										)}
									</p>
								) : null}
							</div>
						</section>
					)}

					{/* En escritorio el desglose vive aquí, al final de la columna. */}
					<div className="hidden lg:flex lg:flex-col lg:gap-2 lg:rounded-[14px] lg:bg-gris lg:px-5 lg:py-[18px]">
						<Desglose pedido={pedido} />
					</div>
					<div className="hidden lg:block">{accionTrasTotal}</div>
				</aside>

				<section className="lg:col-start-1 lg:row-start-2">
					<Titulo>Lo que ha pasado</Titulo>
					{/* Con línea y puntos, no una lista de fechas: es el mismo viaje que
			    marca la barra de arriba, y contado así se lee de un vistazo. */}
					<ol className="flex flex-col">
						{pedido.bitacora.map((b, i) => {
							const ultima = i === pedido.bitacora.length - 1;
							return (
								<li key={`${b.estado}-${b.en}`} className="flex gap-4">
									<div className="flex w-3 shrink-0 flex-col items-center">
										<span
											className={`mt-[5px] size-[11px] rounded-full ${
												i === 0 ? "bg-lima ring-2 ring-tinta" : "bg-tinta/25"
											}`}
										/>
										{!ultima && <span className="w-0.5 flex-1 bg-tinta/12" />}
									</div>
									<div className={ultima ? "" : "pb-4"}>
										<p className="text-sm font-semibold text-tinta">
											{PASOS.find((p) => p.estado === b.estado)?.etiqueta ??
												b.estado}
										</p>
										<p className="pt-0.5 text-[13px] text-tinta/55">
											{new Date(b.en).toLocaleDateString("es-MX", {
												day: "2-digit",
												month: "short",
											})}
											{b.nota ? ` · ${b.nota}` : ""}
										</p>
									</div>
								</li>
							);
						})}
					</ol>
				</section>
			</div>

			{/* Sólo tiene sentido decírselo a quien no tiene dónde volver. */}
			{!conCuenta && (
				<p className="pt-9 text-[13px] leading-5 text-tinta/55">
					Guarda este enlace: es la forma de volver a tu pedido.{" "}
					<Link href="/cuenta/entrar" className="font-semibold text-tinta">
						Crea una cuenta
					</Link>{" "}
					y no vas a necesitarlo.
				</p>
			)}
		</>
	);
}

/**
 * Piezas, envío y total.
 *
 * El importe de los productos se suma de las líneas en vez de leerse de un
 * campo: el pedido guarda `total` con el envío dentro, y restarle el envío
 * daría un número distinto el día que se cobre cualquier otra cosa.
 */
function Desglose({ pedido }: { pedido: PedidoEnSeguimiento }) {
	const productos = pedido.lineas.reduce((suma, l) => suma + l.importe, 0);
	const envio = pedido.envio?.precio ?? 0;

	return (
		<>
			<div className="flex items-baseline justify-between text-sm text-tinta/70">
				<span>
					{pedido.piezas} {pedido.piezas === 1 ? "pieza" : "piezas"}
				</span>
				<span className="tabular-nums">{pesos(productos)}</span>
			</div>

			{envio > 0 && (
				<div className="flex items-baseline justify-between text-sm text-tinta/70">
					<span>
						Envío
						{pedido.envio?.paqueteria ? ` · ${pedido.envio.paqueteria}` : ""}
					</span>
					<span className="tabular-nums">{pesos(envio)}</span>
				</div>
			)}

			<div className="mt-1 flex items-baseline justify-between border-t border-tinta/12 pt-3">
				<span className="font-display text-[15px] font-semibold text-tinta">
					Total
				</span>
				<span className="font-display text-[22px] font-semibold tabular-nums text-tinta">
					{pesos(pedido.total)}
				</span>
			</div>
		</>
	);
}

function Titulo({ children }: { children: React.ReactNode }) {
	return (
		<h3 className="pb-3 pt-9 font-display text-[19px] font-semibold tracking-[-0.02em] text-tinta">
			{children}
		</h3>
	);
}
