"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
	AjusteExistencias,
	type Variante,
} from "@/components/Provider/AjusteExistencias";
import { misProductos, type ProductoDeTaller } from "@/lib/api/proveedores";
import { sinAcentos } from "@/lib/texto";

/**
 * El inventario del taller: qué blancos hay, por color y talla.
 *
 * NO SE EDITA EN LÍNEA. Cada variante se ajusta desde su botón, que abre un
 * diálogo donde hay que elegir qué pasó —llegó, se fue, o lo conté—, escribir
 * cuánto y confirmar viendo el resultado. Antes eran casillas sueltas con un
 * "Guardar" al final, y se podía teclear un número y salir de la pantalla
 * creyendo que había quedado guardado. El inventario decide qué plazo se le
 * promete al comprador; vale la pena que cueste un clic más.
 *
 * LAS CANTIDADES NEGATIVAS SON NORMALES. Se puede vender sin blanco —al
 * cliente se le avisa de más días— y entonces el número baja de cero. Un -2 no
 * es un error: es "compra 2 para sacar lo que ya vendiste", y por eso se pinta
 * como "faltan 2" y no como un número roto.
 */

type Fila = Variante;

/** Espejo de `variante()` en las Lambdas y de `claveVariante` en el alta. */
function claveVariante(color: string | null, talla: string) {
	const limpia = (s: string) => s.trim().replace(/\|/g, "-");
	return color ? `${limpia(color)}|${limpia(talla)}` : limpia(talla);
}

function filasDe(p: ProductoDeTaller): Fila[] {
	const tallas = (p.sizes ?? []).map((t) => t.size.trim()).filter(Boolean);
	const colores = (p.colors ?? []).map((c) => c.name.trim()).filter(Boolean);
	const mapa = p.existencias ?? {};

	const combos =
		colores.length === 0
			? tallas.map((talla) => ({ color: null as string | null, talla }))
			: colores.flatMap((color) => tallas.map((talla) => ({ color, talla })));

	return combos.map(({ color, talla }) => {
		const clave = claveVariante(color, talla);
		return {
			producto: p,
			clave,
			color,
			talla,
			cantidad: Number(mapa[clave] ?? 0),
		};
	});
}

export default function InventarioPage() {
	const [productos, setProductos] = useState<ProductoDeTaller[] | null>(null);
	const [fallo, setFallo] = useState<string | null>(null);
	const [busqueda, setBusqueda] = useState("");
	const [soloBajas, setSoloBajas] = useState(false);

	/** La variante que se está ajustando, o null si el diálogo está cerrado. */
	const [ajustando, setAjustando] = useState<Fila | null>(null);

	useEffect(() => {
		misProductos()
			.then(setProductos)
			.catch(() => setFallo("No pudimos traer tus productos."));
	}, []);

	// Todo producto lleva cuenta, así que ya no se filtra por un interruptor.
	// Sólo se dejan fuera los que no tienen mapa —los anteriores a esa regla—,
	// que no tienen ninguna casilla que enseñar.
	const conStock = useMemo(
		() => (productos ?? []).filter((p) => p.existencias),
		[productos],
	);

	const filas = useMemo(() => {
		const termino = sinAcentos(busqueda);

		return conStock.flatMap(filasDe).filter((f) => {
			const minimo = f.producto.minimoAlerta ?? 0;

			if (soloBajas && f.cantidad > minimo) return false;
			if (!termino) return true;

			return sinAcentos(
				`${f.producto.name} ${f.color ?? ""} ${f.talla}`,
			).includes(termino);
		});
	}, [conStock, busqueda, soloBajas]);

	/**
	 * El diálogo devuelve el producto ya actualizado, así que se sustituye en
	 * la lista en vez de volver a pedirla entera: la fila repinta al instante y
	 * con el número que quedó de verdad en la base.
	 */
	function reemplazar(actualizado: ProductoDeTaller) {
		setProductos((antes) =>
			(antes ?? []).map((p) => (p.id === actualizado.id ? actualizado : p)),
		);
	}

	if (fallo && !productos) return <Aviso texto={fallo} />;

	if (!productos) {
		return <p className="pt-8 text-[15px] text-tinta/60">Cargando…</p>;
	}

	if (conStock.length === 0) {
		return (
			<div className="flex flex-col">
				<Titulo />
				<div className="mt-8 flex flex-col items-start gap-3 rounded-xl border border-tinta/12 bg-hueso px-8 py-12">
					<h2 className="font-display text-[22px] font-semibold leading-7 tracking-[-0.032em] text-tinta">
						Todavía no tienes productos que contar
					</h2>
					<p className="max-w-[520px] text-[15px] leading-[26px] text-tinta/70">
						Aquí aparecen tus blancos en cuanto des de alta un producto con sus
						tallas y colores. Si compras la prenda por trabajo, déjalos en cero:
						igual te sirve para ver cuántos te faltan comprar de lo que ya
						vendiste.
					</p>
					<Link
						href="/proveedor/productos"
						className="mt-1 inline-flex h-11 items-center rounded-lg bg-tinta px-5 text-[15px] font-semibold text-lima"
					>
						Ir a mis productos
					</Link>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col">
			<Titulo />

			<div className="flex flex-wrap items-center gap-2.5 pt-[22px]">
				<input
					type="search"
					value={busqueda}
					onChange={(e) => setBusqueda(e.target.value)}
					placeholder="Busca por producto, color o talla"
					aria-label="Buscar en el inventario"
					className="h-11 w-full rounded-lg border-[1.5px] border-tinta/15 bg-white px-3.5 text-[15px] text-tinta outline-none placeholder:text-tinta/45 focus:border-tinta focus:shadow-[0_0_0_3px_rgba(174,255,110,0.55)] md:max-w-[340px]"
				/>
				<button
					type="button"
					onClick={() => setSoloBajas((v) => !v)}
					aria-pressed={soloBajas}
					className={`flex h-11 items-center rounded-lg px-4 text-sm ${
						soloBajas
							? "bg-tinta font-semibold text-lima"
							: "border-[1.5px] border-tinta/15 font-medium text-tinta"
					}`}
				>
					Sólo las bajas
				</button>
			</div>

			<div className="flex flex-col pt-[26px]">
				<div className="flex items-center gap-5 pb-[11px] text-[11px] uppercase tracking-[0.06em] text-tinta/50">
					<span className="flex-1">PRODUCTO</span>
					<span className="w-[150px]">VARIANTE</span>
					<span className="w-[90px] text-right">TIENES</span>
					<span className="w-[120px]">ESTADO</span>
					<span className="w-[104px]" />
				</div>

				{filas.length === 0 ? (
					<p className="border-t border-tinta/12 pt-6 text-[15px] text-tinta/60">
						{soloBajas
							? "Ninguna variante está por debajo de su mínimo. Bien."
							: "Nada coincide con lo que buscaste."}
					</p>
				) : (
					filas.map((f) => {
						const llave = `${f.producto.id}::${f.clave}`;
						const minimo = f.producto.minimoAlerta ?? 0;
						const nombre = f.color ? `${f.color} · ${f.talla}` : f.talla;

						return (
							<div
								key={llave}
								className="flex items-center gap-5 border-t border-tinta/12 py-3.5"
							>
								<span className="min-w-0 flex-1 truncate text-[15px] text-tinta">
									{f.producto.name}
								</span>
								<span className="w-[150px] font-mono text-[13px] text-tinta/70">
									{nombre}
								</span>
								<span
									className={`w-[90px] text-right font-mono text-[17px] font-semibold ${
										f.cantidad < 0 ? "text-[#c0392b]" : "text-tinta"
									}`}
								>
									{f.cantidad}
								</span>
								<span className="w-[120px]">
									<Semaforo cantidad={f.cantidad} minimo={minimo} />
								</span>
								<div className="flex w-[104px] justify-end">
									<button
										type="button"
										onClick={() => setAjustando(f)}
										// El nombre completo va en el aria-label porque el texto
										// visible dice "Ajustar" en las N filas: con un lector de
										// pantalla, N botones idénticos no se distinguen.
										aria-label={`Ajustar ${nombre} de ${f.producto.name}`}
										className="h-10 rounded-lg border-[1.5px] border-tinta/18 px-3.5 text-[14px] font-semibold text-tinta transition-colors hover:border-tinta hover:bg-hueso"
									>
										Ajustar
									</button>
								</div>
							</div>
						);
					})
				)}

				<div className="border-t border-tinta/12" />
			</div>

			{fallo && (
				<div className="pt-5">
					<Aviso texto={fallo} />
				</div>
			)}

			<AjusteExistencias
				variante={ajustando}
				onCerrar={() => setAjustando(null)}
				onGuardado={reemplazar}
			/>
		</div>
	);
}

function Titulo() {
	return (
		<div className="flex flex-col gap-1.5">
			<h1 className="font-display text-[30px] font-semibold leading-[38px] tracking-[-0.032em] text-tinta">
				Inventario
			</h1>
			<p className="max-w-[560px] text-[15px] leading-[25px] text-tinta/65">
				Tus blancos por color y talla. Cada pedido descuenta solo; si cancelas
				uno, vuelve. Ajustar aquí no manda el producto a revisión.
			</p>
		</div>
	);
}

/**
 * El estado de una variante en una palabra.
 *
 * Tres, no dos: "faltan" no es lo mismo que "se acabó". Sin existencias pero
 * en cero es un aviso; en negativo ya vendiste algo que tienes que comprar, y
 * eso es una tarea pendiente con fecha.
 */
function Semaforo({ cantidad, minimo }: { cantidad: number; minimo: number }) {
	if (cantidad < 0) {
		return (
			<span className="inline-flex h-[22px] items-center rounded-full bg-[rgba(192,57,43,0.1)] px-2.5 text-[12px] font-semibold text-[#c0392b]">
				Faltan {Math.abs(cantidad)}
			</span>
		);
	}

	if (cantidad === 0) {
		return (
			<span className="inline-flex h-[22px] items-center rounded-full bg-naranja/15 px-2.5 text-[12px] font-semibold text-tinta">
				Se acabó
			</span>
		);
	}

	if (cantidad <= minimo) {
		return (
			<span className="inline-flex h-[22px] items-center rounded-full bg-lavanda px-2.5 text-[12px] font-semibold text-tinta">
				Va bajo
			</span>
		);
	}

	return <span className="text-[13px] text-tinta/45">—</span>;
}

function Aviso({ texto }: { texto: string }) {
	return (
		<div
			role="alert"
			className="rounded-xl border border-[rgba(192,57,43,0.35)] bg-[rgba(192,57,43,0.07)] p-4 text-[15px] text-tinta"
		>
			{texto}
		</div>
	);
}
