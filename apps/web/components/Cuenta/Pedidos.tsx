"use client";

import { endOfDay, format, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { motion } from "framer-motion";
import {
	ArrowUpDown,
	CalendarDays,
	ChevronRight,
	Search,
	X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { ESTADOS_PEDIDO, type PedidoDelComprador } from "@/lib/api/cuenta";
import { CURVA, Elemento } from "./animaciones";
import { useDatosDelPanel } from "./datos";
import { Aviso, Cargando, SinResultados, Vacio } from "./piezas";

type Filtro = "todos" | "en_curso" | "enviado" | "entregado" | "cancelado";

const FILTROS: { id: Filtro; texto: string }[] = [
	{ id: "todos", texto: "Todos" },
	{ id: "en_curso", texto: "En proceso" },
	{ id: "enviado", texto: "En camino" },
	{ id: "entregado", texto: "Entregados" },
	{ id: "cancelado", texto: "Cancelados" },
];

/** Por qué se ordena. `fecha` primero: un pedido se busca por cuándo fue. */
type Columna = "fecha" | "total" | "folio";
type Orden = { columna: Columna; desc: boolean };

/**
 * Los pedidos de quien entró.
 *
 * Salen por correo, no por cuenta, así que aquí aparecen TAMBIÉN los que hizo
 * antes de registrarse — siempre que usara este mismo correo. No hay que
 * migrar nada para eso: el índice ya está construido así.
 *
 * DOS FORMAS, UNA LISTA. Tabla desde `md`, tarjetas por debajo. La tabla
 * llevaba `min-w-[900px]` con scroll lateral, y el panel ya es una columna
 * estrecha: en un teléfono eran seis columnas apretadas que había que arrastrar
 * de lado para leer el total. Se comparte el filtrado y el orden; lo único que
 * cambia es cómo se dibuja cada pedido.
 */
export default function Pedidos() {
	const { pedidos, fallo } = useDatosDelPanel();
	const [busqueda, setBusqueda] = useState("");
	const [filtro, setFiltro] = useState<Filtro>("todos");
	const [rango, setRango] = useState<DateRange | undefined>();
	const [orden, setOrden] = useState<Orden>({ columna: "fecha", desc: true });

	const visibles = useMemo(() => {
		if (!pedidos) return [];
		const termino = busqueda.trim().toLocaleLowerCase("es-MX");

		const filtrados = pedidos.filter((pedido) => {
			if (
				filtro === "en_curso" &&
				!["nuevo", "produccion", "listo"].includes(pedido.estado)
			) {
				return false;
			}
			if (filtro === "enviado" && pedido.estado !== "enviado") return false;
			if (filtro === "entregado" && pedido.estado !== "entregado") return false;
			if (filtro === "cancelado" && pedido.estado !== "cancelado") return false;

			const recibida = new Date(pedido.createdAt).getTime();
			if (rango?.from && recibida < startOfDay(rango.from).getTime()) {
				return false;
			}
			if (rango?.to && recibida > endOfDay(rango.to).getTime()) return false;
			if (!termino) return true;

			const estado =
				ESTADOS_PEDIDO[pedido.estado as keyof typeof ESTADOS_PEDIDO]?.texto;
			const texto = [
				pedido.folio,
				estado,
				pedido.estado,
				pedido.guia?.paqueteria,
				pedido.guia?.rastreo,
				...pedido.lineas.map((linea) => linea.producto),
			]
				.filter(Boolean)
				.join(" ")
				.toLocaleLowerCase("es-MX");

			return texto.includes(termino);
		});

		const signo = orden.desc ? -1 : 1;

		return filtrados.sort((a, b) => {
			if (orden.columna === "total") return (a.total - b.total) * signo;
			if (orden.columna === "folio")
				return a.folio.localeCompare(b.folio) * signo;
			return a.createdAt.localeCompare(b.createdAt) * signo;
		});
	}, [busqueda, filtro, orden, pedidos, rango]);

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

	const filtrando = !!busqueda.trim() || filtro !== "todos" || !!rango?.from;

	function limpiar() {
		setBusqueda("");
		setFiltro("todos");
		setRango(undefined);
	}

	const etiquetaFecha = rango?.from
		? rango.to
			? `${format(rango.from, "d MMM", { locale: es })} – ${format(rango.to, "d MMM yyyy", { locale: es })}`
			: `Desde ${format(rango.from, "d MMM yyyy", { locale: es })}`
		: "Cualquier fecha";

	function alOrdenar(columna: Columna) {
		setOrden((antes) =>
			antes.columna === columna
				? { columna, desc: !antes.desc }
				: // Al estrenar columna se empieza por lo más útil: lo más nuevo y
					// lo más caro primero; el folio, en cambio, se lee ascendente.
					{ columna, desc: columna !== "folio" },
		);
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="relative w-full max-w-xl">
				<Search
					className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-tinta/40"
					aria-hidden
				/>
				<input
					type="search"
					value={busqueda}
					onChange={(evento) => setBusqueda(evento.target.value)}
					placeholder="Buscar por pedido, producto o guía"
					aria-label="Buscar pedidos"
					className="h-11 w-full rounded-full border border-tinta/12 bg-white pl-10 pr-4 text-[14px] text-tinta outline-none transition-shadow placeholder:text-tinta/40 focus:border-tinta/25 focus:ring-4 focus:ring-tinta/[0.04]"
				/>
			</div>

			<div className="flex flex-wrap items-center justify-between gap-3">
				{/* `fieldset` y no un `div` con `role="group"`: es el elemento que
				    agrupa controles, y su `legend` da el nombre accesible sin
				    inventar un `aria-label` que un `div` pelado ni siquiera admite.
				    `min-w-0` porque el `fieldset` trae `min-width: min-content` de
				    serie y eso rompe el `flex-wrap`. */}
				<fieldset className="flex min-w-0 flex-wrap gap-1.5">
					<legend className="sr-only">Filtrar por estado</legend>
					{FILTROS.map((opcion) => (
						<button
							key={opcion.id}
							type="button"
							onClick={() => setFiltro(opcion.id)}
							aria-pressed={filtro === opcion.id}
							className={`h-9 rounded-full px-3.5 text-[13px] font-medium transition-colors ${
								filtro === opcion.id
									? "bg-tinta text-white"
									: "border border-tinta/10 bg-white text-tinta/60 hover:bg-gris hover:text-tinta"
							}`}
						>
							{opcion.texto}
						</button>
					))}
				</fieldset>

				<Popover>
					<PopoverTrigger asChild>
						<button
							type="button"
							className={`inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-colors ${
								rango?.from
									? "border-tinta bg-tinta text-white"
									: "border-tinta/10 bg-white text-tinta/60 hover:bg-gris hover:text-tinta"
							}`}
						>
							<CalendarDays className="size-4" aria-hidden />
							{etiquetaFecha}
						</button>
					</PopoverTrigger>
					<PopoverContent
						align="end"
						className="w-auto overflow-hidden rounded-2xl border-tinta/10 bg-white p-0 shadow-[0_16px_45px_rgba(43,40,18,0.14)]"
					>
						<Calendar
							mode="range"
							selected={rango}
							onSelect={setRango}
							defaultMonth={rango?.from}
							locale={es}
						/>
						<div className="flex items-center justify-between border-t border-tinta/8 px-3 py-2.5">
							<span className="text-[12px] text-tinta/45">
								Selecciona inicio y fin
							</span>
							{rango?.from && (
								<button
									type="button"
									onClick={() => setRango(undefined)}
									className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium text-tinta/60 hover:bg-gris hover:text-tinta"
								>
									<X className="size-3.5" aria-hidden />
									Limpiar
								</button>
							)}
						</div>
					</PopoverContent>
				</Popover>
			</div>

			{/* Cuántos se están viendo. Sin esto, filtrar es a ciegas: no se sabe
			    si quedaron tres porque hay tres o porque el filtro se comió el
			    resto. `aria-live` para quien no ve la lista cambiar. */}
			<p aria-live="polite" className="text-[13px] text-tinta/50">
				{filtrando
					? `${visibles.length} de ${pedidos.length} ${pedidos.length === 1 ? "pedido" : "pedidos"}`
					: `${pedidos.length} ${pedidos.length === 1 ? "pedido" : "pedidos"}`}
			</p>

			{visibles.length === 0 ? (
				<SinResultados
					texto={
						busqueda
							? `No encontramos pedidos que coincidan con “${busqueda}”.`
							: "No hay pedidos con estos filtros."
					}
					accion={{ texto: "Quitar los filtros", alPulsar: limpiar }}
				/>
			) : (
				<>
					{/* Tarjetas por debajo de `md`. */}
					<div className="flex flex-col gap-2.5 md:hidden">
						{visibles.map((pedido, i) => (
							<Elemento key={pedido.id} indice={i}>
								<Tarjeta pedido={pedido} />
							</Elemento>
						))}
					</div>

					<div className="hidden overflow-hidden rounded-[18px] bg-white shadow-[0_1px_2px_rgba(43,40,18,0.025)] md:block">
						<table className="w-full border-collapse text-left">
							<thead className="border-b border-tinta/12">
								<tr className="text-[12px] uppercase tracking-[0.06em] text-tinta/45">
									<Cabecera columna="folio" orden={orden} onOrdenar={alOrdenar}>
										Pedido
									</Cabecera>
									<th className="px-4 py-3 font-normal">Producto</th>
									<th className="px-4 py-3 font-normal">Estado</th>
									<th className="px-4 py-3 text-center font-normal">Piezas</th>
									<Cabecera columna="fecha" orden={orden} onOrdenar={alOrdenar}>
										Recibido
									</Cabecera>
									<Cabecera
										columna="total"
										orden={orden}
										onOrdenar={alOrdenar}
										alineado="right"
									>
										Total
									</Cabecera>
									<th className="w-10 px-2 py-3">
										<span className="sr-only">Abrir</span>
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-tinta/8">
								{visibles.map((pedido, i) => (
									<Fila key={pedido.id} pedido={pedido} indice={i} />
								))}
							</tbody>
						</table>
					</div>
				</>
			)}
		</div>
	);
}

/**
 * Una cabecera que ordena.
 *
 * `aria-sort` es lo que hace que un lector de pantalla anuncie por qué columna
 * va la lista; sin él, la flecha sólo existe para quien la ve. Va en el `<th>`,
 * que es donde el atributo cuenta, y el `<button>` de dentro es lo que se pulsa
 * — un `<th onClick>` sería otra vez el div clicable.
 */
function Cabecera({
	columna,
	orden,
	onOrdenar,
	alineado = "left",
	children,
}: {
	columna: Columna;
	orden: Orden;
	onOrdenar: (columna: Columna) => void;
	alineado?: "left" | "right";
	children: React.ReactNode;
}) {
	const activa = orden.columna === columna;

	return (
		<th
			scope="col"
			aria-sort={activa ? (orden.desc ? "descending" : "ascending") : "none"}
			className={`px-4 py-3 font-normal ${alineado === "right" ? "text-right" : ""}`}
		>
			<button
				type="button"
				onClick={() => onOrdenar(columna)}
				className={`inline-flex items-center gap-1.5 rounded uppercase tracking-[0.06em] transition-colors hover:text-tinta focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta/30 ${
					activa ? "text-tinta" : ""
				}`}
			>
				{children}
				<ArrowUpDown
					className={`size-3.5 ${activa ? "opacity-100" : "opacity-35"}`}
					aria-hidden
				/>
			</button>
		</th>
	);
}

/**
 * Una fila.
 *
 * EL ENLACE ES UN `<a>` DE VERDAD, en la celda del producto. Antes la fila
 * entera era un `<tr onClick tabIndex={0}>` con `aria-label`, o sea un div
 * clicable: un lector de pantalla lo anuncia como fila de tabla y no como algo
 * que lleve a ningún sitio, y no se podía abrir en otra pestaña ni copiar el
 * enlace.
 *
 * El `onClick` del `<tr>` se queda SÓLO como comodidad de ratón —sin
 * `tabIndex`, sin manejador de teclado y sin `aria-label`—, así que no aparece
 * en el árbol de accesibilidad y no duplica nada: quien navega con teclado
 * llega al enlace, que es el que tiene nombre y destino.
 */
function Fila({
	pedido,
	indice,
}: {
	pedido: PedidoDelComprador;
	indice: number;
}) {
	const router = useRouter();
	const estado = ESTADOS_PEDIDO[
		pedido.estado as keyof typeof ESTADOS_PEDIDO
	] ?? { texto: pedido.estado, tono: "gris" as const };

	const primera = pedido.lineas[0];
	const otras = pedido.lineas.length - 1;
	const href = `/cuenta?s=pedido&id=${encodeURIComponent(pedido.id)}`;

	return (
		/* `motion.tr` y no un envoltorio: entre `<tbody>` y `<tr>` no cabe un
		   `<div>` —el navegador lo saca de la tabla y la fila se desmonta— así que
		   la fila se anima ella misma. Es la misma entrada que `Elemento`, escrita
		   aquí porque el elemento HTML tiene que ser otro. */
		<motion.tr
			initial={{ opacity: 0, y: 6 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{
				duration: 0.26,
				ease: CURVA,
				delay: Math.min(indice, 7) * 0.035,
			}}
			onClick={() => router.push(href)}
			className="group cursor-pointer text-[14px] text-tinta transition-colors hover:bg-hueso/45 focus-within:bg-hueso/60"
		>
			<td className="whitespace-nowrap px-4 py-[18px] font-mono text-tinta/65">
				#{pedido.folio}
			</td>

			<td className="px-4 py-[17px]">
				<div className="flex items-center gap-4">
					<Miniatura linea={primera} />
					<div className="min-w-0">
						<p className="truncate text-[15px] font-semibold">
							<Link
								href={href}
								className="rounded outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4"
							>
								{primera?.producto ?? "Pedido"}
							</Link>
							{otras > 0 && (
								<span className="font-normal text-tinta/45">
									{" "}
									y {otras} más
								</span>
							)}
						</p>
						<p className="mt-1 truncate text-[13px] text-tinta/50">
							{primera?.colorPrenda ?? "Sin color"}
							{primera && (
								<>
									{" · "}
									{primera.lados.length}{" "}
									{primera.lados.length === 1 ? "lado" : "lados"}
								</>
							)}
						</p>
					</div>
				</div>
			</td>

			<td className="whitespace-nowrap px-4 py-[18px]">
				<Pastilla tono={estado.tono}>{estado.texto}</Pastilla>
				{/* El número de guía es lo que más se viene a copiar de esta
				    pantalla, y estaba sólo dentro del buscador. */}
				{pedido.guia?.rastreo && (
					<p className="mt-1.5 truncate font-mono text-[12px] text-tinta/45">
						{pedido.guia.rastreo}
					</p>
				)}
			</td>

			<td className="whitespace-nowrap px-4 py-[18px] text-center tabular-nums">
				{pedido.piezas}
			</td>

			{/* La fecha sale de la monoespaciada: `tabular-nums` ya alinea los
			    dígitos, y el mono en un "12 sep 2026" sólo añade ruido. */}
			<td className="whitespace-nowrap px-4 py-[18px] tabular-nums text-tinta/65">
				{fecha(pedido.createdAt)}
			</td>

			<td className="whitespace-nowrap px-4 py-[18px] text-right font-display text-[15px] font-semibold tabular-nums">
				{pesos(pedido.total)}
			</td>

			<td className="w-10 px-2 py-[18px] text-right">
				<ChevronRight
					className="inline size-4 text-tinta/25 transition-transform group-hover:translate-x-0.5 group-hover:text-tinta/50"
					aria-hidden
				/>
			</td>
		</motion.tr>
	);
}

/**
 * El mismo pedido, en el teléfono.
 *
 * Aquí SÍ es un enlace entero: no hay columnas que respetar, así que la tarjeta
 * completa puede ser el destino y no hace falta el apaño del `<tr>`.
 */
function Tarjeta({ pedido }: { pedido: PedidoDelComprador }) {
	const estado = ESTADOS_PEDIDO[
		pedido.estado as keyof typeof ESTADOS_PEDIDO
	] ?? { texto: pedido.estado, tono: "gris" as const };

	const primera = pedido.lineas[0];
	const otras = pedido.lineas.length - 1;

	return (
		<Link
			href={`/cuenta?s=pedido&id=${encodeURIComponent(pedido.id)}`}
			className="flex items-start gap-3.5 rounded-2xl bg-white p-3.5 shadow-[0_1px_2px_rgba(43,40,18,0.025)] transition-colors hover:bg-hueso/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta/30"
		>
			<Miniatura linea={primera} />

			<div className="flex min-w-0 flex-1 flex-col gap-1.5">
				<div className="flex items-start justify-between gap-3">
					<p className="min-w-0 truncate text-[15px] font-semibold text-tinta">
						{primera?.producto ?? "Pedido"}
						{otras > 0 && (
							<span className="font-normal text-tinta/45"> y {otras} más</span>
						)}
					</p>
					<span className="shrink-0 font-display text-[15px] font-semibold tabular-nums text-tinta">
						{pesos(pedido.total)}
					</span>
				</div>

				<p className="truncate text-[13px] text-tinta/50">
					<span className="font-mono">#{pedido.folio}</span> · {pedido.piezas}{" "}
					{pedido.piezas === 1 ? "pieza" : "piezas"} · {fecha(pedido.createdAt)}
				</p>

				<div className="flex flex-wrap items-center gap-2 pt-0.5">
					<Pastilla tono={estado.tono}>{estado.texto}</Pastilla>
					{pedido.guia?.rastreo && (
						<span className="truncate font-mono text-[12px] text-tinta/45">
							{pedido.guia.rastreo}
						</span>
					)}
				</div>
			</div>
		</Link>
	);
}

function Miniatura({
	linea,
}: {
	linea?: { imagen: string | null; producto: string };
}) {
	if (!linea?.imagen) {
		return <div className="size-14 shrink-0 rounded-xl bg-gris" />;
	}

	return (
		// biome-ignore lint/performance/noImgElement: export estático
		<img
			src={linea.imagen}
			alt=""
			className="size-14 shrink-0 rounded-xl bg-gris object-cover p-1.5"
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
		lima: "bg-[#2B2812] text-lima",
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
