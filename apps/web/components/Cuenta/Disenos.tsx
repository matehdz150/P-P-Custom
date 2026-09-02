"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getFichaDeProducto } from "@/lib/api/catalogo";
import { ErrorCuenta, getMisPedidos } from "@/lib/api/cuenta";
import {
	type BorradorPedido,
	borrarBorrador,
	leerBorrador,
} from "@/lib/pedido/borrador";
import { fecha } from "./Pedidos";
import { Aviso, Cargando, Vacio } from "./piezas";

/**
 * Los diseños de esta persona.
 *
 * Son dos cosas distintas y por eso van separadas:
 *
 *   A MEDIO HACER es el borrador de `lib/pedido/borrador.ts`, que vive en el
 *   IndexedDB de ESTE navegador y caduca a las 6 horas. No cruza de
 *   dispositivo. El editor ya lo restaura solo al abrirlo, así que "retomar"
 *   es simplemente volver a su producto.
 *
 *   DE TUS PEDIDOS son los que ya se produjeron o están en cola. Esos sí viven
 *   en S3 y no se pierden.
 *
 * No hay una tercera categoría —"guardados sin pedir"— porque el editor
 * todavía no tiene botón de guardar. Cuando lo tenga, entra aquí.
 */

type DisenoDePedido = {
	clave: string;
	folio: string;
	pedidoId: string;
	producto: string;
	imagen: string | null;
	cuando: string;
};

export default function Disenos() {
	const [borrador, setBorrador] = useState<BorradorPedido | null>(null);
	const [nombreBorrador, setNombreBorrador] = useState<string | null>(null);
	const [dePedidos, setDePedidos] = useState<DisenoDePedido[] | null>(null);
	const [fallo, setFallo] = useState<string | null>(null);

	useEffect(() => {
		leerBorrador().then(async (b) => {
			setBorrador(b);
			if (!b) return;

			// El borrador sólo guarda el id del producto: el nombre hay que
			// pedirlo. Si el producto se archivó, se enseña sin nombre en vez de
			// esconder el diseño — la persona ya invirtió tiempo en él.
			const ficha = await getFichaDeProducto(b.productoId).catch(() => null);
			setNombreBorrador(ficha?.name ?? null);
		});

		getMisPedidos()
			.then((pedidos) => {
				setDePedidos(
					pedidos.flatMap((p) =>
						p.lineas
							.filter((l) => (l.arte ?? []).length > 0)
							.map((l) => ({
								clave: l.id,
								folio: p.folio,
								pedidoId: p.id,
								producto: l.producto,
								// La colocación es la prenda CON el diseño encima: es lo
								// que alguien reconoce como "su diseño". El arte suelto va
								// recortado y transparente, y no se entiende en pequeño.
								imagen: l.arte[0]?.colocacion ?? l.imagen,
								cuando: p.createdAt,
							})),
					),
				);
			})
			.catch((error) => {
				setFallo(
					error instanceof ErrorCuenta && error.status === 401
						? "Tu sesión caducó. Vuelve a entrar."
						: "No pudimos traer tus diseños.",
				);
			});
	}, []);

	async function descartar() {
		await borrarBorrador();
		setBorrador(null);
	}

	if (fallo) return <Aviso texto={fallo} />;
	if (!dePedidos) return <Cargando />;

	if (!borrador && dePedidos.length === 0) {
		return (
			<Vacio
				titulo="Todavía no has diseñado nada"
				texto="Elige una prenda y ponle lo tuyo. Lo que dejes a medias aparece aquí para retomarlo."
				accion={{ texto: "Empezar a diseñar", href: "/catalogo" }}
			/>
		);
	}

	return (
		<div className="flex flex-col gap-8">
			{borrador && (
				<section>
					<Titulo>A medio hacer</Titulo>
					<p className="mb-3 text-[13px] text-tinta/55">
						Guardado en este navegador. Se borra solo a las 6 horas.
					</p>

					<article className="flex items-center gap-4 rounded-xl border-[1.5px] border-lima-oscuro/40 bg-white p-4">
						<Lienzo src={borrador.lados[0]?.miniaturaPrenda ?? null} />
						<div className="min-w-0 flex-1">
							<p className="truncate text-[15px] font-semibold text-tinta">
								{nombreBorrador ?? "Tu diseño"}
							</p>
							<p className="text-[13px] text-tinta/55">
								{borrador.lados.length}{" "}
								{borrador.lados.length === 1 ? "lado" : "lados"} · empezado{" "}
								{hace(borrador.creadoEn)}
							</p>
						</div>
						<div className="flex shrink-0 items-center gap-2">
							<button
								type="button"
								onClick={descartar}
								className="h-10 rounded-full px-3 text-sm font-medium text-tinta/55 hover:text-tinta"
							>
								Descartar
							</button>
							<Link
								href={`/design/${encodeURIComponent(borrador.productoId)}`}
								className="inline-flex h-10 items-center rounded-full bg-tinta px-4 text-sm font-semibold text-lima"
							>
								Retomar
							</Link>
						</div>
					</article>
				</section>
			)}

			{dePedidos.length > 0 && (
				<section>
					<Titulo>De tus pedidos</Titulo>
					<div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
						{dePedidos.map((d) => (
							<Link
								key={d.clave}
								href={`/pedido?id=${encodeURIComponent(d.pedidoId)}`}
								className="group flex flex-col gap-2"
							>
								<div className="overflow-hidden rounded-xl border border-tinta/12 bg-gris">
									<Lienzo src={d.imagen} grande />
								</div>
								<div className="min-w-0">
									<p className="truncate text-[14px] font-semibold text-tinta group-hover:text-lima-oscuro">
										{d.producto}
									</p>
									<p className="text-[12px] text-tinta/55">
										#{d.folio} · {fecha(d.cuando)}
									</p>
								</div>
							</Link>
						))}
					</div>
				</section>
			)}
		</div>
	);
}

function Titulo({ children }: { children: React.ReactNode }) {
	return (
		<h2 className="font-display text-[19px] font-semibold tracking-[-0.02em] text-tinta">
			{children}
		</h2>
	);
}

function Lienzo({ src, grande }: { src: string | null; grande?: boolean }) {
	const medida = grande ? "aspect-square w-full" : "h-16 w-16 rounded-lg";

	if (!src) return <div className={`${medida} shrink-0 bg-gris`} />;

	return (
		// El sitio va a export estático y las miniaturas del borrador son data
		// URLs: el optimizador de Next no corre ni tendría nada que optimizar.
		// biome-ignore lint/performance/noImgElement: export estático
		<img
			src={src}
			alt=""
			className={`${medida} shrink-0 object-contain`}
			loading="lazy"
		/>
	);
}

/** "hace 2 horas". Para un borrador la hora exacta no le importa a nadie. */
function hace(epoch: number) {
	const minutos = Math.round((Date.now() - epoch) / 60000);
	if (minutos < 1) return "hace un momento";
	if (minutos < 60) return `hace ${minutos} min`;
	const horas = Math.round(minutos / 60);
	return `hace ${horas} ${horas === 1 ? "hora" : "horas"}`;
}
