"use client";

import { recargoDeLado } from "@kustto/precios";
import { Clock, Heart, Pencil } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetTitle,
} from "@/components/ui/sheet";
import {
	type FichaDeProducto,
	fichaRecordada,
	getFichaDeProducto,
	type ProductoDeCatalogo,
} from "@/lib/api/catalogo";
import { pesos } from "./Pedidos";

/**
 * La X de cerrar, vestida para ir encima de una foto.
 *
 * El cajón la dibuja él —es suya, no la ponemos nosotros— y por defecto es un
 * aspa oscura sin fondo en la esquina. Aquí la esquina es la foto del producto,
 * y sobre una prenda clara el aspa desaparece. Se le pone un disco de hueso
 * desde fuera en vez de tocar `components/ui/sheet.tsx`, que lo usan también
 * los pedidos del taller y ahí la X está bien como está.
 */
const CERRAR =
	"[&_[data-slot=sheet-dismiss]]:top-3.5 [&_[data-slot=sheet-dismiss]]:right-3.5 [&_[data-slot=sheet-dismiss]]:flex [&_[data-slot=sheet-dismiss]]:size-9 [&_[data-slot=sheet-dismiss]]:items-center [&_[data-slot=sheet-dismiss]]:justify-center [&_[data-slot=sheet-dismiss]]:rounded-full [&_[data-slot=sheet-dismiss]]:bg-hueso/90 [&_[data-slot=sheet-dismiss]]:text-tinta [&_[data-slot=sheet-dismiss]]:opacity-100 [&_[data-slot=sheet-dismiss]]:hover:bg-hueso";

/**
 * La ficha de un producto, en un cajón lateral.
 *
 * POR QUÉ UN CAJÓN Y NO OTRA PÁGINA. Mirar catálogo es comparar: se abre uno,
 * se cierra, se abre el de al lado. Con una ruta aparte cada comparación
 * cuesta dos navegaciones y se pierden los filtros y la posición del scroll.
 * El cajón deja la rejilla detrás, tal como estaba.
 *
 * ABRE CON LO QUE YA HAY Y COMPLETA DESPUÉS. La lista del catálogo ya trae
 * foto, precio, plazo, colores y tallas, así que eso se pinta sin esperar a
 * nadie. Lo único que falta —cómo se llaman los lados imprimibles, qué cuesta
 * cada lado extra, cuántos diseños admite— vive en la ficha, y ésa sí es una
 * petición. Enseñar una rueda sobre el cajón entero mientras llega sería
 * cambiar un cajón instantáneo por uno lento a cambio de un dato secundario.
 *
 * EL BOTÓN DE DISEÑAR NO SCROLLEA. Es la razón por la que alguien abre esto,
 * y en un cajón de teléfono la descripción y las tallas lo empujarían fuera de
 * la pantalla. Va en un pie que no se mueve, y el cuerpo scrollea por dentro
 * —columna flex con el pie fuera del área que scrollea, no `position: fixed`,
 * que taparía el final del contenido.
 */
export default function FichaEnSheet({
	producto,
	onCerrar,
	favorito,
	onFavorito,
}: {
	/** `null` con el cajón cerrado: un solo estado manda. */
	producto: ProductoDeCatalogo | null;
	onCerrar: () => void;
	favorito: boolean;
	onFavorito: () => void;
}) {
	/* El último que se enseñó, para que el contenido no se evapore a mitad de
	   la animación de cierre: `producto` se pone en `null` al cerrar y el cajón
	   tarda 300 ms en irse. Sin esto, se va vacío. */
	const [ultimo, setUltimo] = useState<ProductoDeCatalogo | null>(producto);
	const [ficha, setFicha] = useState<FichaDeProducto | null>(null);
	const [buscandoFicha, setBuscandoFicha] = useState(false);

	const id = producto?.id;

	useEffect(() => {
		if (!producto) return;
		setUltimo(producto);
	}, [producto]);

	useEffect(() => {
		if (!id) return;

		const recordada = fichaRecordada(id);
		setFicha(recordada);
		setBuscandoFicha(!recordada);
		if (recordada) return;

		/* `vivo` corta la carrera de abrir uno y saltar al siguiente antes de que
		   conteste el primero: sin esto, la respuesta vieja pisa la nueva y el
		   cajón acaba enseñando los lados de otro producto. */
		let vivo = true;

		getFichaDeProducto(id)
			.then((traida) => {
				if (vivo) setFicha(traida);
			})
			// Sin ficha el cajón sigue en pie con lo de la lista, que es casi todo.
			.catch(() => {})
			.finally(() => {
				if (vivo) setBuscandoFicha(false);
			});

		return () => {
			vivo = false;
		};
	}, [id]);

	const p = producto ?? ultimo;
	if (!p) return null;

	const imagenes = p.images ?? [];
	const colores = p.colors ?? [];
	const tallas = p.sizes ?? [];

	return (
		<Sheet open={!!producto} onOpenChange={(abierto) => !abierto && onCerrar()}>
			<SheetContent
				side="right"
				/* Ancho completo en el teléfono: el 3/4 que trae por defecto deja
				   una franja de fondo inútil y le quita 90 px a la foto. */
				className={`flex w-full flex-col gap-0 border-tinta/12 bg-hueso p-0 sm:max-w-[460px] ${CERRAR}`}
			>
				<div className="min-h-0 flex-1 overflow-y-auto">
					{/* La foto arranca a sangre, sin cabecera encima: el nombre va
					    debajo, en el bloque oscuro. */}
					<div className="relative h-[280px] shrink-0 bg-gris sm:h-[300px]">
						{imagenes[0]?.url ? (
							// biome-ignore lint/performance/noImgElement: export estático
							<img
								src={imagenes[0].url}
								alt={p.name}
								/* Encuadre alto: los mockups llevan la prenda arriba y el
								   centro deja fuera medio cuello. */
								className="size-full object-cover object-[50%_22%]"
							/>
						) : null}

						{p.productionDays ? (
							<span className="absolute bottom-3.5 left-3.5 inline-flex items-center gap-1.5 rounded-full bg-hueso/95 px-3 py-1.5 text-[12px] font-semibold text-tinta">
								<Clock className="size-3.5" aria-hidden />
								Listo en {p.productionDays}{" "}
								{p.productionDays === 1 ? "día" : "días"}
							</span>
						) : null}
					</div>

					{/* El bloque oscuro: nombre, taller y precio juntos. Es la misma
					    figura que la tarjeta del pedido en curso del panel, y sirve
					    para lo mismo —decir de un vistazo qué es esto y qué cuesta—
					    sin repetir el precio otra vez abajo. */}
					<div className="flex flex-col gap-2.5 bg-tinta px-5 py-5 text-hueso">
						<div className="flex flex-col gap-1">
							<SheetTitle className="font-display text-[23px] font-bold leading-[1.15] tracking-[-0.02em] text-hueso">
								{p.name}
							</SheetTitle>
							<SheetDescription className="text-[13px] text-hueso/55">
								{[p.provider, p.technique].filter(Boolean).join(" · ") ||
									"Producto del catálogo"}
							</SheetDescription>
						</div>

						{p.basePrice ? (
							<p className="flex items-baseline gap-1.5 text-[13px] text-hueso/55">
								desde
								<span className="font-display text-[27px] font-extrabold tracking-[-0.02em] text-hueso">
									{pesos(p.basePrice)}
								</span>
								por pieza
							</p>
						) : (
							<p className="text-[13px] text-hueso/55">Precio a confirmar</p>
						)}
					</div>

					{/* Las demás fotos sólo si las hay. Una fila de una sola miniatura
					    parece un carrusel roto. */}
					{imagenes.length > 1 && (
						<div className="flex gap-2 overflow-x-auto px-5 pt-4">
							{imagenes.slice(1).map((imagen) => (
								// biome-ignore lint/performance/noImgElement: export estático
								<img
									key={imagen.url}
									src={imagen.url}
									alt=""
									className="size-16 shrink-0 rounded-lg border border-tinta/10 bg-gris object-cover"
								/>
							))}
						</div>
					)}

					<div className="flex flex-col gap-[18px] px-5 py-5">
						{p.description && (
							<p className="text-[14px] leading-[22px] text-tinta/70">
								{p.description}
							</p>
						)}

						{colores.length > 0 && (
							<Bloque titulo={`Colores (${colores.length})`}>
								<ul className="flex flex-wrap gap-x-3 gap-y-2">
									{colores.map((color) => (
										<li
											key={color.name}
											className="inline-flex items-center gap-1.5 text-[13px] text-tinta/75"
										>
											<span
												className="size-[15px] shrink-0 rounded-full border border-tinta/20"
												style={{ backgroundColor: color.hex ?? "#f3f3f1" }}
											/>
											{/* El nombre en texto y no sólo el punto: un color
											    contado por su tono no existe para quien no lo
											    distingue, ni para un lector de pantalla. */}
											{color.name}
										</li>
									))}
								</ul>
							</Bloque>
						)}

						{tallas.length > 0 && (
							<Bloque titulo="Tallas">
								<ul className="flex flex-wrap gap-1.5">
									{tallas.map((talla) => (
										<li
											key={talla.size}
											className="inline-flex h-8 items-center rounded-lg border border-tinta/15 px-2.5 text-[13px] font-semibold text-tinta"
										>
											{talla.size}
										</li>
									))}
								</ul>
							</Bloque>
						)}

						<Impresion producto={p} ficha={ficha} buscando={buscandoFicha} />
					</div>
				</div>

				{/* El precio ya está arriba, en el bloque oscuro, así que aquí sólo
				    quedan las dos cosas que se pueden hacer. */}
				<div className="flex shrink-0 items-center gap-2.5 border-t border-tinta/10 bg-hueso px-5 py-4">
					<button
						type="button"
						onClick={onFavorito}
						aria-pressed={favorito}
						aria-label={
							favorito
								? `Quitar ${p.name} de favoritos`
								: `Guardar ${p.name} en favoritos`
						}
						/* `tinta/60` y no `/45` como en la tarjeta: ahí el corazón va
						   sobre la foto y se apoya en ella, aquí queda suelto sobre el
						   hueso y a 45 % se queda en 2.6:1, por debajo del mínimo. */
						className={`inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-tinta/15 transition-colors hover:border-tinta/40 ${
							favorito ? "text-tinta" : "text-tinta/60"
						}`}
					>
						<Heart
							className={`size-[19px] ${favorito ? "fill-current" : ""}`}
							aria-hidden
						/>
					</button>

					{/* En lima, no en tinta: es la única acción del cajón y el bloque
					    oscuro de arriba ya gasta bastante tinta. */}
					<Link
						href={`/design/${encodeURIComponent(p.id)}`}
						className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-lima text-[15px] font-semibold text-tinta transition-colors hover:bg-[#9bef56]"
					>
						<Pencil className="size-4" aria-hidden />
						Diseñar esta prenda
					</Link>
				</div>
			</SheetContent>
		</Sheet>
	);
}

/**
 * Lo que se puede imprimir encima.
 *
 * ES LA MITAD DE LA DECISIÓN en personalización —dónde cabe el logo y cuánto
 * cuesta ponerlo en dos sitios— y es lo único de este cajón que no viene en la
 * lista: los nombres de los lados viven en la plantilla del producto.
 *
 * MIENTRAS LLEGA SE RESERVA EL SITIO. Sin el hueco, el bloque aparece de golpe
 * y empuja hacia abajo lo que se estaba leyendo. Si la petición falla no se
 * enseña nada: un esqueleto que no se rellena nunca es peor que la ausencia.
 */
function Impresion({
	producto,
	ficha,
	buscando,
}: {
	producto: ProductoDeCatalogo;
	ficha: FichaDeProducto | null;
	buscando: boolean;
}) {
	if (buscando) {
		return (
			<div className="flex flex-col gap-2">
				<div className="h-3 w-32 animate-pulse rounded bg-gris" />
				<div className="h-9 w-full animate-pulse rounded bg-gris" />
			</div>
		);
	}

	const lados = producto.printSides ?? [];
	if (lados.length === 0) return null;

	const etiquetas = ficha?.plantilla?.data?.sideLabels ?? {};
	/* El rango, no un solo número: desde que un lado puede llevar recargo
	   propio, "cada lado extra suma $60" es falso para la manga que cuesta 20.
	   Con todos iguales, menor y mayor coinciden y la frase queda como estaba. */
	const recargos = [
		...new Set(
			lados.map((l) => recargoDeLado(l.sideKey, lados, ficha?.pricing ?? {})),
		),
	].filter((n) => n > 0);
	const porLado = recargos.length ? Math.max(...recargos) : undefined;
	const porLadoMin = recargos.length ? Math.min(...recargos) : undefined;
	const reglas = ficha?.customizationRules;

	const puede = [
		reglas?.allowText ? "texto" : null,
		reglas?.allowImages ? "imágenes" : null,
	].filter(Boolean);

	return (
		<Bloque titulo="Dónde puedes imprimir">
			<ul className="flex flex-col gap-1.5">
				{lados.map((lado) => (
					<li
						key={lado.sideKey}
						className="flex items-center justify-between gap-4 rounded-lg bg-gris px-3 py-2 text-[13px]"
					>
						<span className="font-semibold text-tinta">
							{etiquetas[lado.sideKey] ?? lado.sideKey}
						</span>
						<span className="font-mono shrink-0 text-tinta/60">
							{lado.widthCm} × {lado.heightCm} cm
						</span>
					</li>
				))}
			</ul>

			{porLado ? (
				<p className="pt-2 text-[13px] leading-[20px] text-tinta/60">
					El primer lado va en el precio. Cada lado extra suma{" "}
					{porLadoMin !== porLado
						? `entre ${pesos(porLadoMin ?? 0)} y ${pesos(porLado)}`
						: pesos(porLado)}{" "}
					por pieza.
				</p>
			) : null}

			{puede.length > 0 && (
				<p className="pt-1 text-[13px] leading-[20px] text-tinta/60">
					Puedes poner {puede.join(" e ")}
					{reglas?.maxDesigns
						? `, hasta ${reglas.maxDesigns} ${reglas.maxDesigns === 1 ? "diseño" : "diseños"} por prenda`
						: ""}
					.
				</p>
			)}
		</Bloque>
	);
}

function Bloque({
	titulo,
	children,
}: {
	titulo: string;
	children: React.ReactNode;
}) {
	return (
		<section className="flex flex-col gap-2">
			<h3 className="text-[11px] font-bold uppercase tracking-[0.09em] text-tinta/45">
				{titulo}
			</h3>
			{children}
		</section>
	);
}
