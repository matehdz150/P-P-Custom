"use client";

import { Heart, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
	type CategoriaPublica,
	catalogoRecordado,
	categoriasRecordadas,
	getCatalogo,
	getCategoriasPublicas,
	type ProductoDeCatalogo,
} from "@/lib/api/catalogo";
import { useFavoritos } from "@/lib/favoritos/useFavoritos";
import { Elemento } from "./animaciones";
import FichaEnSheet from "./FichaEnSheet";
import { Aviso, Cargando, SinResultados } from "./piezas";
import { TarjetaProducto } from "./TarjetaProducto";

/**
 * Recorrer el catálogo: buscador, categorías y rejilla.
 *
 * ES UNA PIEZA Y NO UNA PANTALLA porque se usa en dos sitios que tienen que
 * verse igual: la sección Catálogo del panel, y el cajón desde el que se
 * eligen productos para una plantilla. Eran dos rejillas distintas y la del
 * cajón nació coja —sin buscar, sin categorías, sin favoritos— justo donde
 * más falta hace, que es cuando estás armando un kit de cinco productos.
 *
 * LO ÚNICO QUE CAMBIA ES A DÓNDE LLEVA LA TARJETA. Sin `onElegir` la ficha es
 * un enlace a diseñar, que es lo que quiere quien mira escaparate; con él es
 * un botón que devuelve el producto a quien la puso. El corazón vive fuera de
 * ese control en los dos casos, así que se puede guardar en favoritos sin
 * elegir y elegir sin guardar.
 */
export default function ExplorarCatalogo({
	onElegir,
}: {
	/** Con esto la tarjeta selecciona en vez de llevar al editor. */
	onElegir?: (producto: ProductoDeCatalogo) => void;
}) {
	const { alternar, esFavorito, ids } = useFavoritos();
	// Lo recordado pinta al instante y se refresca por detrás: el cajón se abre
	// una vez por producto que se agrega y una rueda por apertura sobra.
	const [productos, setProductos] = useState<ProductoDeCatalogo[] | null>(
		catalogoRecordado,
	);
	const [categorias, setCategorias] = useState<CategoriaPublica[]>(
		() => categoriasRecordadas() ?? [],
	);
	const [categoria, setCategoria] = useState<string | null>(null);
	const [busqueda, setBusqueda] = useState("");
	const [soloFavoritos, setSoloFavoritos] = useState(false);
	const [fallo, setFallo] = useState(false);
	/* El producto abierto en el cajón. Sólo se usa mirando escaparate: cuando
	   hay `onElegir` la tarjeta selecciona, y meter un cajón de por medio
	   convertiría cada producto de un kit en dos clics. */
	const [abierto, setAbierto] = useState<ProductoDeCatalogo | null>(null);

	useEffect(() => {
		getCatalogo()
			.then(setProductos)
			// Con algo recordado de una vuelta anterior, un fallo de red no borra
			// lo que ya se está viendo: se queda lo de antes.
			.catch(() => {
				if (!catalogoRecordado()) setFallo(true);
			});

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
			if (soloFavoritos && !ids.includes(p.id)) return false;
			if (categoria && !p.categoryIds.includes(categoria)) return false;
			if (!texto) return true;
			return (
				p.name.toLowerCase().includes(texto) ||
				(p.provider ?? "").toLowerCase().includes(texto)
			);
		});
	}, [productos, categoria, busqueda, soloFavoritos, ids]);

	if (fallo) return <Aviso texto="No pudimos traer el catálogo." />;
	if (!productos) return <Cargando />;

	const filtrando = !!busqueda.trim() || !!categoria || soloFavoritos;

	function limpiar() {
		setBusqueda("");
		setCategoria(null);
		setSoloFavoritos(false);
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
				<div className="relative flex-1">
					<Search
						className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-tinta/40"
						aria-hidden
					/>
					<input
						type="search"
						value={busqueda}
						onChange={(e) => setBusqueda(e.target.value)}
						placeholder="Busca una prenda o un taller"
						aria-label="Buscar en el catálogo"
						className="h-11 w-full rounded-full border-[1.5px] border-tinta/14 bg-white pl-10 pr-4 text-[15px] text-tinta outline-none placeholder:text-tinta/45 focus:border-tinta/30 focus:shadow-[0_0_0_4px_rgba(43,40,18,0.04)]"
					/>
				</div>

				{/* Conecta esta pantalla con la sección de Favoritos, que hasta ahora
				    era un sitio aparte al que había que ir: lo que se guardó desde
				    aquí sólo se podía volver a ver saliendo de aquí. */}
				{ids.length > 0 && (
					<button
						type="button"
						onClick={() => setSoloFavoritos((v) => !v)}
						aria-pressed={soloFavoritos}
						className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-[14px] font-semibold transition-colors ${
							soloFavoritos
								? "bg-tinta text-lima"
								: "border-[1.5px] border-tinta/15 text-tinta hover:border-tinta/40"
						}`}
					>
						<Heart
							className={`size-4 ${soloFavoritos ? "fill-current" : ""}`}
							aria-hidden
						/>
						Favoritos
						<span className="tabular-nums opacity-60">{ids.length}</span>
					</button>
				)}
			</div>

			{/* Los chips ENVUELVEN, no se recortan en una fila con scroll lateral.
			    Con `overflow-x-auto` las categorías del final quedaban fuera de la
			    pantalla sin nada que lo indicara: quien no arrastrara no sabía que
			    existían. */}
			{categorias.length > 0 && (
				<fieldset className="flex min-w-0 flex-wrap gap-2">
					<legend className="sr-only">Filtrar por categoría</legend>
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
				</fieldset>
			)}

			<p aria-live="polite" className="text-[13px] text-tinta/50">
				{filtrando
					? `${visibles.length} de ${productos.length}`
					: `${productos.length} ${productos.length === 1 ? "producto" : "productos"}`}
			</p>

			{visibles.length === 0 ? (
				<SinResultados
					titulo="Nada por aquí"
					texto={
						soloFavoritos
							? "No tienes favoritos que coincidan con esta búsqueda."
							: "Prueba con otra palabra o quita el filtro de categoría."
					}
					accion={{ texto: "Ver todo el catálogo", alPulsar: limpiar }}
				/>
			) : (
				/* La rejilla se ajusta al ANCHO QUE HAY, no al de la ventana. Con
				   `md:grid-cols-3` y compañía, el catálogo metido en la columna
				   izquierda de "armar plantilla" pedía tres columnas en un hueco de
				   la mitad de ancho y las tarjetas salían aplastadas. */
				<div className="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-4 md:gap-5">
					{visibles.map((p, i) => (
						<Elemento key={p.id} indice={i}>
							<TarjetaProducto
								producto={p}
								favorito={esFavorito(p.id)}
								onFavorito={() => alternar(p.id)}
								onElegir={onElegir ? () => onElegir(p) : undefined}
								onAbrir={() => setAbierto(p)}
								// La primera fila entra sin `lazy`: son las que se ven al
								// abrir, y aplazarlas retrasa justo la imagen que mide la
								// carga percibida.
								prioritaria={i < 4}
							/>
						</Elemento>
					))}
				</div>
			)}

			<FichaEnSheet
				producto={abierto}
				onCerrar={() => setAbierto(null)}
				favorito={abierto ? esFavorito(abierto.id) : false}
				onFavorito={() => abierto && alternar(abierto.id)}
			/>
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
			aria-pressed={activa}
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
