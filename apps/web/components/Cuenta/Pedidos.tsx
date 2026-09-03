"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
	ErrorCuenta,
	ESTADOS_PEDIDO,
	getMisPedidos,
	type PedidoDelComprador,
} from "@/lib/api/cuenta";
import { Aviso, Cargando, Vacio } from "./piezas";

/**
 * Los pedidos de quien entró.
 *
 * Salen por correo, no por cuenta, así que aquí aparecen TAMBIÉN los que hizo
 * antes de registrarse — siempre que usara este mismo correo. No hay que
 * migrar nada para eso: el índice ya está construido así.
 */
export default function Pedidos() {
	const [pedidos, setPedidos] = useState<PedidoDelComprador[] | null>(null);
	const [fallo, setFallo] = useState<string | null>(null);

	useEffect(() => {
		getMisPedidos()
			.then(setPedidos)
			.catch((error) => {
				setFallo(
					error instanceof ErrorCuenta && error.status === 401
						? "Tu sesión caducó. Vuelve a entrar."
						: "No pudimos traer tus pedidos.",
				);
			});
	}, []);

	if (fallo) return <Aviso texto={fallo} />;
	if (!pedidos) return <Cargando />;

	if (pedidos.length === 0) {
		return (
			<Vacio
				titulo="Todavía no has pedido nada"
				texto="Cuando pidas algo va a aparecer aquí, con su estado y sus archivos."
				accion={{ texto: "Ver el catálogo", href: "/catalogo" }}
			/>
		);
	}

	return (
		<ul className="flex flex-col gap-3">
			{pedidos.map((pedido) => (
				<li key={pedido.id}>
					<Tarjeta pedido={pedido} />
				</li>
			))}
		</ul>
	);
}

function Tarjeta({ pedido }: { pedido: PedidoDelComprador }) {
	const estado = ESTADOS_PEDIDO[
		pedido.estado as keyof typeof ESTADOS_PEDIDO
	] ?? {
		texto: pedido.estado,
		tono: "gris" as const,
	};

	const primera = pedido.lineas[0];
	const otras = pedido.lineas.length - 1;

	return (
		<article className="flex flex-col gap-4 rounded-xl border border-tinta/12 bg-white p-4 md:flex-row md:items-center md:gap-5 md:p-5">
			<div className="flex items-center gap-4">
				<Miniatura linea={primera} />
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2.5">
						<span className="font-display text-[17px] font-semibold tracking-[-0.02em] text-tinta">
							#{pedido.folio}
						</span>
						<Pastilla tono={estado.tono}>{estado.texto}</Pastilla>
					</div>
					<p className="mt-0.5 truncate text-[15px] text-tinta">
						{primera?.producto ?? "Pedido"}
						{otras > 0 && (
							<span className="text-tinta/55">
								{" "}
								y {otras} {otras === 1 ? "más" : "más"}
							</span>
						)}
					</p>
					<p className="text-[13px] text-tinta/55">
						{fecha(pedido.createdAt)} · {pedido.piezas}{" "}
						{pedido.piezas === 1 ? "pieza" : "piezas"}
					</p>

					{/* El número de rastreo, en cuanto existe. Se enseña aquí y no
					    sólo en el detalle porque es lo que la gente viene a mirar
					    cuando su pedido ya salió, y así se ahorra un clic. */}
					{pedido.guia?.rastreo && (
						<p className="mt-1 truncate text-[13px] text-tinta/70">
							<span className="text-tinta/50">
								{pedido.guia.paqueteria ?? "Guía"}:
							</span>{" "}
							<span className="font-mono">{pedido.guia.rastreo}</span>
						</p>
					)}
				</div>
			</div>

			<div className="flex items-center justify-between gap-4 md:ml-auto md:justify-end">
				<span className="font-display text-[19px] font-semibold tracking-[-0.02em] text-tinta tabular-nums">
					{pesos(pedido.total)}
				</span>
				<Link
					href={`/pedido?id=${encodeURIComponent(pedido.id)}`}
					className="inline-flex h-10 shrink-0 items-center rounded-full border-[1.5px] border-tinta px-4 text-sm font-semibold text-tinta hover:bg-tinta hover:text-lima"
				>
					Ver detalle
				</Link>
			</div>
		</article>
	);
}

function Miniatura({ linea }: { linea?: { imagen: string | null } }) {
	if (!linea?.imagen) {
		return <div className="h-14 w-14 shrink-0 rounded-lg bg-gris" />;
	}

	return (
		// <img> y no next/image: las fotos vienen de rutas que se sirven por
		// nuestro origen y el sitio va a export estático, donde el optimizador
		// de Next no corre.
		// biome-ignore lint/performance/noImgElement: export estático
		<img
			src={linea.imagen}
			alt=""
			className="h-14 w-14 shrink-0 rounded-lg object-cover"
		/>
	);
}

export function Pastilla({
	tono,
	children,
}: {
	tono: string;
	children: React.ReactNode;
}) {
	const estilos: Record<string, string> = {
		lima: "bg-lima text-tinta",
		lavanda: "bg-lavanda text-tinta",
		gris: "bg-gris text-tinta/70",
		rojo: "bg-[rgba(192,57,43,0.1)] text-[#c0392b]",
	};

	return (
		<span
			className={`inline-flex h-[22px] items-center rounded-full px-2.5 text-[12px] font-semibold ${estilos[tono] ?? estilos.gris}`}
		>
			{children}
		</span>
	);
}

/** Fecha corta en español. `toLocaleDateString` sin locale sale en inglés. */
export function fecha(iso: string) {
	return new Date(iso).toLocaleDateString("es-MX", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

export function pesos(centavos: number) {
	return new Intl.NumberFormat("es-MX", {
		style: "currency",
		currency: "MXN",
		maximumFractionDigits: 0,
	}).format(centavos);
}
