"use client";

import type { Category } from "@/lib/api/categories";

export type Filtros = {
	categoria: string;
	tecnicas: string[];
	entregas: string[];
	colores: string[];
	precioMin: string;
	precioMax: string;
};

export const FILTROS_VACIOS: Filtros = {
	categoria: "todo",
	tecnicas: [],
	entregas: [],
	colores: [],
	precioMin: "",
	precioMax: "",
};

/** Los tramos de entrega que ofrece la barra lateral. */
export const ENTREGAS = [
	{ clave: "rapida", label: "Hasta 7 días" },
	{ clave: "media", label: "De 7 a 14 días" },
	{ clave: "lenta", label: "Más de 14 días" },
];

export function tramoEntrega(dias: number | null | undefined) {
	if (dias == null) return null;
	if (dias <= 7) return "rapida";
	if (dias <= 14) return "media";
	return "lenta";
}

type Props = {
	categorias: Category[];
	tecnicas: string[];
	colores: { name: string; hex?: string | null }[];
	filtros: Filtros;
	onFiltros: (f: Filtros) => void;
};

export default function FiltrosProductos({
	categorias,
	tecnicas,
	colores,
	filtros,
	onFiltros,
}: Props) {
	const set = (parcial: Partial<Filtros>) =>
		onFiltros({ ...filtros, ...parcial });

	const alternar = (lista: string[], valor: string) =>
		lista.includes(valor)
			? lista.filter((v) => v !== valor)
			: [...lista, valor];

	const limpio =
		filtros.categoria === "todo" &&
		filtros.tecnicas.length === 0 &&
		filtros.entregas.length === 0 &&
		filtros.colores.length === 0 &&
		!filtros.precioMin &&
		!filtros.precioMax;

	return (
		<div className="flex flex-col gap-8 md:gap-[34px]">
			<div className="flex items-baseline justify-between gap-3 border-b-[1.5px] border-tinta pb-3.5">
				<span className="text-[13px] tracking-[2px] text-tinta">FILTRAR</span>
				<button
					type="button"
					onClick={() => onFiltros(FILTROS_VACIOS)}
					disabled={limpio}
					className="text-[13px] text-tinta/45 enabled:hover:text-lima-oscuro disabled:opacity-40"
				>
					Limpiar
				</button>
			</div>

			<Grupo titulo="CATEGORÍA">
				<Opcion
					activo={filtros.categoria === "todo"}
					onClick={() => set({ categoria: "todo" })}
				>
					Todo
				</Opcion>
				{categorias.map((c) => (
					<Opcion
						key={c.id}
						activo={filtros.categoria === c.id}
						onClick={() => set({ categoria: c.id })}
					>
						{c.name}
					</Opcion>
				))}
			</Grupo>

			{tecnicas.length > 0 && (
				<Grupo titulo="TÉCNICA" conFilete>
					{tecnicas.map((t) => (
						<Opcion
							key={t}
							activo={filtros.tecnicas.includes(t)}
							onClick={() => set({ tecnicas: alternar(filtros.tecnicas, t) })}
						>
							<span className="capitalize">{t}</span>
						</Opcion>
					))}
				</Grupo>
			)}

			<Grupo titulo="ENTREGA" conFilete>
				{ENTREGAS.map((e) => (
					<Opcion
						key={e.clave}
						activo={filtros.entregas.includes(e.clave)}
						onClick={() => set({ entregas: alternar(filtros.entregas, e.clave) })}
					>
						{e.label}
					</Opcion>
				))}
			</Grupo>

			<div className="flex flex-col gap-[15px] border-t border-tinta/14 pt-[26px]">
				<span className="text-xs tracking-[1.6px] text-tinta/45">
					PRECIO POR PIEZA
				</span>
				<div className="flex items-baseline gap-3">
					<input
						type="number"
						inputMode="numeric"
						min={0}
						value={filtros.precioMin}
						onChange={(e) => set({ precioMin: e.target.value })}
						placeholder="$ mín"
						aria-label="Precio mínimo"
						className="w-full min-w-0 border-b border-tinta/30 bg-transparent pb-1.5 text-[15px] text-tinta outline-none placeholder:text-tinta/45"
					/>
					<span className="text-[15px] text-tinta/35">—</span>
					<input
						type="number"
						inputMode="numeric"
						min={0}
						value={filtros.precioMax}
						onChange={(e) => set({ precioMax: e.target.value })}
						placeholder="$ máx"
						aria-label="Precio máximo"
						className="w-full min-w-0 border-b border-tinta/30 bg-transparent pb-1.5 text-[15px] text-tinta outline-none placeholder:text-tinta/45"
					/>
				</div>
			</div>

			{colores.length > 0 && (
				<div className="flex flex-col gap-[13px] border-t border-tinta/14 pt-[26px]">
					<span className="pb-[3px] text-xs tracking-[1.6px] text-tinta/45">
						COLOR
					</span>
					<div className="flex flex-wrap gap-2.5">
						{colores.map((c) => {
							const activo = filtros.colores.includes(c.name);
							return (
								<button
									key={c.name}
									type="button"
									title={c.name}
									aria-label={c.name}
									aria-pressed={activo}
									onClick={() =>
										set({ colores: alternar(filtros.colores, c.name) })
									}
									style={{ background: c.hex ?? "#f3f3f1" }}
									className={`h-[26px] w-[26px] rounded-full ${
										activo
											? "ring-2 ring-tinta ring-offset-2 ring-offset-hueso"
											: "ring-1 ring-tinta/25"
									}`}
								/>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}

function Grupo({
	titulo,
	conFilete = false,
	children,
}: {
	titulo: string;
	conFilete?: boolean;
	children: React.ReactNode;
}) {
	return (
		<div
			className={`flex flex-col gap-[13px] ${
				conFilete ? "border-t border-tinta/14 pt-[26px]" : ""
			}`}
		>
			<span className="pb-[3px] text-xs tracking-[1.6px] text-tinta/45">
				{titulo}
			</span>
			{children}
		</div>
	);
}

function Opcion({
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
			aria-pressed={activo}
			className={`self-start text-left text-base ${
				activo
					? "border-b-[3px] border-lima pb-1 font-semibold text-tinta"
					: "text-tinta/60 hover:text-tinta"
			}`}
		>
			{children}
		</button>
	);
}
