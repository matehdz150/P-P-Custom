"use client";

import Image from "next/image";
import { useState } from "react";
import { usePedidos } from "@/Contexts/PedidosContext";
import {
	type EstadoPedido,
	ETIQUETA_ESTADO,
	type Pedido,
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
};

export default function PedidosPage() {
	const { pedidos, cargando } = usePedidos();
	const [filtro, setFiltro] = useState<EstadoPedido | "todos">("todos");

	const visibles =
		filtro === "todos" ? pedidos : pedidos.filter((p) => p.estado === filtro);

	return (
		<div className="flex flex-col">
			<div className="flex items-baseline justify-between gap-6">
				<h1 className="font-display text-[30px] font-semibold leading-[38px] tracking-[-0.032em] text-tinta">
					Pedidos
				</h1>
			</div>

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
			) : pedidos.length === 0 ? (
				<SinPedidos />
			) : (
				<Tabla pedidos={visibles} />
			)}
		</div>
	);
}

function Tabla({ pedidos }: { pedidos: Pedido[] }) {
	return (
		<div className="flex flex-col pt-[26px]">
			<div className="flex items-center gap-5 pb-[11px]">
				<Columna className="w-[92px]">FOLIO</Columna>
				<Columna className="flex-1">PRODUCTO</Columna>
				<Columna className="w-[86px]">PIEZAS</Columna>
				<Columna className="w-[130px]">ENTREGA</Columna>
				<Columna className="w-[130px]">ESTADO</Columna>
				<span className="w-5" />
			</div>

			{pedidos.map((p) => (
				<div
					key={p.id}
					className={`flex items-center gap-5 border-t border-tinta/12 py-3.5 ${
						p.estado === "entregado" ? "opacity-55" : ""
					}`}
				>
					<span className="font-mono w-[92px] text-[13px] text-tinta/60">
						{p.folio}
					</span>

					<div className="flex flex-1 items-center gap-3.5">
						<div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-lg bg-gris">
							{p.imagen ? (
								<Image
									src={p.imagen}
									alt=""
									width={80}
									height={100}
									className="max-h-[84%] w-auto max-w-[74%] object-contain"
								/>
							) : null}
						</div>
						<div className="flex min-w-0 flex-col gap-[3px]">
							<span className="truncate text-[15px] font-semibold text-tinta">
								{p.producto}
							</span>
							<span className="truncate text-[13px] text-tinta/55">
								{[p.tecnica, p.lado, p.colorPrenda].filter(Boolean).join(" · ")}
							</span>
						</div>
					</div>

					<span className="font-mono w-[86px] text-sm text-tinta">
						{p.piezas}
					</span>
					<span className="w-[130px] text-sm text-tinta">{p.entregaEl}</span>
					<span className="w-[130px]">
						<span
							className={`inline-flex rounded-lg px-3 py-[5px] text-xs font-semibold ${TONO[p.estado]}`}
						>
							{ETIQUETA_ESTADO[p.estado]}
						</span>
					</span>

					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						aria-hidden="true"
						className="opacity-40"
					>
						<path
							d="M9.5 6l6 6-6 6"
							stroke="currentColor"
							strokeWidth="1.7"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				</div>
			))}

			<div className="border-t border-tinta/12" />
		</div>
	);
}

/**
 * Estado vacío honesto. Hoy es el único que se ve: todavía no existe el
 * modelo de pedidos en la API.
 */
function SinPedidos() {
	return (
		<div className="mt-8 flex flex-col items-start gap-3 rounded-xl border border-tinta/12 bg-hueso px-8 py-12">
			<h2 className="font-display text-[22px] font-semibold leading-7 tracking-[-0.032em] text-tinta">
				Todavía no te asignamos pedidos
			</h2>
			<p className="max-w-[520px] text-[15px] leading-[26px] text-tinta/70">
				Cuando un cliente compre uno de tus productos, el pedido aparece aquí
				con su archivo, el lado, el color y las tallas ya definidos. Te avisamos
				por correo en cuanto llegue el primero.
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
