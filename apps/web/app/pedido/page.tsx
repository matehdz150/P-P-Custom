"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useComprador } from "@/Contexts/CompradorContext";
import Footer from "@/components/Kustto/Footer";
import Header from "@/components/Kustto/Header";
import { getMiPedido } from "@/lib/api/cuenta";
import { type PedidoEnSeguimiento, seguirPedido } from "@/lib/api/pedir";

/**
 * El seguimiento del pedido.
 *
 * SE PUEDE LLEGAR POR DOS CAMINOS y los dos enseñan lo mismo:
 *
 *   CON SESIÓN — se pide por `/cuenta/pedidos/:id`, que comprueba que el
 *   pedido sea tuyo comparando el correo del token. No hace falta el token del
 *   enlace, y por eso "Ver detalle" funciona desde el panel.
 *
 *   SIN SESIÓN — con el `?token=` que va en el enlace del correo. Pedir no
 *   exige cuenta, así que este camino no puede desaparecer.
 *
 * Cuando hay sesión se prefiere la sesión aunque venga token: el token caduca
 * conceptualmente —se comparte, se reenvía— y la sesión es quien de verdad es.
 */

const PASOS = [
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
	{ estado: "entregado", etiqueta: "Entregado", explica: "Se entregó." },
];

const pesos = (n: number) =>
	new Intl.NumberFormat("es-MX", {
		style: "currency",
		currency: "MXN",
		maximumFractionDigits: 0,
	}).format(n);

function Seguimiento() {
	/* El id va en la query y no en la ruta a propósito.

	   El sitio se publica como export estático, y una ruta dinámica necesita
	   conocer todas sus URLs en el build. Los pedidos se crean después de
	   desplegar, así que `/pedido/[id]` no se puede pre-renderizar nunca. Aquí
	   no se pierde nada: el enlace es privado y no tiene que indexarse. */
	const parametros = useSearchParams();
	const id = parametros.get("id") ?? "";
	const token = parametros.get("token") ?? "";

	const { comprador, cargando: cargandoSesion } = useComprador();
	const [pedido, setPedido] = useState<PedidoEnSeguimiento | null>(null);
	const [fallo, setFallo] = useState<string | null>(null);
	const [sinAcceso, setSinAcceso] = useState(false);

	useEffect(() => {
		// Esperar a saber si hay sesión: sin esto, quien llega con su cuenta
		// abierta vería el error de "enlace incompleto" un instante antes de que
		// cargue, y ya habría pulsado "volver".
		if (cargandoSesion) return;

		if (!id) {
			setFallo("A este enlace le falta el pedido.");
			return;
		}

		if (comprador) {
			getMiPedido(id)
				.then(setPedido)
				.catch(() =>
					setFallo(
						"No encontramos ese pedido en tu cuenta. Si lo hiciste con otro correo, abre el enlace que te llegó.",
					),
				);
			return;
		}

		if (!token) {
			// Sin sesión y sin token no hay nada que comprobar. Antes esto decía
			// "abre el que te llegó por correo" y punto; entrar a la cuenta es la
			// otra salida, y para quien ya la tiene es la buena.
			setSinAcceso(true);
			return;
		}

		seguirPedido(id, token)
			.then(setPedido)
			.catch((e) =>
				setFallo(e instanceof Error ? e.message : "No pudimos abrir tu pedido"),
			);
	}, [id, token, comprador, cargandoSesion]);

	if (sinAcceso) {
		return (
			<Centrado
				titulo="Entra para ver este pedido"
				texto="Este enlace no trae la clave de seguimiento. Si el pedido es tuyo, entra a tu cuenta y ahí está."
			>
				<Link
					href={`/cuenta/entrar?volver=${encodeURIComponent(`/pedido?id=${id}`)}`}
					className="inline-flex h-12 items-center rounded-lg bg-tinta px-5 text-[15px] font-semibold text-lima"
				>
					Entrar a mi cuenta
				</Link>
				<Link
					href="/catalogo"
					className="inline-flex h-12 items-center rounded-lg border-[1.5px] border-tinta px-5 text-[15px] font-semibold text-tinta"
				>
					Ir al catálogo
				</Link>
			</Centrado>
		);
	}

	if (fallo) {
		return (
			<Centrado titulo="No pudimos abrir este pedido" texto={fallo}>
				<Link
					href={comprador ? "/cuenta" : "/catalogo"}
					className="inline-flex h-12 items-center rounded-lg border-[1.5px] border-tinta px-5 text-[15px] font-semibold text-tinta"
				>
					{comprador ? "Ver mis pedidos" : "Ir al catálogo"}
				</Link>
			</Centrado>
		);
	}

	if (!pedido) {
		return (
			<main className="mx-auto w-full max-w-[760px] flex-1 px-5 py-16">
				<div className="h-7 w-40 animate-pulse rounded bg-gris" />
				<div className="mt-4 h-10 w-72 animate-pulse rounded bg-gris" />
				<div className="mt-8 h-24 animate-pulse rounded-xl bg-gris" />
			</main>
		);
	}

	const cancelado = pedido.estado === "cancelado";
	const pasoActual = PASOS.findIndex((p) => p.estado === pedido.estado);
	const entrega = pedido.entrega;

	return (
		<main className="mx-auto w-full max-w-[760px] flex-1 px-5 py-8 md:py-12">
			{comprador && (
				<Link
					href="/cuenta"
					className="inline-flex items-center gap-1.5 text-[14px] font-medium text-tinta/60 hover:text-tinta"
				>
					<span aria-hidden>←</span> Mis pedidos
				</Link>
			)}

			{/* La cabecera del estado: lo primero que alguien viene a saber. */}
			<section
				className={`mt-4 rounded-2xl px-6 py-7 md:px-8 md:py-8 ${
					cancelado ? "bg-gris" : "bg-tinta"
				}`}
			>
				<span
					className={`font-mono text-[13px] ${cancelado ? "text-tinta/55" : "text-hueso-suave/60"}`}
				>
					Pedido #{pedido.folio}
				</span>
				<h1
					className={`pt-1 font-display text-[28px] font-semibold leading-9 tracking-[-0.032em] md:text-[34px] ${
						cancelado ? "text-tinta" : "text-lima"
					}`}
				>
					{cancelado ? "Pedido cancelado" : PASOS[pasoActual]?.etiqueta}
				</h1>
				<p
					className={`max-w-[46ch] pt-2 text-[15px] leading-[25px] ${
						cancelado ? "text-tinta/70" : "text-hueso-suave/75"
					}`}
				>
					{cancelado
						? "Este pedido se canceló. Si crees que es un error, escríbenos con tu folio."
						: PASOS[pasoActual]?.explica}
				</p>

				{!cancelado && (
					<ol className="flex gap-1.5 pt-7">
						{PASOS.map((paso, i) => (
							<li key={paso.estado} className="flex flex-1 flex-col gap-2">
								<span
									className={`h-1.5 rounded-full ${
										i <= pasoActual ? "bg-lima" : "bg-hueso-suave/20"
									}`}
								/>
								<span
									className={`text-[11px] leading-tight md:text-xs ${
										i <= pasoActual ? "text-hueso-suave" : "text-hueso-suave/45"
									}`}
								>
									{paso.etiqueta}
								</span>
							</li>
						))}
					</ol>
				)}
			</section>

			<Titulo>Lo que pediste</Titulo>
			<section className="flex flex-col gap-3">
				{pedido.lineas.map((l) => (
					<article
						key={l.id}
						className="flex gap-4 rounded-xl border border-tinta/12 bg-white p-4"
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
						<div className="flex min-w-0 flex-col gap-1">
							<span className="text-[15px] font-semibold text-tinta">
								{l.producto}
							</span>
							<span className="text-sm text-tinta/65">
								{l.colorPrenda ? `${l.colorPrenda} · ` : ""}
								{l.tallas.map((t) => `${t.size}×${t.piezas}`).join(", ")}
							</span>
							<span className="text-sm text-tinta/65">
								{l.lados.length} {l.lados.length === 1 ? "lado" : "lados"} con
								diseño · {pesos(l.importe)}
							</span>
						</div>
					</article>
				))}

				<div className="flex items-center justify-between rounded-xl border border-tinta/12 bg-gris px-4 py-3.5">
					<span className="text-sm text-tinta/70">
						{pedido.piezas} {pedido.piezas === 1 ? "pieza" : "piezas"}
					</span>
					<span className="font-display text-[19px] font-semibold tabular-nums text-tinta">
						{pesos(pedido.total)}
					</span>
				</div>
			</section>

			{entrega && (
				<>
					<Titulo>
						{entrega.metodo === "recoger" ? "Recoges con el taller" : "Envío a"}
					</Titulo>
					<div className="rounded-xl border border-tinta/12 bg-white p-4 text-[15px] leading-[25px] text-tinta/80">
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
				</>
			)}

			<Titulo>Lo que ha pasado</Titulo>
			<ol className="flex flex-col gap-2.5">
				{pedido.bitacora.map((b) => (
					<li key={`${b.estado}-${b.en}`} className="flex gap-3 text-sm">
						<span className="w-16 shrink-0 font-mono text-tinta/50">
							{new Date(b.en).toLocaleDateString("es-MX", {
								day: "2-digit",
								month: "short",
							})}
						</span>
						<span className="text-tinta/80">
							{PASOS.find((p) => p.estado === b.estado)?.etiqueta ?? b.estado}
							{b.nota ? ` — ${b.nota}` : ""}
						</span>
					</li>
				))}
			</ol>

			{/* Sólo tiene sentido decírselo a quien no tiene dónde volver. */}
			{!comprador && (
				<p className="pt-9 text-[13px] leading-5 text-tinta/55">
					Guarda este enlace: es la forma de volver a tu pedido.{" "}
					<Link href="/cuenta/entrar" className="font-semibold text-tinta">
						Crea una cuenta
					</Link>{" "}
					y no vas a necesitarlo.
				</p>
			)}
		</main>
	);
}

function Titulo({ children }: { children: React.ReactNode }) {
	return (
		<h2 className="pb-3 pt-9 font-display text-[19px] font-semibold tracking-[-0.02em] text-tinta">
			{children}
		</h2>
	);
}

function Centrado({
	titulo,
	texto,
	children,
}: {
	titulo: string;
	texto: string;
	children?: React.ReactNode;
}) {
	return (
		<main className="mx-auto w-full max-w-[560px] flex-1 px-5 py-20 text-center">
			<h1 className="font-display text-[26px] font-semibold tracking-[-0.032em] text-tinta">
				{titulo}
			</h1>
			<p className="pt-2 text-[15px] leading-[25px] text-tinta/70">{texto}</p>
			<div className="flex flex-wrap justify-center gap-3 pt-7">{children}</div>
		</main>
	);
}

/**
 * `useSearchParams` obliga a un límite de Suspense.
 *
 * Al construir el sitio estático, Next pre-renderiza esta página sin conocer
 * la query —no existe hasta que alguien abre su enlace—, y sin el Suspense el
 * build falla. El envoltorio es lo que le permite dejar el hueco y rellenarlo
 * en el navegador.
 */
export default function Pagina() {
	return (
		<div className="flex min-h-screen flex-col bg-hueso text-tinta">
			<Header />
			<Suspense
				fallback={
					<main className="mx-auto w-full max-w-[760px] flex-1 px-5 py-16 text-tinta/60">
						Abriendo tu pedido…
					</main>
				}
			>
				<Seguimiento />
			</Suspense>
			<Footer />
		</div>
	);
}
