"use client";

import { BookmarkPlus, Pencil, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getFichaDeProducto } from "@/lib/api/catalogo";
import {
	borrarDiseno,
	type DisenoGuardado,
	enlaceParaRediseñar,
	guardarDiseno,
	renombrarDiseno,
} from "@/lib/api/cuenta";
import {
	type BorradorPedido,
	borrarBorrador,
	leerBorrador,
} from "@/lib/pedido/borrador";
import { useDatosDelPanel } from "./datos";
import NombrarDiseno from "./NombrarDiseno";
import { fecha } from "./Pedidos";
import { Aviso, Cargando, Vacio } from "./piezas";

/**
 * Los diseños de esta persona, en tres grupos que NO son lo mismo.
 *
 *   GUARDADOS son los que tienen nombre. Viven en su propia carpeta de S3,
 *   copiada, así que sobreviven al pedido del que salieron. Son los que una
 *   empresa vuelve a pedir cada mes, y por eso van arriba.
 *
 *   A MEDIO HACER es el borrador de `lib/pedido/borrador.ts`: IndexedDB de
 *   ESTE navegador, seis horas, no cruza de dispositivo.
 *
 *   DE TUS PEDIDOS son los que ya se produjeron. Están en S3 y no se pierden,
 *   pero encontrarlos exige acordarse de en qué pedido iban — por eso el botón
 *   que importa aquí es "Guardar", que los asciende al primer grupo.
 */

export default function Disenos() {
	const { pedidos, disenos, fallo, reemplazarDiseno, quitarDiseno, recargar } =
		useDatosDelPanel();

	const [borrador, setBorrador] = useState<BorradorPedido | null>(null);
	const [nombreBorrador, setNombreBorrador] = useState<string | null>(null);
	const [problema, setProblema] = useState<string | null>(null);
	const [busqueda, setBusqueda] = useState("");

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
	}, []);

	if (fallo) return <Aviso texto={fallo} />;
	if (!pedidos || !disenos) return <Cargando />;

	/* Las líneas que ya están guardadas no se repiten abajo: verlas dos veces
	   con dos botones distintos hace dudar de si son el mismo diseño. */
	const yaGuardadas = new Set(
		disenos.map((d) => `${d.origen.pedidoId}::${d.origen.lineaId}`),
	);

	const dePedidos = pedidos.flatMap((p) =>
		p.lineas
			.filter(
				(l) =>
					(l.arte ?? []).length > 0 && !yaGuardadas.has(`${p.id}::${l.id}`),
			)
			.map((l) => ({
				clave: `${p.id}::${l.id}`,
				pedidoId: p.id,
				lineaId: l.id,
				folio: p.folio,
				producto: l.producto,
				// La colocación es la prenda CON el diseño encima: es lo que
				// alguien reconoce como "su diseño". El arte suelto va recortado
				// y transparente, y no se entiende en pequeño.
				imagen: l.arte[0]?.colocacion ?? l.imagen,
				cuando: p.createdAt,
			})),
	);
	const termino = busqueda.trim().toLocaleLowerCase("es-MX");
	const disenosFiltrados = termino
		? disenos.filter((diseno) =>
				[diseno.nombre, diseno.producto, diseno.colorPrenda]
					.filter(Boolean)
					.join(" ")
					.toLocaleLowerCase("es-MX")
					.includes(termino),
			)
		: disenos;
	const dePedidosFiltrados = termino
		? dePedidos.filter((diseno) =>
				[diseno.producto, diseno.folio]
					.join(" ")
					.toLocaleLowerCase("es-MX")
					.includes(termino),
			)
		: dePedidos;

	if (!borrador && disenos.length === 0 && dePedidos.length === 0) {
		return (
			<Vacio
				titulo="Todavía no has diseñado nada"
				texto="Elige una prenda y ponle lo tuyo. Lo que dejes a medias aparece aquí para retomarlo."
				accion={{ texto: "Empezar a diseñar", href: "/catalogo" }}
			/>
		);
	}

	return (
		<div className="flex flex-col gap-6">
			{problema && <Aviso texto={problema} />}

			<div className="relative w-full max-w-xl">
				<Search
					className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-tinta/40"
					aria-hidden
				/>
				<input
					type="search"
					value={busqueda}
					onChange={(evento) => setBusqueda(evento.target.value)}
					placeholder="Buscar por diseño, producto o pedido"
					aria-label="Buscar diseños"
					className="h-11 w-full rounded-full border border-tinta/12 bg-white pl-10 pr-4 text-[14px] text-tinta outline-none transition-shadow placeholder:text-tinta/40 focus:border-tinta/25 focus:ring-4 focus:ring-tinta/[0.04]"
				/>
			</div>

			{disenosFiltrados.length > 0 && (
				<section>
					<Titulo>Guardados</Titulo>
					<p className="mb-3 text-[13px] text-tinta/55">
						Los tuyos con nombre. Ábrelos, cámbiales lo que quieras y vuelve a
						pedirlos.
					</p>

					<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
						{disenosFiltrados.map((d) => (
							<Guardado
								key={d.id}
								diseno={d}
								onRenombrar={reemplazarDiseno}
								onBorrar={quitarDiseno}
								onFallo={setProblema}
							/>
						))}
					</div>
				</section>
			)}

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
								onClick={async () => {
									await borrarBorrador();
									setBorrador(null);
								}}
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

			{dePedidosFiltrados.length > 0 && (
				<section>
					<Titulo>De tus pedidos</Titulo>
					<p className="mb-3 text-[13px] text-tinta/55">
						Ponles nombre para tenerlos arriba y no buscar el pedido cada vez.
					</p>

					<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
						{dePedidosFiltrados.map((d) => (
							<DePedido
								key={d.clave}
								diseno={d}
								onGuardado={recargar}
								onFallo={setProblema}
							/>
						))}
					</div>
				</section>
			)}

			{termino &&
				disenosFiltrados.length === 0 &&
				dePedidosFiltrados.length === 0 && (
					<p className="rounded-2xl border border-dashed border-tinta/15 px-5 py-10 text-center text-[14px] text-tinta/50">
						No encontramos diseños que coincidan con “{busqueda}”.
					</p>
				)}
		</div>
	);
}

/* ─── Un diseño con nombre ──────────────────────────────────────────────── */

function Guardado({
	diseno,
	onRenombrar,
	onBorrar,
	onFallo,
}: {
	diseno: DisenoGuardado;
	onRenombrar: (d: DisenoGuardado) => void;
	onBorrar: (id: string) => void;
	onFallo: (mensaje: string | null) => void;
}) {
	const [editando, setEditando] = useState(false);
	const [ocupado, setOcupado] = useState(false);

	async function renombrar(nombre: string) {
		if (nombre === diseno.nombre) return null;

		try {
			onRenombrar(await renombrarDiseno(diseno.id, nombre));
			onFallo(null);
			return null;
		} catch (error) {
			return error instanceof Error
				? error.message
				: "No pudimos cambiarle el nombre.";
		}
	}

	async function quitar() {
		setOcupado(true);
		try {
			await borrarDiseno(diseno.id);
			onBorrar(diseno.id);
			onFallo(null);
		} catch {
			onFallo("No pudimos quitar ese diseño.");
			setOcupado(false);
		}
	}

	return (
		<article
			className={`flex h-full flex-col overflow-hidden rounded-2xl border border-tinta/10 bg-white transition-colors hover:border-tinta/25 ${ocupado ? "opacity-50" : ""}`}
		>
			<Link
				href={enlaceParaRediseñar(diseno)}
				className="block overflow-hidden bg-white"
			>
				<Lienzo src={diseno.miniatura} grande />
			</Link>

			<div className="flex flex-1 flex-col p-4">
				<div className="min-w-0">
					<p className="truncate text-[15px] font-semibold text-tinta">
						{diseno.nombre}
					</p>
					<p className="mt-1 truncate text-[13px] text-tinta/50">
						{diseno.producto}
						{diseno.colorPrenda ? ` · ${diseno.colorPrenda}` : ""}
					</p>
				</div>

				<NombrarDiseno
					abierto={editando}
					onAbrir={setEditando}
					titulo="Cambiarle el nombre"
					explica="El nombre es como lo vas a encontrar el mes que viene."
					valorInicial={diseno.nombre}
					imagen={diseno.miniatura}
					producto={diseno.producto}
					textoBoton="Guardar"
					onGuardar={renombrar}
				/>

				{/* Los tres verbos: abrirlo, renombrarlo, quitarlo. Siempre visibles y
			    no sólo al pasar el ratón — en un teléfono no hay ratón, y ahí un
			    control que aparece al hacer hover simplemente no existe. */}
			<div className="mt-4 flex items-center gap-1">
				<Link
					href={enlaceParaRediseñar(diseno)}
					className="inline-flex h-9 flex-1 items-center justify-center rounded-full bg-tinta px-3 text-[13px] font-semibold text-lima"
				>
					Volver a pedir
				</Link>
				<button
					type="button"
					onClick={() => setEditando(true)}
					aria-label={`Cambiar el nombre de ${diseno.nombre}`}
					className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-tinta/55 hover:bg-gris hover:text-tinta"
				>
					<Pencil className="size-4" aria-hidden />
				</button>
				<button
					type="button"
					onClick={quitar}
					aria-label={`Quitar ${diseno.nombre} de tus diseños`}
					className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-tinta/55 hover:bg-[rgba(192,57,43,0.1)] hover:text-[#c0392b]"
				>
					<Trash2 className="size-4" aria-hidden />
				</button>
			</div>
			</div>
		</article>
	);
}

/* ─── Un diseño que todavía es sólo una línea de pedido ─────────────────── */

type DisenoDePedido = {
	pedidoId: string;
	lineaId: string;
	folio: string;
	producto: string;
	imagen: string | null;
	cuando: string;
};

function DePedido({
	diseno,
	onGuardado,
	onFallo,
}: {
	diseno: DisenoDePedido;
	onGuardado: () => void;
	onFallo: (mensaje: string | null) => void;
}) {
	const [poniendoNombre, setPoniendoNombre] = useState(false);

	async function guardar(nombre: string) {
		try {
			await guardarDiseno({
				nombre,
				pedidoId: diseno.pedidoId,
				lineaId: diseno.lineaId,
			});
			onFallo(null);
			// Recargar y no insertar a mano: la Lambda copia archivos y devuelve
			// las rutas NUEVAS, que son las que hay que enseñar. Inventarlas aquí
			// significaría dos sitios construyendo la misma ruta.
			onGuardado();
			return null;
		} catch (error) {
			return error instanceof Error
				? error.message
				: "No pudimos guardar el diseño.";
		}
	}

	return (
		<article className="flex h-full flex-col overflow-hidden rounded-2xl border border-tinta/10 bg-white transition-colors hover:border-tinta/25">
			<Link
				href={`/pedido?id=${encodeURIComponent(diseno.pedidoId)}`}
				className="block overflow-hidden bg-white"
			>
				<Lienzo src={diseno.imagen} grande />
			</Link>

			<div className="flex flex-1 flex-col p-4">
				<div className="min-w-0">
					<p className="truncate text-[15px] font-semibold text-tinta">
						{diseno.producto}
					</p>
					<p className="mt-1 text-[13px] text-tinta/50">
						#{diseno.folio} · {fecha(diseno.cuando)}
					</p>
				</div>

				<button
					type="button"
					onClick={() => setPoniendoNombre(true)}
					className="mt-4 inline-flex h-9 items-center justify-center gap-1.5 rounded-full border-[1.5px] border-tinta px-3 text-[13px] font-semibold text-tinta hover:bg-tinta hover:text-lima"
				>
					<BookmarkPlus className="size-4" aria-hidden />
					Guardar
				</button>
			</div>

			<NombrarDiseno
				abierto={poniendoNombre}
				onAbrir={setPoniendoNombre}
				titulo="Guardar este diseño"
				explica="Con nombre lo tienes arriba y no hay que buscar el pedido cada vez que quieras repetirlo."
				valorInicial=""
				imagen={diseno.imagen}
				producto={`${diseno.producto} · del pedido #${diseno.folio}`}
				textoBoton="Guardar diseño"
				onGuardar={guardar}
			/>
		</article>
	);
}

/* ─── Piezas ────────────────────────────────────────────────────────────── */

function Titulo({ children }: { children: React.ReactNode }) {
	return (
		<h2 className="font-display text-[19px] font-semibold tracking-[-0.02em] text-tinta">
			{children}
		</h2>
	);
}

function Lienzo({ src, grande }: { src: string | null; grande?: boolean }) {
	const medida = grande ? "aspect-[4/3] w-full" : "h-16 w-16 rounded-lg";

	if (!src) return <div className={`${medida} shrink-0 bg-white`} />;

	return (
		// El sitio va a export estático y las miniaturas del borrador son data
		// URLs: el optimizador de Next no corre ni tendría nada que optimizar.
		// biome-ignore lint/performance/noImgElement: export estático
		<img
			src={src}
			alt=""
			className={`${medida} shrink-0 ${grande ? "object-cover" : "object-contain"}`}
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
