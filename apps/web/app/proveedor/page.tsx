"use client";

import Image from "next/image";
import { useState } from "react";
import { usePedidos } from "@/Contexts/PedidosContext";
import { PedidoSheet } from "@/components/Proveedor/PedidoSheet";
import {
	cambiarEstadoPedido,
	type EstadoPedido,
	ETIQUETA_ESTADO,
	type Pedido,
	SIGUIENTE_ESTADO,
} from "@/lib/api/pedidos";

const FILTROS: { valor: EstadoPedido | "todos"; label: string }[] = [
	{ valor: "todos", label: "Todos" },
	{ valor: "nuevo", label: "Nuevos" },
	{ valor: "produccion", label: "En producción" },
	{ valor: "listo", label: "Listos" },
	{ valor: "entregado", label: "Entregados" },
];

/** Lima lo recién llegado, lavanda lo que está en curso, el resto sin fondo. */
const TONO: Record<EstadoPedido, string> = {
	nuevo: "bg-lima text-tinta",
	produccion: "bg-lavanda text-tinta",
	listo: "border-[1.5px] border-tinta/20 text-tinta",
	entregado: "text-tinta/60",
	cancelado: "text-tinta/45 line-through",
};

const FECHA = new Intl.DateTimeFormat("es-MX", {
	day: "2-digit",
	month: "short",
});

export default function PedidosPage() {
	const { pedidos, cargando, fallo, refresh, recienLlegados, marcarVistos } =
		usePedidos();
	const [filtro, setFiltro] = useState<EstadoPedido | "todos">("todos");
	/** Cuál está abierto en la ficha. Se guarda el id y no el pedido: así, al
	    recargar la lista, la ficha enseña lo recién traído y no una copia vieja. */
	const [abiertoId, setAbiertoId] = useState<string | null>(null);

	const visibles =
		filtro === "todos" ? pedidos : pedidos.filter((p) => p.estado === filtro);

	return (
		<div className="flex flex-col">
			<div className="flex items-baseline justify-between gap-6">
				<h1 className="font-display text-[30px] font-semibold leading-[38px] tracking-[-0.032em] text-tinta">
					Pedidos
				</h1>
			</div>

			{recienLlegados.length > 0 && (
				<button
					type="button"
					onClick={marcarVistos}
					className="mt-5 flex items-center justify-between gap-4 rounded-lg bg-lima px-4 py-3 text-left"
				>
					<span className="text-[14px] font-semibold text-tinta">
						{recienLlegados.length === 1
							? "Llegó un pedido nuevo"
							: `Llegaron ${recienLlegados.length} pedidos nuevos`}
					</span>
					<span className="text-[13px] font-semibold text-tinta/60">
						Entendido
					</span>
				</button>
			)}

			{pedidos.length > 0 && (
				<div className="flex items-center gap-2 pt-[22px]">
					{FILTROS.map((f) => (
						<button
							key={f.valor}
							type="button"
							onClick={() => setFiltro(f.valor)}
							aria-pressed={filtro === f.valor}
							className={`flex h-9 items-center rounded-lg px-3.5 text-sm ${
								filtro === f.valor
									? "bg-tinta font-semibold text-lima"
									: "border-[1.5px] border-tinta/15 font-medium text-tinta"
							}`}
						>
							{f.label}
						</button>
					))}
				</div>
			)}

			{cargando ? (
				<p className="pt-8 text-[15px] text-tinta/60">Cargando…</p>
			) : fallo ? (
				<NoCargo mensaje={fallo} onReintentar={refresh} />
			) : pedidos.length === 0 ? (
				<SinPedidos />
			) : (
				<Tabla
					pedidos={visibles}
					onCambio={refresh}
					recienLlegados={recienLlegados}
					onAbrir={setAbiertoId}
				/>
			)}

			<PedidoSheet
				pedido={pedidos.find((p) => p.id === abiertoId) ?? null}
				abierto={abiertoId !== null}
				onCerrar={() => setAbiertoId(null)}
				onCambio={refresh}
			/>
		</div>
	);
}

function Tabla({
	pedidos,
	onCambio,
	recienLlegados,
	onAbrir,
}: {
	pedidos: Pedido[];
	onCambio: () => Promise<void>;
	recienLlegados: string[];
	onAbrir: (id: string) => void;
}) {
	return (
		<div className="flex flex-col pt-[26px]">
			<div className="flex items-center gap-5 pb-[11px]">
				<Columna className="w-[76px]">FOLIO</Columna>
				<Columna className="flex-1">PRODUCTO</Columna>
				<Columna className="w-[70px]">PIEZAS</Columna>
				<Columna className="w-[92px]">RECIBIDO</Columna>
				<Columna className="w-[124px]">ESTADO</Columna>
				<Columna className="w-[150px]">ACCIÓN</Columna>
			</div>

			{pedidos.map((p) => (
				<Renglon
					key={p.id}
					pedido={p}
					onCambio={onCambio}
					recienLlegado={recienLlegados.includes(p.id)}
					onAbrir={onAbrir}
				/>
			))}

			<div className="border-t border-tinta/12" />
		</div>
	);
}

function Renglon({
	pedido,
	onCambio,
	recienLlegado,
	onAbrir,
}: {
	pedido: Pedido;
	onCambio: () => Promise<void>;
	/** Entró con el panel ya abierto: se resalta para que no pase de largo. */
	recienLlegado: boolean;
	onAbrir: (id: string) => void;
}) {
	const [moviendo, setMoviendo] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const primera = pedido.lineas[0];
	const otras = pedido.lineas.length - 1;

	// El siguiente paso natural es el primero de la lista; cancelar va aparte
	// para que no quede a un clic de distancia del botón de avanzar.
	const siguiente = SIGUIENTE_ESTADO[pedido.estado].filter(
		(e) => e !== "cancelado",
	)[0];

	async function mover(destino: EstadoPedido) {
		if (moviendo) return;
		setMoviendo(true);
		setError(null);

		try {
			await cambiarEstadoPedido(pedido.id, destino);
			await onCambio();
		} catch (e) {
			setError(e instanceof Error ? e.message : "No se pudo mover");
			setMoviendo(false);
		}
	}

	const detalle = [
		primera?.colorPrenda,
		primera?.lados.join(" + "),
		otras > 0 ? `y ${otras} producto${otras === 1 ? "" : "s"} más` : null,
	]
		.filter(Boolean)
		.join(" · ");

	return (
		<div
			className={`flex items-center gap-5 border-t border-tinta/12 py-3.5 ${
				pedido.estado === "entregado" || pedido.estado === "cancelado"
					? "opacity-55"
					: ""
			} ${recienLlegado ? "-mx-3 rounded-lg bg-lima/25 px-3" : ""}`}
		>
			{/* Todo el renglón menos la acción abre la ficha. Es un `button` de
			    verdad y no un `div` con onClick: así se llega con el tabulador y
			    responde al Enter, que es como navega quien produce todo el día. */}
			<button
				type="button"
				onClick={() => onAbrir(pedido.id)}
				aria-label={`Ver el pedido ${pedido.folio}`}
				className="-my-1.5 flex flex-1 items-center gap-5 rounded-lg py-1.5 text-left transition-colors hover:bg-tinta/4"
			>
				<span className="font-mono w-[76px] text-[13px] text-tinta/60">
					{pedido.folio}
				</span>

				<div className="flex flex-1 items-center gap-3.5">
					<div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-lg bg-gris">
						{primera?.imagen ? (
							<Image
								src={primera.imagen}
								alt=""
								width={80}
								height={100}
								className="max-h-[84%] w-auto max-w-[74%] object-contain"
							/>
						) : null}
					</div>
					<div className="flex min-w-0 flex-col gap-[3px]">
						<span className="truncate text-[15px] font-semibold text-tinta">
							{primera?.producto ?? "—"}
						</span>
						<span className="truncate text-[13px] text-tinta/55">
							{detalle}
						</span>
					</div>
				</div>

				<span className="font-mono w-[70px] text-sm text-tinta">
					{pedido.piezas}
				</span>

				<span className="w-[92px] text-sm text-tinta">
					{FECHA.format(new Date(pedido.createdAt))}
				</span>

				<span className="w-[124px]">
					<span
						className={`inline-flex rounded-lg px-3 py-[5px] text-xs font-semibold ${TONO[pedido.estado]}`}
					>
						{ETIQUETA_ESTADO[pedido.estado]}
					</span>
				</span>
			</button>

			<div className="flex w-[150px] shrink-0 flex-col items-start gap-1">
				{siguiente ? (
					<button
						type="button"
						onClick={() => mover(siguiente)}
						disabled={moviendo}
						className="flex h-9 items-center rounded-lg bg-tinta px-3.5 text-[13px] font-semibold text-lima disabled:opacity-50"
					>
						{moviendo ? "Moviendo…" : `Marcar ${ETIQUETA_ESTADO[siguiente]}`}
					</button>
				) : (
					<span className="text-[13px] text-tinta/40">—</span>
				)}

				{error && (
					<span role="alert" className="text-[12px] leading-4 text-[#c0392b]">
						{error}
					</span>
				)}
			</div>
		</div>
	);
}

/**
 * La lista no cargó. Es distinto de no tener pedidos, y decirlo mal haría que
 * un taller con trabajo pendiente creyera que no le llegó nada.
 */
function NoCargo({
	mensaje,
	onReintentar,
}: {
	mensaje: string;
	onReintentar: () => Promise<void>;
}) {
	return (
		<div className="mt-8 flex flex-col items-start gap-3 rounded-xl border border-[#c0392b]/25 bg-hueso px-8 py-10">
			<h2 className="font-display text-[20px] font-semibold tracking-[-0.032em] text-tinta">
				No pudimos cargar tus pedidos
			</h2>
			<p className="max-w-[520px] text-[15px] leading-[26px] text-tinta/70">
				{mensaje}
			</p>
			<button
				type="button"
				onClick={onReintentar}
				className="mt-1 flex h-10 items-center rounded-lg bg-tinta px-4 text-sm font-semibold text-lima"
			>
				Reintentar
			</button>
		</div>
	);
}

function SinPedidos() {
	return (
		<div className="mt-8 flex flex-col items-start gap-3 rounded-xl border border-tinta/12 bg-hueso px-8 py-12">
			<h2 className="font-display text-[22px] font-semibold leading-7 tracking-[-0.032em] text-tinta">
				Todavía no tienes pedidos
			</h2>
			<p className="max-w-[520px] text-[15px] leading-[26px] text-tinta/70">
				Cuando alguien compre uno de tus productos, el pedido aparece aquí con
				su archivo de producción, el lado, el color y las tallas ya definidos.
			</p>
		</div>
	);
}

function Columna({
	children,
	className,
}: {
	children: string;
	className?: string;
}) {
	return (
		<span
			className={`font-mono text-[11px] tracking-[0.7px] text-tinta/50 ${className ?? ""}`}
		>
			{children}
		</span>
	);
}
