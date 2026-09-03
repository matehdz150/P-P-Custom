"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
	type ArticuloDeCarrito,
	importeDe,
	piezasDe,
} from "@/lib/carrito/almacen";
import { useCarrito } from "@/lib/carrito/useCarrito";

/**
 * El carrito.
 *
 * Lo que se ve aquí son rutas y cantidades: el arte ya está guardado desde que
 * se agregó. Por eso agregar tarda unos segundos y esta pantalla es instantánea.
 *
 * LA LISTA SE AGRUPA POR TALLER, y es la decisión de fondo de la pantalla. La
 * compra ya se parte sola en un pedido por taller, y antes eso se avisaba en un
 * párrafo gris encima de todo. Agrupado, cada bloque numerado ES el paquete que
 * va a llegar: lo cuenta la estructura en vez de una advertencia que nadie lee.
 */
export default function CarritoPage() {
	const { articulos, cargando, quitar, cambiarTallas, vaciar } = useCarrito();

	const grupos = useMemo(() => agruparPorTaller(articulos), [articulos]);
	const total = articulos.reduce((suma, a) => suma + importeDe(a), 0);
	const piezas = articulos.reduce((n, a) => n + piezasDe(a), 0);
	const variosTalleres = grupos.length > 1;

	if (cargando) {
		return (
			<div className="mx-auto max-w-[1168px] px-5 py-16 text-[15px] text-tinta/60 md:px-6">
				Cargando tu carrito…
			</div>
		);
	}

	if (articulos.length === 0) {
		return (
			<div className="mx-auto max-w-[1168px] px-5 py-10 md:px-6 md:py-12">
				<div className="flex flex-col items-center rounded-2xl border border-tinta/10 bg-hueso px-6 py-20 text-center md:py-24">
					<CarritoIcono className="h-16 w-16 text-tinta/25" />
					<h1 className="font-display pt-5 text-[27px] font-bold tracking-[-0.032em] text-tinta md:text-[31px]">
						Tu carrito está vacío
					</h1>
					<p className="max-w-[42ch] pt-2.5 text-[15px] leading-[25px] text-tinta/65">
						Aquí llegan las prendas que diseñas. Elige una, ponle lo tuyo en el
						editor y agrégala desde ahí.
					</p>
					<Link
						href="/catalogo"
						className="mt-6 inline-flex h-[50px] items-center rounded-full bg-tinta px-6 text-[15px] font-semibold text-lima"
					>
						Ver el catálogo
					</Link>
				</div>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-[1168px] px-5 py-8 md:px-6 md:py-10">
			<div className="flex items-baseline justify-between gap-6 pb-5 md:pb-6">
				<h1 className="font-display text-[27px] font-bold tracking-[-0.032em] text-tinta md:text-[34px]">
					Tu carrito
				</h1>
				<span className="shrink-0 text-[13px] font-medium text-tinta/55 md:text-sm">
					{piezas} {piezas === 1 ? "pieza" : "piezas"}
				</span>
			</div>

			<div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_372px]">
				<div className="flex flex-col gap-4 md:gap-5">
					{grupos.map((g, i) => (
						<Grupo
							key={g.proveedorId}
							grupo={g}
							orden={i + 1}
							variosTalleres={variosTalleres}
							onQuitar={quitar}
							onTallas={cambiarTallas}
						/>
					))}

					<div className="pt-0.5">
						<button
							type="button"
							onClick={vaciar}
							className="text-sm font-medium text-tinta/50 underline underline-offset-4 hover:text-tinta"
						>
							Vaciar el carrito
						</button>
					</div>
				</div>

				<Resumen
					piezas={piezas}
					total={total}
					variosTalleres={variosTalleres}
				/>
			</div>
		</div>
	);
}

/**
 * El resumen.
 *
 * EN TINTA Y NO EN HUESO: es lo único de la pantalla que decide algo, y en una
 * página de tarjetas claras necesita ser el ancla. El lima queda para el total
 * y el botón, así el acento significa "esto es lo siguiente" en vez de gastarse
 * en decoración.
 *
 * En pantalla ancha va pegajoso al lado; en el teléfono se fija abajo, porque
 * con la lista larga un botón al final del scroll obliga a recorrer todo el
 * carrito para poder pagar — y esconde cuánto llevas.
 *
 * Lo de abajo se fija SÓLO por debajo de `lg`, con `max-lg:`, y no con un
 * `fixed` que después se deshaga con `lg:inset-auto`: ése y `bottom-0` tocan la
 * misma propiedad con la misma especificidad, así que cuál gana dependería del
 * orden en que Tailwind emita las dos reglas.
 */
function Resumen({
	piezas,
	total,
	variosTalleres,
}: {
	piezas: number;
	total: number;
	variosTalleres: boolean;
}) {
	const nota = variosTalleres
		? "Cada taller manda desde su dirección, así que verás un envío por paquete y llegarán por separado."
		: "El envío se cotiza al pagar, con la dirección del taller que lo produce.";

	return (
		<aside className="bg-tinta px-5 pb-6 pt-4 text-hueso max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-30 max-lg:rounded-t-[18px] lg:sticky lg:top-6 lg:rounded-2xl lg:px-6 lg:pb-6 lg:pt-[26px]">
			{/* En el teléfono el resumen se reduce a lo que hace falta para
			    decidir: cuánto es y el botón. El desglose sólo cabe al lado. */}
			<p className="hidden font-display text-[13px] font-bold uppercase tracking-[0.02em] text-hueso/55 lg:block">
				Resumen
			</p>

			<div className="hidden flex-col gap-3.5 pb-[18px] pt-5 lg:flex">
				<div className="flex items-baseline justify-between gap-4">
					<span className="text-sm text-hueso/70">
						{piezas} {piezas === 1 ? "pieza" : "piezas"}
					</span>
					<span className="text-[15px] font-medium">{pesos(total)}</span>
				</div>
				<div className="flex items-baseline justify-between gap-4">
					<span className="text-sm text-hueso/70">Envío</span>
					<span className="text-[13px] text-hueso/50">Se calcula al pagar</span>
				</div>
			</div>

			<div className="flex items-baseline justify-between gap-4 pb-3 lg:border-t lg:border-hueso/15 lg:pb-0 lg:pt-[18px]">
				<div className="flex flex-col gap-0.5 lg:block">
					<span className="font-display text-xs font-bold uppercase tracking-[0.02em] text-hueso/55 lg:text-sm lg:text-hueso">
						Total
					</span>
					<span className="text-[11px] text-hueso/45 lg:hidden">
						Envío aparte, por taller
					</span>
				</div>
				<span className="font-display text-[26px] font-bold tracking-[-0.02em] text-lima lg:text-[29px]">
					{pesos(total)}
				</span>
			</div>

			<Link
				href="/pedir/carrito"
				className="mt-4 flex h-[52px] items-center justify-center gap-2.5 rounded-full bg-lima text-base font-semibold text-tinta lg:mt-5"
			>
				Continuar
				<FlechaIcono className="h-[17px] w-[17px]" />
			</Link>

			{/* Se dice ANTES de pagar y no en la pantalla siguiente: que el envío
			    salga por taller es lo que explica dos cargos y dos paquetes, y
			    enterarse después se siente a truco. */}
			<p className="hidden pt-4 text-[13px] leading-5 text-hueso/60 lg:block">
				{nota}
			</p>
		</aside>
	);
}

type GrupoDeTaller = {
	proveedorId: string;
	nombre: string;
	articulos: ArticuloDeCarrito[];
};

/** Un taller y lo suyo. Cada grupo es un paquete que va a llegar. */
function Grupo({
	grupo,
	orden,
	variosTalleres,
	onQuitar,
	onTallas,
}: {
	grupo: GrupoDeTaller;
	orden: number;
	variosTalleres: boolean;
	onQuitar: (id: string) => void;
	onTallas: (id: string, tallas: { size: string; piezas: number }[]) => void;
}) {
	return (
		<section className="overflow-hidden rounded-2xl border border-tinta/10 bg-hueso">
			<div className="flex items-center gap-2.5 border-b border-tinta/[0.08] bg-[#f7f7f5] px-4 py-3 md:gap-3 md:px-[22px] md:py-4">
				<span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-tinta text-[11px] font-bold text-lima md:h-[26px] md:w-[26px] md:text-xs">
					{orden}
				</span>
				<span className="truncate font-display text-xs font-bold uppercase tracking-[0.02em] text-tinta md:text-sm">
					{grupo.nombre}
				</span>
				<span className="ml-auto shrink-0 whitespace-nowrap text-[11px] text-tinta/50 md:text-[13px]">
					{variosTalleres ? "Llega por separado" : "Un solo envío"}
				</span>
			</div>

			{grupo.articulos.map((a) => (
				<Articulo
					key={a.id}
					articulo={a}
					onQuitar={() => onQuitar(a.id)}
					onTallas={(tallas) => onTallas(a.id, tallas)}
				/>
			))}
		</section>
	);
}

function Articulo({
	articulo,
	onQuitar,
	onTallas,
}: {
	articulo: ArticuloDeCarrito;
	onQuitar: () => void;
	onTallas: (tallas: { size: string; piezas: number }[]) => void;
}) {
	const lados = articulo.lados.length;

	const detalle = [
		articulo.colorPrenda,
		`${lados} ${lados === 1 ? "lado" : "lados"}`,
	]
		.filter(Boolean)
		.join(" · ");

	function cambiar(indice: number, delta: number) {
		const siguiente = articulo.tallas.map((t, i) =>
			i === indice ? { ...t, piezas: Math.max(1, t.piezas + delta) } : t,
		);
		onTallas(siguiente);
	}

	/* Los mismos contadores se pintan en dos sitios —en la columna de datos
	   en pantalla ancha, y a lo ancho debajo en el teléfono—, y sólo uno se ve
	   a la vez. Se arman UNA vez para que no haya dos copias que puedan
	   separarse al tocar una y olvidar la otra. */
	const contadores = articulo.tallas.map((t, i) => (
		<Contador
			key={t.size}
			talla={t}
			onMas={() => cambiar(i, 1)}
			onMenos={() => cambiar(i, -1)}
		/>
	));

	return (
		<article className="flex flex-col gap-3.5 border-t border-tinta/[0.07] p-4 md:flex-row md:gap-5 md:p-[22px]">
			{/* `md:contents` disuelve esta caja en pantalla ancha, así que la
			    miniatura y los datos pasan a ser hijos directos del artículo y se
			    ponen en fila. En el teléfono sigue siendo una fila propia, con los
			    contadores debajo. */}
			<div className="flex gap-3.5 md:contents">
				<div className="relative flex h-[84px] w-[84px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-gris md:h-[132px] md:w-[132px] md:rounded-xl">
					{articulo.miniatura ? (
						// Es un data URL diminuto guardado en el carrito, no una foto del
						// catálogo: `next/image` no aporta nada aquí.
						// biome-ignore lint/performance/noImgElement: data URL local
						<img
							src={articulo.miniatura}
							alt=""
							className="h-full w-full object-cover"
						/>
					) : (
						<PrendaIcono className="h-[62px] w-[62px] text-tinta/25 md:h-24 md:w-24" />
					)}
					<span className="absolute bottom-2 left-2 hidden rounded-full bg-hueso/95 px-2.5 py-[3px] text-[11px] font-semibold text-tinta md:inline-flex">
						{lados} {lados === 1 ? "lado" : "lados"}
					</span>
				</div>

				<div className="flex min-w-0 flex-1 flex-col gap-3.5 md:gap-[14px]">
					<div className="flex items-start justify-between gap-4 md:gap-[18px]">
						<div className="min-w-0">
							<p className="font-display text-base font-bold tracking-[-0.014em] text-tinta md:text-[18px]">
								{articulo.nombre}
							</p>
							<p className="pt-0.5 text-[13px] leading-[19px] text-tinta/60 md:pt-1 md:text-sm">
								{detalle}
							</p>
							<span className="font-display pt-1.5 text-base font-bold text-tinta md:hidden">
								{pesos(importeDe(articulo))}
							</span>
						</div>

						<button
							type="button"
							onClick={onQuitar}
							aria-label={`Quitar ${articulo.nombre}`}
							className="flex shrink-0 items-center gap-1.5 px-0.5 py-1 text-[13px] font-medium text-tinta/50 hover:text-tinta"
						>
							<BoteIcono className="h-[15px] w-[15px]" />
							<span className="hidden md:inline">Quitar</span>
						</button>
					</div>

					{/* Las tallas como botones y no como campos de número: en un
					    carrito se sube y baja de uno en uno, y meter el cursor en un
					    input para cambiar un 2 por un 3 es trabajo de más. */}
					<div className="hidden flex-wrap items-center gap-2.5 md:flex">
						{contadores}
						<span className="font-display ml-auto text-[18px] font-bold text-tinta">
							{pesos(importeDe(articulo))}
						</span>
					</div>
				</div>
			</div>

			{/* En el teléfono los contadores van debajo, a lo ancho: al lado de la
			    miniatura no caben dos sin encogerlos por debajo del área táctil. */}
			<div className="flex flex-wrap gap-2 md:hidden">{contadores}</div>
		</article>
	);
}

function Contador({
	talla,
	onMas,
	onMenos,
}: {
	talla: { size: string; piezas: number };
	onMas: () => void;
	onMenos: () => void;
}) {
	return (
		<div className="flex h-11 items-center overflow-hidden rounded-[10px] border-[1.5px] border-tinta/20 bg-white md:h-10">
			<span className="flex h-full min-w-11 items-center justify-center border-r-[1.5px] border-tinta/[0.12] bg-gris px-2 text-[13px] font-bold text-tinta md:min-w-10 md:px-0">
				{talla.size}
			</span>
			<button
				type="button"
				onClick={onMenos}
				aria-label={`Quitar una talla ${talla.size}`}
				className="h-full w-11 text-[18px] font-semibold text-tinta/60 hover:text-tinta md:w-[34px] md:text-[17px]"
			>
				−
			</button>
			<span className="min-w-[22px] text-center text-sm font-semibold text-tinta">
				{talla.piezas}
			</span>
			<button
				type="button"
				onClick={onMas}
				aria-label={`Agregar una talla ${talla.size}`}
				className="h-full w-11 text-[18px] font-semibold text-tinta/60 hover:text-tinta md:w-[34px] md:text-[17px]"
			>
				+
			</button>
		</div>
	);
}

/**
 * Un grupo por taller, en el orden en que se agregaron.
 *
 * Se agrupa por `proveedorId` y no por el nombre: dos talleres pueden llamarse
 * igual, y el que parte la compra en pedidos es el id.
 */
function agruparPorTaller(articulos: ArticuloDeCarrito[]): GrupoDeTaller[] {
	const grupos: GrupoDeTaller[] = [];

	for (const a of articulos) {
		const suyo = grupos.find((g) => g.proveedorId === a.proveedorId);

		if (suyo) {
			suyo.articulos.push(a);
		} else {
			grupos.push({
				proveedorId: a.proveedorId,
				nombre: a.proveedorNombre ?? "Taller",
				articulos: [a],
			});
		}
	}

	return grupos;
}

function pesos(n: number): string {
	return `$${n.toLocaleString("es-MX")}`;
}

function CarritoIcono({ className }: { className?: string }) {
	return (
		<svg
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden="true"
		>
			<path
				d="M3 5h2.2l2 10.2a1.6 1.6 0 0 0 1.6 1.3h7.9a1.6 1.6 0 0 0 1.6-1.2L20 8H6.2"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<circle cx="10" cy="20" r="1.4" fill="currentColor" />
			<circle cx="17" cy="20" r="1.4" fill="currentColor" />
		</svg>
	);
}

/** El respaldo cuando el carrito no guardó miniatura. */
function PrendaIcono({ className }: { className?: string }) {
	return (
		<svg
			className={className}
			viewBox="0 0 64 64"
			fill="none"
			aria-hidden="true"
		>
			<path
				d="M22 6 L14 9 L2 18 L9 27 L14 24 L14 58 L50 58 L50 24 L55 27 L62 18 L50 9 L42 6 C42 6 40 12 32 12 C24 12 22 6 22 6 Z"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function BoteIcono({ className }: { className?: string }) {
	return (
		<svg
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden="true"
		>
			<path
				d="M5 7h14M10 7V5.4A1.4 1.4 0 0 1 11.4 4h1.2A1.4 1.4 0 0 1 14 5.4V7M8 7v11.6A1.4 1.4 0 0 0 9.4 20h5.2a1.4 1.4 0 0 0 1.4-1.4V7"
				stroke="currentColor"
				strokeWidth="1.6"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function FlechaIcono({ className }: { className?: string }) {
	return (
		<svg
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden="true"
		>
			<path
				d="M5 12h13M13 6.5l5.5 5.5L13 17.5"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}
