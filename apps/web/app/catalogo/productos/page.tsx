"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearch } from "@/Contexts/SearchContext";
import Aparece from "@/components/Catalogo/Aparece";
import BuscadorCatalogo from "@/components/Catalogo/BuscadorCatalogo";
import FiltrosProductos, {
	FILTROS_VACIOS,
	type Filtros,
	tramoEntrega,
} from "@/components/Catalogo/FiltrosProductos";
import { fichaTecnica } from "@/components/Catalogo/ProductosGrid";
import SearchResults from "@/components/Catalogo/SearchResults";
import { ordenar, ORDENES, type Orden } from "@/components/Catalogo/ordenar";
import { useProductos } from "@/components/Catalogo/useProductos";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProductFromCategory } from "@/lib/api/search";

/** Cuántas piezas se pintan por tanda. */
const TANDA = 16;

export default function Page() {
	const { query } = useSearch();

	const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS);
	const [orden, setOrden] = useState<Orden>("relevancia");
	const [visibles, setVisibles] = useState(TANDA);
	const [panelAbierto, setPanelAbierto] = useState(false);

	const { categorias, productos, cargando } = useProductos(filtros.categoria);

	// Las técnicas y los colores de la barra salen de lo que hay publicado,
	// no de una lista fija.
	const tecnicas = useMemo(() => {
		const set = new Set<string>();
		for (const p of productos) if (p.technique) set.add(p.technique);
		return [...set].sort((a, b) => a.localeCompare(b, "es"));
	}, [productos]);

	const colores = useMemo(() => {
		const porNombre = new Map<string, { name: string; hex?: string | null }>();
		for (const p of productos)
			for (const c of p.colors ?? []) porNombre.set(c.name, c);
		return [...porNombre.values()];
	}, [productos]);

	const filtrados = useMemo(() => {
		const min = filtros.precioMin ? Number(filtros.precioMin) : null;
		const max = filtros.precioMax ? Number(filtros.precioMax) : null;

		const lista = productos.filter((p) => {
			if (filtros.tecnicas.length && !filtros.tecnicas.includes(p.technique ?? ""))
				return false;

			if (filtros.entregas.length) {
				const tramo = tramoEntrega(p.productionDays);
				if (!tramo || !filtros.entregas.includes(tramo)) return false;
			}

			if (filtros.colores.length) {
				const suyos = (p.colors ?? []).map((c) => c.name);
				if (!filtros.colores.some((c) => suyos.includes(c))) return false;
			}

			if (min != null && (p.basePrice ?? 0) < min) return false;
			if (max != null && (p.basePrice ?? 0) > max) return false;

			return true;
		});

		return ordenar(lista, orden);
	}, [productos, filtros, orden]);

	const isSearching = query.trim().length > 0;

	const cambiarFiltros = (f: Filtros) => {
		setFiltros(f);
		setVisibles(TANDA);
	};

	if (isSearching) {
		return (
			<div className="px-5 pt-8 pb-16 md:px-14 md:pt-12">
				<SearchResults query={query} />
			</div>
		);
	}

	return (
		<>
			<section className="px-5 pt-7 md:px-14 md:pt-13">
				<nav className="flex items-center gap-2.5 pb-5 text-[13px] text-tinta/45">
					<Link href="/">Inicio</Link>
					<span aria-hidden="true">/</span>
					<Link href="/catalogo">Catálogo</Link>
					<span aria-hidden="true">/</span>
					<span className="text-tinta">Productos</span>
				</nav>

				<div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-16">
					<h1 className="font-display text-[42px] font-extrabold leading-[47px] tracking-[-0.021em] text-tinta md:text-[62px] md:leading-[70px]">
						Todo el catálogo
					</h1>
					<span className="text-[15px] text-tinta/55 md:pb-3.5">
						{cargando ? "—" : productos.length} productos de{" "}
						{cargando ? "—" : categorias.length} categorías en México
					</span>
				</div>

				<BuscadorCatalogo className="mt-7 md:mt-10" />
			</section>

			<section className="px-5 pt-7 pb-16 md:px-14 md:pt-10 md:pb-22">
				<div className="flex items-start gap-14">
					<Aparece className="hidden w-[220px] shrink-0 md:block">
						<FiltrosProductos
							categorias={categorias}
							tecnicas={tecnicas}
							colores={colores}
							filtros={filtros}
							onFiltros={cambiarFiltros}
						/>
					</Aparece>

					<main className="flex min-w-0 flex-1 flex-col gap-8 md:gap-11">
						<div className="flex items-center justify-between gap-4 border-b border-tinta/14 pb-4 md:pb-[18px]">
							<span className="text-sm text-tinta/55 md:text-[15px]">
								Mostrando {Math.min(visibles, filtrados.length)} de{" "}
								{filtrados.length}
							</span>

							<div className="flex items-center gap-4">
								<button
									type="button"
									onClick={() => setPanelAbierto(true)}
									className="text-sm font-semibold text-tinta md:hidden"
								>
									Filtrar
								</button>
								<label className="flex items-center gap-1.5 text-sm text-tinta/50 md:text-[15px]">
									<span className="sr-only">Ordenar por</span>
									<select
										value={orden}
										onChange={(e) => setOrden(e.target.value as Orden)}
										className="cursor-pointer appearance-none bg-transparent outline-none"
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
						</div>

						{cargando ? (
							<div className="grid grid-cols-2 gap-x-4 gap-y-[26px] md:grid-cols-4 md:gap-x-8 md:gap-y-9">
								{Array.from({ length: 8 }).map((_, i) => (
									<div key={`esqueleto-${i}`} className="flex flex-col gap-3">
										<Skeleton className="h-[158px] w-full md:h-[236px]" />
										<Skeleton className="h-4 w-3/4" />
										<Skeleton className="h-3 w-1/2" />
									</div>
								))}
							</div>
						) : filtrados.length === 0 ? (
							<p className="text-[15px] text-tinta/60">
								Ningún producto cumple con esos filtros. Prueba quitando alguno.
							</p>
						) : (
							<>
								<div className="grid grid-cols-2 gap-x-4 gap-y-[26px] md:grid-cols-4 md:gap-x-8 md:gap-y-9">
									{filtrados.slice(0, visibles).map((p, i) => (
										<Aparece key={p.id} indice={i % 8}>
											<Pieza producto={p} />
										</Aparece>
									))}
								</div>

								{filtrados.length > visibles && (
									<button
										type="button"
										onClick={() => setVisibles((v) => v + TANDA)}
										className="flex items-center justify-center gap-3 border-t-[3px] border-lima py-6 text-lg font-semibold tracking-[-0.5px] text-tinta md:py-[26px] md:text-xl"
									>
										Cargar más productos
										<svg
											width="17"
											height="17"
											viewBox="0 0 14 14"
											fill="none"
											aria-hidden="true"
										>
											<path
												d="M3.5 5.833L7 9.333L10.5 5.833"
												stroke="currentColor"
												strokeWidth="1.7"
												strokeLinecap="round"
												strokeLinejoin="round"
											/>
										</svg>
									</button>
								)}
							</>
						)}
					</main>
				</div>
			</section>

			{/* En móvil los filtros viven en una hoja que sube desde abajo. */}
			{panelAbierto && (
				<div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden">
					<button
						type="button"
						aria-label="Cerrar filtros"
						onClick={() => setPanelAbierto(false)}
						className="absolute inset-0 bg-tinta/40"
					/>
					<div className="relative max-h-[85vh] overflow-y-auto rounded-t-[24px] bg-hueso px-5 pb-8 pt-6">
						<div className="mb-6 flex items-center justify-between">
							<span className="text-lg font-semibold text-tinta">Filtros</span>
							<button
								type="button"
								onClick={() => setPanelAbierto(false)}
								className="flex h-11 w-11 items-center justify-center rounded-lg border-[1.5px] border-tinta"
								aria-label="Cerrar"
							>
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
									<path
										d="M6 6l12 12M18 6L6 18"
										stroke="currentColor"
										strokeWidth="1.9"
										strokeLinecap="round"
									/>
								</svg>
							</button>
						</div>

						<FiltrosProductos
							categorias={categorias}
							tecnicas={tecnicas}
							colores={colores}
							filtros={filtros}
							onFiltros={cambiarFiltros}
						/>

						<button
							type="button"
							onClick={() => setPanelAbierto(false)}
							className="mt-8 flex h-14 w-full items-center justify-center rounded-full bg-lima text-base font-semibold text-tinta"
						>
							Ver {filtrados.length} productos
						</button>
					</div>
				</div>
			)}
		</>
	);
}

function Pieza({ producto }: { producto: ProductFromCategory }) {
	const imagen = producto.images?.[0]?.url;

	return (
		<Link
			href={`/product/${producto.id}`}
			className="flex flex-col gap-3 md:gap-[15px]"
		>
			<div className="flex h-[158px] items-center justify-center md:h-[236px]">
				{imagen ? (
					<Image
						src={imagen}
						alt={producto.name}
						width={320}
						height={400}
						className="max-h-[96%] w-auto max-w-[80%] object-contain md:max-w-[74%]"
					/>
				) : (
					<span className="text-xs text-tinta/40">Sin imagen</span>
				)}
			</div>

			<div className="flex items-baseline justify-between gap-2 border-t border-tinta/14 pt-[11px] md:gap-2.5 md:pt-[13px]">
				<div className="flex min-w-0 flex-col gap-1">
					<span className="text-[15px] font-semibold tracking-[-0.3px] text-tinta md:text-[17px] md:tracking-[-0.4px]">
						{producto.name}
					</span>
					<span className="line-clamp-1 text-[11px] leading-4 text-tinta/50 md:text-xs md:leading-[17px]">
						{fichaTecnica(producto)}
					</span>
				</div>

				{producto.basePrice != null && (
					<span className="whitespace-nowrap text-sm text-tinta/70 md:text-[15px]">
						${producto.basePrice.toLocaleString("es-MX")}
					</span>
				)}
			</div>
		</Link>
	);
}
