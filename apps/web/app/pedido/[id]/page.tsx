"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { use, useEffect, useState } from "react";
import { type PedidoEnSeguimiento, seguirPedido } from "@/lib/api/pedir";

/**
 * El seguimiento del pedido.
 *
 * Se entra con el token que va en el enlace, no con una sesión: pedir no
 * exige cuenta. Quien tenga el enlace ve el pedido, y por eso el enlace es lo
 * único que hay que cuidar.
 */

const PASOS: { estado: string; etiqueta: string; explica: string }[] = [
	{
		estado: "nuevo",
		etiqueta: "Recibido",
		explica: "El taller ya lo tiene y va a confirmarte precio y fecha.",
	},
	{
		estado: "produccion",
		etiqueta: "En producción",
		explica: "Lo están fabricando.",
	},
	{ estado: "listo", etiqueta: "Listo", explica: "Terminado y listo para salir." },
	{ estado: "entregado", etiqueta: "Entregado", explica: "Se entregó." },
];

export default function SeguimientoPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
	const token = useSearchParams().get("token") ?? "";

	const [pedido, setPedido] = useState<PedidoEnSeguimiento | null>(null);
	const [fallo, setFallo] = useState<string | null>(null);

	useEffect(() => {
		if (!token) {
			setFallo("Este enlace está incompleto: abre el que te llegó por correo.");
			return;
		}

		seguirPedido(id, token)
			.then(setPedido)
			.catch((e) =>
				setFallo(e instanceof Error ? e.message : "No pudimos abrir tu pedido"),
			);
	}, [id, token]);

	if (fallo) {
		return (
			<main className="mx-auto max-w-[680px] px-5 py-16">
				<h1 className="font-display text-[26px] font-semibold tracking-[-0.032em] text-tinta">
					No pudimos abrir este pedido
				</h1>
				<p className="pt-2 text-[15px] leading-[25px] text-tinta/70">{fallo}</p>
				<Link
					href="/catalogo"
					className="mt-6 inline-flex h-12 items-center rounded-lg border-[1.5px] border-tinta px-5 text-[15px] font-semibold text-tinta"
				>
					Ir al catálogo
				</Link>
			</main>
		);
	}

	if (!pedido) {
		return (
			<main className="mx-auto max-w-[680px] px-5 py-16 text-[15px] text-tinta/60">
				Cargando tu pedido…
			</main>
		);
	}

	const cancelado = pedido.estado === "cancelado";
	const pasoActual = PASOS.findIndex((p) => p.estado === pedido.estado);

	return (
		<main className="mx-auto max-w-[680px] px-5 py-12">
			<span className="font-mono text-[13px] text-tinta/55">
				Pedido #{pedido.folio}
			</span>
			<h1 className="pt-1 font-display text-[28px] font-semibold leading-9 tracking-[-0.032em] text-tinta">
				{cancelado ? "Pedido cancelado" : PASOS[pasoActual]?.etiqueta}
			</h1>
			<p className="pt-1.5 text-[15px] leading-[25px] text-tinta/70">
				{cancelado
					? "Este pedido se canceló. Si crees que es un error, escríbenos con tu folio."
					: PASOS[pasoActual]?.explica}
			</p>

			{!cancelado && (
				<ol className="flex gap-1.5 pt-7">
					{PASOS.map((paso, i) => (
						<li key={paso.estado} className="flex flex-1 flex-col gap-1.5">
							<span
								className={`h-1.5 rounded-full ${
									i <= pasoActual ? "bg-lima-oscuro" : "bg-tinta/12"
								}`}
							/>
							<span
								className={`text-xs ${
									i <= pasoActual ? "text-tinta" : "text-tinta/45"
								}`}
							>
								{paso.etiqueta}
							</span>
						</li>
					))}
				</ol>
			)}

			<section className="mt-9 flex flex-col gap-4">
				{pedido.lineas.map((l) => (
					<article
						key={l.id}
						className="flex gap-4 rounded-xl border border-tinta/12 bg-hueso p-4"
					>
						<div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gris">
							{l.imagen && (
								<Image
									src={l.imagen}
									alt=""
									width={80}
									height={80}
									className="h-full w-full object-cover"
								/>
							)}
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
								diseño · ${l.importe.toLocaleString("es-MX")}
							</span>
						</div>
					</article>
				))}
			</section>

			<div className="mt-4 flex items-center justify-between rounded-xl border border-tinta/12 bg-gris px-4 py-3.5">
				<span className="text-sm text-tinta/70">
					{pedido.piezas} {pedido.piezas === 1 ? "pieza" : "piezas"}
				</span>
				<span className="font-display text-[19px] font-semibold text-tinta">
					${pedido.total.toLocaleString("es-MX")}
				</span>
			</div>

			<section className="pt-9">
				<h2 className="text-[13px] font-semibold text-tinta">Lo que ha pasado</h2>
				<ol className="flex flex-col gap-2 pt-3">
					{pedido.bitacora.map((b) => (
						<li key={`${b.estado}-${b.en}`} className="flex gap-3 text-sm">
							<span className="font-mono shrink-0 text-tinta/50">
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
			</section>

			<p className="pt-8 text-[13px] leading-5 text-tinta/55">
				Guarda este enlace: es la forma de volver a tu pedido. También te llegó
				por correo.
			</p>
		</main>
	);
}
