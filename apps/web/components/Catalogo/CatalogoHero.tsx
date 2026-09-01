"use client";

import type { Category } from "@/lib/api/categories";
import Aparece from "./Aparece";
import BuscadorCatalogo from "./BuscadorCatalogo";
import { ORDENES, type Orden } from "./ordenar";


type Props = {
	categorias: Category[];
	categoriaActiva: string;
	onCategoria: (id: string) => void;
	orden: Orden;
	onOrden: (orden: Orden) => void;
	total: number | null;
};

export default function CatalogoHero({
	categorias,
	categoriaActiva,
	onCategoria,
	orden,
	onOrden,
	total,
}: Props) {
	const conteo = total === null ? "—" : total;

	return (
		<section className="px-5 pt-8 md:px-14 md:pt-15">
			<Aparece className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-16">
				<h1 className="max-w-[320px] font-display text-[42px] font-extrabold leading-[47px] tracking-[-0.021em] text-tinta md:max-w-[820px] md:text-[66px] md:leading-[72px]">
					Todo el catálogo, listo para llevar tu nombre
				</h1>
				<p className="text-[15px] leading-[26px] text-tinta/60 md:max-w-[300px] md:pb-3">
					Cada pieza la produce un proveedor distinto en México. Tú eliges cuál
					y desde cuántas.
				</p>
			</Aparece>

			<Aparece indice={1}>
				<BuscadorCatalogo
					className="mt-8 md:mt-12"
					sufijo={
						<span className="shrink-0 text-[13px] text-tinta/45 md:text-[15px]">
							<span className="md:hidden">{conteo}</span>
							<span className="hidden md:inline">{conteo} productos</span>
						</span>
					}
				/>
			</Aparece>

			{/* Filtros. En móvil se recorren de lado. */}
			<Aparece
				indice={2}
				className="-mr-5 mt-[18px] flex items-center gap-2 overflow-x-auto pr-5 md:mr-0 md:mt-[22px] md:gap-2.5 md:overflow-visible md:pr-0">
				<Chip
					activo={categoriaActiva === "todo"}
					onClick={() => onCategoria("todo")}
				>
					Todo
				</Chip>
				{categorias.map((c) => (
					<Chip
						key={c.id}
						activo={categoriaActiva === c.id}
						onClick={() => onCategoria(c.id)}
					>
						{c.name}
					</Chip>
				))}

				<span className="hidden flex-1 md:block" />

				<label className="hidden shrink-0 items-center gap-1.5 text-[15px] text-tinta/50 md:flex">
					<span className="sr-only">Ordenar por</span>
					<select
						value={orden}
						onChange={(e) => onOrden(e.target.value as Orden)}
						className="cursor-pointer appearance-none bg-transparent text-[15px] text-tinta/50 outline-none"
					>
						{ORDENES.map((o) => (
							<option key={o.valor} value={o.valor}>
								{o.label}
							</option>
						))}
					</select>
					<span aria-hidden="true">⌄</span>
				</label>
			</Aparece>

			<div className="mt-[18px] flex items-center justify-between gap-3 md:hidden">
				<span className="text-[13px] text-tinta/45">{conteo} productos</span>
				<label className="flex items-center gap-1.5 text-[13px] text-tinta/50">
					<span className="sr-only">Ordenar por</span>
					<select
						value={orden}
						onChange={(e) => onOrden(e.target.value as Orden)}
						className="cursor-pointer appearance-none bg-transparent text-[13px] text-tinta/50 outline-none"
					>
						{ORDENES.map((o) => (
							<option key={o.valor} value={o.valor}>
								{o.label}
							</option>
						))}
					</select>
					<span aria-hidden="true">⌄</span>
				</label>
			</div>
		</section>
	);
}

function Chip({
	activo,
	onClick,
	children,
}: {
	activo: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`shrink-0 rounded-full px-4 py-[9px] text-sm md:px-[17px] md:text-[15px] ${
				activo
					? "bg-lima font-semibold text-tinta"
					: "border-[1.5px] border-tinta/15 font-medium text-tinta"
			}`}
		>
			{children}
		</button>
	);
}
