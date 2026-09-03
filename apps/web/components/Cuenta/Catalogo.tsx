"use client";

import { Heart } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
	type CategoriaPublica,
	getCatalogo,
	getCategoriasPublicas,
	type ProductoDeCatalogo,
} from "@/lib/api/catalogo";
import { useFavoritos } from "@/lib/favoritos/useFavoritos";
import { pesos } from "./Pedidos";
import { Aviso, Cargando, Vacio } from "./piezas";

/**
 * El catálogo, dentro del panel.
 *
 * Es el mismo endpoint público que la tienda (`getCatalogo`, sin credenciales
 * de ningún tipo), no una copia: si el catálogo cambia, esto cambia. Lo que
 * cambia es el destino — desde aquí se va directo a diseñar, porque quien está
 * en su panel ya decidió que quiere hacer algo.
 */
export default function CatalogoEnPanel() {
	const { alternar, esFavorito } = useFavoritos();
	const [productos, setProductos] = useState<ProductoDeCatalogo[] | null>(null);
	const [categorias, setCategorias] = useState<CategoriaPublica[]>([]);
	const [categoria, setCategoria] = useState<string | null>(null);
	const [busqueda, setBusqueda] = useState("");
	const [fallo, setFallo] = useState(false);

	useEffect(() => {
		getCatalogo()
			.then(setProductos)
			.catch(() => setFallo(true));
		// Las categorías son un adorno del filtro: si fallan, el catálogo se
		// enseña igual sin ellas.
		getCategoriasPublicas()
			.then(setCategorias)
			.catch(() => {});
	}, []);

	const visibles = useMemo(() => {
		if (!productos) return [];
		const texto = busqueda.trim().toLowerCase();

		return productos.filter((p) => {
			if (categoria && !p.categoryIds.includes(categoria)) return false;
			if (!texto) return true;
			return (
				p.name.toLowerCase().includes(texto) ||
				(p.provider ?? "").toLowerCase().includes(texto)
			);
		});
	}, [productos, categoria, busqueda]);

	if (fallo) return <Aviso texto="No pudimos traer el catálogo." />;
	if (!productos) return <Cargando />;

	return (
		<div className="flex flex-col gap-5">
			<div className="flex flex-col gap-3 md:flex-row md:items-center">
				<input
					type="search"
					value={busqueda}
					onChange={(e) => setBusqueda(e.target.value)}
					placeholder="Busca una prenda o un taller"
					className="h-11 flex-1 rounded-full border-[1.5px] border-tinta/14 bg-white px-4 text-[15px] text-tinta outline-none placeholder:text-tinta/45 focus:border-tinta/30 focus:shadow-[0_0_0_4px_rgba(43,40,18,0.04)]"
				/>
			</div>

			{categorias.length > 0 && (
				<div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
					<Ficha
						activa={categoria === null}
						alPulsar={() => setCategoria(null)}
					>
						Todo
					</Ficha>
					{categorias.map((c) => (
						<Ficha
							key={c.id}
							activa={categoria === c.id}
							alPulsar={() => setCategoria(c.id)}
						>
							{c.name}
						</Ficha>
					))}
				</div>
			)}

			{visibles.length === 0 ? (
				<Vacio
					titulo="Nada por aquí"
					texto="Prueba con otra palabra o quita el filtro de categoría."
				/>
			) : (
				<div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
					{visibles.map((p) => (
						<article key={p.id} className="group relative flex flex-col gap-2.5">
							<Link href={`/design/${encodeURIComponent(p.id)}`}>
							<div className="overflow-hidden rounded-2xl border border-tinta/10 bg-gris">
								{p.images[0]?.url ? (
									// biome-ignore lint/performance/noImgElement: export estático
									<img
										src={p.images[0].url}
										alt=""
										loading="lazy"
										className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
									/>
								) : (
									<div className="aspect-square w-full" />
								)}
							</div>
							<div className="min-w-0">
								<p className="truncate text-[14px] font-semibold text-tinta group-hover:text-lima-oscuro">
									{p.name}
								</p>
								<p className="truncate text-[12px] text-tinta/55">
									{p.provider ?? "kustto"}
									{p.basePrice ? ` · desde ${pesos(p.basePrice)}` : ""}
								</p>
							</div>
							</Link>
							<button
								type="button"
								onClick={() => alternar(p.id)}
								aria-label={
									esFavorito(p.id)
										? `Quitar ${p.name} de favoritos`
										: `Guardar ${p.name} en favoritos`
								}
								className={`absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-full bg-white/95 shadow-sm transition-colors ${
									esFavorito(p.id) ? "text-tinta" : "text-tinta/45 hover:text-tinta"
								}`}
							>
								<Heart
									className={`size-[17px] ${esFavorito(p.id) ? "fill-current" : ""}`}
									aria-hidden
								/>
							</button>
						</article>
					))}
				</div>
			)}
		</div>
	);
}

function Ficha({
	activa,
	alPulsar,
	children,
}: {
	activa: boolean;
	alPulsar: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={alPulsar}
			className={`h-9 shrink-0 whitespace-nowrap rounded-full px-4 text-[14px] font-semibold transition-colors ${
				activa
					? "bg-tinta text-lima"
					: "border-[1.5px] border-tinta/15 text-tinta hover:border-tinta/40"
			}`}
		>
			{children}
		</button>
	);
}
