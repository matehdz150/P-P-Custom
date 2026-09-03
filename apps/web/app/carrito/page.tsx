"use client";

import Link from "next/link";
import {
	type ArticuloDeCarrito,
	importeDe,
	piezasDe,
	talleresDe,
} from "@/lib/carrito/almacen";
import { useCarrito } from "@/lib/carrito/useCarrito";

/**
 * El carrito.
 *
 * Lo que se ve aquí son rutas y cantidades: el arte ya está guardado desde que
 * se agregó. Por eso agregar tarda unos segundos y esta pantalla es instantánea.
 */
export default function CarritoPage() {
	const { articulos, cargando, quitar, cambiarTallas, vaciar } = useCarrito();

	const talleres = talleresDe(articulos);
	const total = articulos.reduce((suma, a) => suma + importeDe(a), 0);
	const piezas = articulos.reduce((n, a) => n + piezasDe(a), 0);

	if (cargando) {
		return (
			<main className="mx-auto max-w-[880px] px-5 py-16 text-[15px] text-tinta/60">
				Cargando tu carrito…
			</main>
		);
	}

	if (articulos.length === 0) {
		return (
			<main className="mx-auto max-w-[880px] px-5 py-16">
				<h1 className="font-display text-[28px] font-semibold tracking-[-0.032em] text-tinta">
					Tu carrito está vacío
				</h1>
				<p className="pt-2 text-[15px] leading-[25px] text-tinta/70">
					Elige una prenda, diséñala y agrégala desde el editor.
				</p>
				<Link
					href="/catalogo"
					className="mt-6 inline-flex h-12 items-center rounded-lg bg-tinta px-5 text-[15px] font-semibold text-lima"
				>
					Ver el catálogo
				</Link>
			</main>
		);
	}

	return (
		<main className="mx-auto max-w-[880px] px-5 py-12">
			<h1 className="font-display text-[28px] font-semibold tracking-[-0.032em] text-tinta">
				Tu carrito
			</h1>

			{/* Es informativo, no un problema: la compra se parte sola en un pedido
			    por taller, y cada uno manda lo suyo. Decirlo antes evita la
			    sorpresa de recibir dos paquetes. */}
			{talleres.length > 1 && (
				<p className="mt-4 rounded-lg border border-tinta/12 bg-gris px-4 py-3 text-sm leading-[22px] text-tinta/75">
					Tus productos los hacen {talleres.length} talleres distintos, así que
					llegarán por separado. Cada uno lleva su propio seguimiento.
				</p>
			)}

			<section className="flex flex-col gap-4 pt-6">
				{articulos.map((a) => (
					<Articulo
						key={a.id}
						articulo={a}
						onQuitar={() => quitar(a.id)}
						onTallas={(tallas) => cambiarTallas(a.id, tallas)}
					/>
				))}
			</section>

			<div className="mt-6 flex items-center justify-between rounded-xl border border-tinta/12 bg-gris px-4 py-3.5">
				<span className="text-sm text-tinta/70">
					{piezas} {piezas === 1 ? "pieza" : "piezas"}
				</span>
				<span className="font-display text-[20px] font-semibold text-tinta">
					${total.toLocaleString("es-MX")}
				</span>
			</div>

			<p className="pt-2 text-[13px] leading-5 text-tinta/55">
				El envío se calcula al pagar, y va por taller: cada uno manda desde su
				dirección.
			</p>

			<div className="flex items-center justify-between gap-4 pt-6">
				<button
					type="button"
					onClick={vaciar}
					className="text-sm font-semibold text-tinta/60"
				>
					Vaciar el carrito
				</button>

				{/* Todavía no: el checkout que sabe cobrar varias partes es el paso
				    siguiente. Prometer un botón que lleva a un formulario de un solo
				    producto sería peor que decirlo. */}
				<span className="rounded-lg bg-tinta/10 px-5 py-3 text-[14px] text-tinta/60">
					El pago del carrito completo llega en el siguiente paso
				</span>
			</div>
		</main>
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
	return (
		<article className="flex gap-4 rounded-xl border border-tinta/12 bg-hueso p-4">
			<div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gris">
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
					<span className="text-xs text-tinta/45">sin vista</span>
				)}
			</div>

			<div className="flex min-w-0 flex-1 flex-col gap-1.5">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						<p className="truncate text-[15px] font-semibold text-tinta">
							{articulo.nombre}
						</p>
						<p className="text-sm text-tinta/60">
							{articulo.proveedorNombre ?? "Taller"}
							{articulo.colorPrenda ? ` · ${articulo.colorPrenda}` : ""} ·{" "}
							{articulo.lados.length}{" "}
							{articulo.lados.length === 1 ? "lado" : "lados"}
						</p>
					</div>
					<button
						type="button"
						onClick={onQuitar}
						className="shrink-0 text-sm text-tinta/55"
					>
						Quitar
					</button>
				</div>

				<div className="flex flex-wrap items-center gap-2 pt-1">
					{articulo.tallas.map((t, i) => (
						<label key={t.size} className="flex items-center gap-1.5">
							<span className="text-xs text-tinta/60">{t.size}</span>
							<input
								type="number"
								min={1}
								value={t.piezas}
								onChange={(e) => {
									const piezas = Math.max(1, Number(e.target.value) || 1);
									const siguiente = [...articulo.tallas];
									siguiente[i] = { ...t, piezas };
									onTallas(siguiente);
								}}
								className="h-9 w-16 rounded-lg border-[1.5px] border-tinta/20 bg-white px-2 text-sm text-tinta"
							/>
						</label>
					))}

					<span className="ml-auto font-display text-[15px] font-semibold text-tinta">
						${importeDe(articulo).toLocaleString("es-MX")}
					</span>
				</div>
			</div>
		</article>
	);
}
