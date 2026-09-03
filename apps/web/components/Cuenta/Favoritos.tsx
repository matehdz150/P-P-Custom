"use client";

import { Heart } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getCatalogo, type ProductoDeCatalogo } from "@/lib/api/catalogo";
import { useFavoritos } from "@/lib/favoritos/useFavoritos";
import { pesos } from "./Pedidos";
import { Aviso, Cargando, Vacio } from "./piezas";

export default function Favoritos() {
	const { ids, listo, alternar } = useFavoritos();
	const [productos, setProductos] = useState<ProductoDeCatalogo[] | null>(null);
	const [fallo, setFallo] = useState(false);

	useEffect(() => {
		getCatalogo().then(setProductos).catch(() => setFallo(true));
	}, []);

	if (fallo) return <Aviso texto="No pudimos traer tus favoritos." />;
	if (!listo || !productos) return <Cargando />;

	const favoritos = productos.filter((producto) => ids.includes(producto.id));
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
		<div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
			{favoritos.map((producto) => (
				<article key={producto.id} className="group relative overflow-hidden rounded-2xl border border-tinta/10 bg-white">
					<Link href={`/design/${encodeURIComponent(producto.id)}`}>
						{producto.images[0]?.url ? (
							// biome-ignore lint/performance/noImgElement: export estático
							<img src={producto.images[0].url} alt="" className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
						) : (
							<div className="aspect-square bg-gris" />
						)}
						<div className="p-4">
							<p className="truncate text-[14px] font-semibold text-tinta">{producto.name}</p>
							<p className="mt-1 truncate text-[12px] text-tinta/50">
								{producto.provider ?? "kustto"}
								{producto.basePrice ? ` · desde ${pesos(producto.basePrice)}` : ""}
							</p>
						</div>
					</Link>
					<button
						type="button"
						onClick={() => alternar(producto.id)}
						aria-label={`Quitar ${producto.name} de favoritos`}
						className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-full bg-white/95 text-tinta shadow-sm"
					>
						<Heart className="size-[17px] fill-current" aria-hidden />
					</button>
				</article>
			))}
		</div>
	);
}
