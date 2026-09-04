"use client";

import { Clock, Heart } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { ProductoDeCatalogo } from "@/lib/api/catalogo";
import { pesos } from "./Pedidos";

/**
 * Un producto del catálogo, en rejilla.
 *
 * LA MISMA EN CATÁLOGO Y EN FAVORITOS. Eran dos tarjetas casi idénticas en dos
 * archivos, y la de favoritos se había quedado atrás: enseñaba nombre, taller y
 * precio mientras la del catálogo ya traía el plazo y los colores. O sea que la
 * pantalla donde se DECIDE entre lo guardado tenía menos con qué decidir que la
 * de mirar escaparate. Con una sola, eso no vuelve a pasar.
 *
 * LLEVA LO QUE DECIDE, no sólo el nombre. En personalización el plazo es la
 * primera pregunta —casi siempre hay una fecha detrás— y el color decide si el
 * diseño va a funcionar encima.
 *
 * QUIÉN ES EL CONTROL lo decide quien la usa, y por eso no hay una sola forma:
 * en el catálogo abre la ficha en un cajón, eligiendo un producto para una
 * plantilla devuelve el elegido, y sin ninguna de las dos es un enlace directo
 * al editor —que es lo que quiere Favoritos, donde ya se decidió—. Envolver la
 * tarjeta entera desde fuera no vale: ni un `<button>` dentro de otro ni un
 * enlace dentro de un botón son HTML válido, y el teclado deja de saber a cuál
 * de los dos va.
 */
export function TarjetaProducto({
	producto,
	favorito,
	onFavorito,
	onElegir,
	onAbrir,
	prioritaria,
	pie,
}: {
	producto: ProductoDeCatalogo;
	favorito?: boolean;
	/** Sin esto no se dibuja el corazón: un botón que no guarda nada estorba. */
	onFavorito?: () => void;
	/** Convierte la ficha en un control de selección en vez de un enlace. */
	onElegir?: () => void;
	/** La abre en el cajón de detalle. Manda `onElegir` si vienen las dos. */
	onAbrir?: () => void;
	prioritaria?: boolean;
	/** Lo que va debajo de la ficha. Favoritos mete aquí su llamada a diseñar. */
	pie?: ReactNode;
}) {
	const colores = producto.colors ?? [];
	/* Elegir manda sobre abrir: en el cajón de armar una plantilla, un clic
	   tiene que agregar el producto y no ponerse a contarlo. */
	const alPulsar = onElegir ?? onAbrir;
	const clasesDeLaFicha =
		"flex flex-col gap-2.5 rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-tinta/40 focus-visible:ring-offset-2";

	const ficha = (
		<>
			<div className="relative overflow-hidden rounded-2xl border border-tinta/10 bg-gris">
				{producto.images[0]?.url ? (
					// biome-ignore lint/performance/noImgElement: export estático
					<img
						src={producto.images[0].url}
						alt=""
						loading={prioritaria ? "eager" : "lazy"}
						className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
					/>
				) : (
					<div className="aspect-square w-full" />
				)}

				{/* El plazo, encima de la foto. Es lo que se compara entre dos
				    talleres que hacen la misma prenda. */}
				{producto.productionDays ? (
					<span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-hueso/95 px-2.5 py-1 text-[11px] font-semibold text-tinta">
						<Clock className="size-3" aria-hidden />
						{producto.productionDays}{" "}
						{producto.productionDays === 1 ? "día" : "días"}
					</span>
				) : null}
			</div>

			<div className="min-w-0">
				<p className="truncate text-[14px] font-semibold text-tinta group-hover:text-lima-oscuro">
					{producto.name}
				</p>
				<p className="truncate text-[12px] text-tinta/55">
					{producto.provider ?? "kustto"}
					{producto.basePrice ? ` · desde ${pesos(producto.basePrice)}` : ""}
				</p>
			</div>
		</>
	);

	return (
		<article className="group relative flex flex-col gap-2.5">
			{alPulsar ? (
				<button
					type="button"
					onClick={alPulsar}
					className={clasesDeLaFicha}
					aria-label={
						onElegir ? `Elegir ${producto.name}` : `Ver ${producto.name}`
					}
				>
					{ficha}
				</button>
			) : (
				<Link
					href={`/design/${encodeURIComponent(producto.id)}`}
					className={clasesDeLaFicha}
				>
					{ficha}
				</Link>
			)}

			{colores.length > 0 && <Colores colores={colores} />}

			{pie}

			{/* Fuera del enlace, no dentro: un botón anidado en un `<a>` es HTML
			    inválido y el teclado no sabe a cuál de los dos va. */}
			{onFavorito && (
				<button
					type="button"
					onClick={onFavorito}
					aria-pressed={favorito}
					aria-label={
						favorito
							? `Quitar ${producto.name} de favoritos`
							: `Guardar ${producto.name} en favoritos`
					}
					className={`absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-full bg-white/95 shadow-sm transition-colors ${
						favorito ? "text-tinta" : "text-tinta/45 hover:text-tinta"
					}`}
				>
					<Heart
						className={`size-[17px] ${favorito ? "fill-current" : ""}`}
						aria-hidden
					/>
				</button>
			)}
		</article>
	);
}

/**
 * Los colores en los que existe la prenda.
 *
 * Se enseñan cinco y se cuenta el resto: una fila de doce puntos deja de
 * leerse como "hay muchos" y pasa a ser ruido.
 *
 * EL NOMBRE VA EN TEXTO, no sólo en el punto. Un color contado únicamente por
 * su tono no existe para quien no lo distingue —ni para un lector de
 * pantalla—, así que la lista lleva su nombre accesible.
 */
function Colores({
	colores,
}: {
	colores: { name: string; hex?: string | null }[];
}) {
	const visibles = colores.slice(0, 5);
	const resto = colores.length - visibles.length;

	return (
		<ul className="flex items-center gap-1.5" aria-label="Colores disponibles">
			{visibles.map((c) => (
				<li key={c.name} className="flex">
					<span
						className="size-[15px] rounded-full border border-tinta/20"
						style={{ backgroundColor: c.hex ?? "#f3f3f1" }}
					/>
					<span className="sr-only">{c.name}</span>
				</li>
			))}
			{resto > 0 && (
				<li className="text-[11px] font-medium text-tinta/50">+{resto}</li>
			)}
		</ul>
	);
}
