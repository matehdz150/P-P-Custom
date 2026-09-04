"use client";

import { AnimatePresence } from "framer-motion";
import { Pencil } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getCatalogo, type ProductoDeCatalogo } from "@/lib/api/catalogo";
import { useFavoritos } from "@/lib/favoritos/useFavoritos";
import { Elemento } from "./animaciones";
import { Aviso, Cargando, Vacio } from "./piezas";
import { TarjetaProducto } from "./TarjetaProducto";

/**
 * Los favoritos.
 *
 * NO ES UN ESCAPARATE, ES UNA LISTA CORTA PARA DECIDIR. Quien llega aquí ya
 * eligió seis cosas y tiene que quedarse con una, así que la tarjeta lleva lo
 * que se compara —plazo, colores, precio, taller— y no sólo el nombre. Es la
 * misma tarjeta que el catálogo, a propósito: ver menos aquí que mirando
 * escaparate no tenía sentido.
 *
 * QUITAR SE PUEDE DESHACER. El corazón es un botón de 36 px encima de una foto
 * que se está mirando, así que se toca sin querer; pero pedir confirmación por
 * apagar un corazón sería aparatoso para lo que cuesta. El punto medio es
 * quitarlo al instante y ofrecer deshacer unos segundos.
 */
export default function Favoritos() {
	const { ids, listo, alternar } = useFavoritos();
	const [productos, setProductos] = useState<ProductoDeCatalogo[] | null>(null);
	const [fallo, setFallo] = useState(false);

	useEffect(() => {
		getCatalogo()
			.then(setProductos)
			.catch(() => setFallo(true));
	}, []);

	if (fallo) return <Aviso texto="No pudimos traer tus favoritos." />;
	if (!listo || !productos) return <Cargando />;

	const favoritos = productos.filter((producto) => ids.includes(producto.id));

	/* Los que ya no están en el catálogo. Antes desaparecían de la rejilla sin
	   más y su id se quedaba guardado para siempre: la pantalla enseñaba dos
	   tarjetas mientras el botón del catálogo decía "Favoritos 3", y nada lo
	   explicaba. Un taller puede despublicar un producto en cualquier momento,
	   así que esto no es un caso raro. */
	const perdidos = ids.length - favoritos.length;

	function quitar(producto: ProductoDeCatalogo) {
		alternar(producto.id);

		toast(`Quitaste ${producto.name}`, {
			action: {
				label: "Deshacer",
				onClick: () => alternar(producto.id),
			},
		});
	}

	function limpiarPerdidos() {
		// Se quitan de golpe los ids que ya no tienen producto. `alternar` va de
		// uno en uno porque es lo que el almacén expone, y son unos pocos.
		const vivos = new Set(productos?.map((p) => p.id));
		for (const id of ids) if (!vivos.has(id)) alternar(id);
	}

	if (favoritos.length === 0) {
		return (
			<Vacio
				titulo="Todavía no tienes favoritos"
				texto="Guarda los productos que te interesen para encontrarlos aquí."
				accion={{ texto: "Explorar catálogo", href: "/cuenta?s=catalogo" }}
			/>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<p className="text-[13px] text-tinta/50">
					{favoritos.length} {favoritos.length === 1 ? "guardado" : "guardados"}
				</p>

				<Link
					href="/cuenta?s=catalogo"
					className="text-[13px] font-semibold text-tinta underline underline-offset-4 hover:text-tinta/70"
				>
					Seguir explorando
				</Link>
			</div>

			{perdidos > 0 && (
				<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-tinta/12 bg-gris px-4 py-3">
					<p className="text-[13px] leading-[21px] text-tinta/70">
						{perdidos === 1
							? "Uno de tus favoritos ya no está publicado."
							: `${perdidos} de tus favoritos ya no están publicados.`}{" "}
						El taller pudo haberlo quitado del catálogo.
					</p>
					<button
						type="button"
						onClick={limpiarPerdidos}
						className="shrink-0 text-[13px] font-semibold text-tinta underline underline-offset-4"
					>
						Quitarlos de la lista
					</button>
				</div>
			)}

			{/* Con `AnimatePresence` la tarjeta se encoge al quitarla en vez de
			    desaparecer de golpe y hacer saltar a las de al lado. */}
			<div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5 xl:grid-cols-4">
				<AnimatePresence initial={false}>
					{favoritos.map((producto, i) => (
						<Elemento key={producto.id} indice={i}>
							<TarjetaProducto
								producto={producto}
								favorito
								onFavorito={() => quitar(producto)}
								prioritaria={i < 4}
								/* La llamada a diseñar, SIEMPRE visible y no al pasar el ratón:
						   en un teléfono no hay ratón, y ahí un control que aparece con
						   el hover sencillamente no existe. Es la razón por la que se
						   guardó el producto, así que merece decirse. */
								pie={
									<Link
										href={`/design/${encodeURIComponent(producto.id)}`}
										className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-tinta text-[13px] font-semibold text-lima"
									>
										<Pencil className="size-3.5" aria-hidden />
										Diseñar
									</Link>
								}
							/>
						</Elemento>
					))}
				</AnimatePresence>
			</div>
		</div>
	);
}
