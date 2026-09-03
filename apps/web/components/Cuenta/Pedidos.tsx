"use client";

import { endOfDay, format, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, Search, X } from "lucide-react";
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
import { useDatosDelPanel } from "./datos";
import { Aviso, Cargando, Vacio } from "./piezas";

type Filtro = "todos" | "en_curso" | "enviado" | "entregado" | "cancelado";

const FILTROS: { id: Filtro; texto: string }[] = [
	{ id: "todos", texto: "Todos" },
	{ id: "en_curso", texto: "En proceso" },
	{ id: "enviado", texto: "En camino" },
	{ id: "entregado", texto: "Entregados" },
	{ id: "cancelado", texto: "Cancelados" },
];

/**
 * Los pedidos de quien entró.
 *
 * Salen por correo, no por cuenta, así que aquí aparecen TAMBIÉN los que hizo
 * antes de registrarse — siempre que usara este mismo correo. No hay que
 * migrar nada para eso: el índice ya está construido así.
 */
export default function Pedidos() {
	const { pedidos, fallo } = useDatosDelPanel();
	const [busqueda, setBusqueda] = useState("");
	const [filtro, setFiltro] = useState<Filtro>("todos");
	const [rango, setRango] = useState<DateRange | undefined>();

	const pedidosFiltrados = useMemo(() => {
		if (!pedidos) return [];
		const termino = busqueda.trim().toLocaleLowerCase("es-MX");

		return pedidos.filter((pedido) => {
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
			if (rango?.from && recibida < startOfDay(rango.from).getTime()) return false;
			if (rango?.to && recibida > endOfDay(rango.to).getTime()) return false;
			if (!termino) return true;

			const estado = ESTADOS_PEDIDO[
				pedido.estado as keyof typeof ESTADOS_PEDIDO
			]?.texto;
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
	}, [busqueda, filtro, pedidos, rango]);

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

	const etiquetaFecha = rango?.from
		? rango.to
			? `${format(rango.from, "d MMM", { locale: es })} – ${format(rango.to, "d MMM yyyy", { locale: es })}`
			: `Desde ${format(rango.from, "d MMM yyyy", { locale: es })}`
		: "Cualquier fecha";

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
				<div className="flex flex-wrap items-center gap-2">
					<div className="flex flex-wrap gap-1.5" aria-label="Filtrar por estado">
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
					</div>
				</div>

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

			<div className="overflow-x-auto rounded-[18px] bg-white shadow-[0_1px_2px_rgba(43,40,18,0.025)]">
				<table className="w-full min-w-[900px] border-collapse text-left">
					<thead className="border-b border-tinta/12 bg-white">
						<tr className="font-mono text-[12px] uppercase tracking-[0.06em] text-tinta/45 [&>th]:font-normal">
							<th className="px-4 py-3">Pedido</th>
							<th className="px-4 py-3">Producto</th>
							<th className="px-4 py-3">Estado</th>
							<th className="px-4 py-3 text-center">Piezas</th>
							<th className="px-4 py-3">Recibido</th>
							<th className="px-4 py-3 text-right">Total</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-tinta/8">
						{pedidosFiltrados.map((pedido) => (
							<Fila key={pedido.id} pedido={pedido} />
						))}
					</tbody>
				</table>

				{pedidosFiltrados.length === 0 && (
					<div className="px-5 py-10 text-center text-[14px] text-tinta/55">
						{busqueda
							? `No encontramos pedidos que coincidan con “${busqueda}”.`
							: "No hay pedidos con estos filtros."}
					</div>
				)}
			</div>
		</div>
	);
}

function Fila({ pedido }: { pedido: PedidoDelComprador }) {
	const router = useRouter();
	const estado = ESTADOS_PEDIDO[
		pedido.estado as keyof typeof ESTADOS_PEDIDO
	] ?? {
		texto: pedido.estado,
		tono: "gris" as const,
	};

	const primera = pedido.lineas[0];
	const otras = pedido.lineas.length - 1;
	const href = `/cuenta?s=pedido&id=${encodeURIComponent(pedido.id)}`;

	return (
		<tr
			onClick={() => router.push(href)}
			onKeyDown={(evento) => {
				if (evento.key === "Enter" || evento.key === " ") {
					evento.preventDefault();
					router.push(href);
				}
			}}
			tabIndex={0}
			aria-label={`Ver pedido ${pedido.folio}`}
			className="cursor-pointer text-[14px] text-tinta transition-colors hover:bg-hueso/45 focus-visible:bg-hueso/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-tinta/25"
		>
			<td className="whitespace-nowrap px-4 py-[18px] font-mono text-tinta/65">
				#{pedido.folio}
			</td>
			<td className="min-w-[330px] px-4 py-[17px]">
				<div className="flex items-center gap-4">
					<Miniatura linea={primera} />
					<div className="min-w-0">
						<p className="truncate text-[15px] font-semibold">
							{primera?.producto ?? "Pedido"}
							{otras > 0 && (
								<span className="font-normal text-tinta/45"> y {otras} más</span>
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
			</td>
			<td className="whitespace-nowrap px-4 py-[18px] text-center font-mono tabular-nums">
				{pedido.piezas}
			</td>
			<td className="whitespace-nowrap px-4 py-[18px] font-mono text-tinta/65">
				{fecha(pedido.createdAt)}
			</td>
			<td className="whitespace-nowrap px-4 py-[18px] text-right font-display text-[15px] font-semibold tabular-nums">
				{pesos(pedido.total)}
			</td>
		</tr>
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
			alt={linea.producto}
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
