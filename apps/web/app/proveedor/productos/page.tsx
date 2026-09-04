"use client";

import { Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import ConfirmarQuitarProducto from "@/components/Proveedor/ConfirmarQuitarProducto";
import {
	borrarMiProducto,
	ErrorProveedor,
	ETIQUETA_ESTADO_PRODUCTO,
	misProductos,
	type ProductoDeTaller,
} from "@/lib/api/proveedores";

export default function MisProductosPage() {
	const [productos, setProductos] = useState<ProductoDeTaller[]>([]);
	const [cargando, setCargando] = useState(true);
	/* Qué producto está esperando confirmación. El producto entero y no el id:
	   el cuadro enseña su foto y su SKU, y buscarlo otra vez en la lista para
	   pintarlo sería trabajo de más. */
	const [porQuitar, setPorQuitar] = useState<ProductoDeTaller | null>(null);
	const [verArchivados, setVerArchivados] = useState(false);

	useEffect(() => {
		misProductos()
			.then(setProductos)
			.catch(() => setProductos([]))
			.finally(() => setCargando(false));
	}, []);

	/* Los archivados van aparte y al final, nunca mezclados. Quitar un producto
	   tiene que SENTIRSE como quitarlo: si la fila se quedara donde estaba con
	   otra pastilla, el taller pulsaría dos veces convencido de que no funcionó. */
	const activos = productos.filter((p) => p.estado !== "archivado");
	const archivados = productos.filter((p) => p.estado === "archivado");
	const visibles = verArchivados ? [...activos, ...archivados] : activos;

	/**
	 * Quita el producto y devuelve el fallo, o `null` si salió bien.
	 *
	 * QUIÉN DECIDE ES EL SERVIDOR, no esta pantalla: un borrador se borra y todo
	 * lo demás se archiva, y el estado que tenemos aquí puede haber cambiado
	 * desde que se cargó la lista. Por eso la fila se actualiza con lo que
	 * conteste la API y no con lo que suponíamos al pulsar.
	 */
	async function quitar(producto: ProductoDeTaller): Promise<string | null> {
		try {
			const { estado } = await borrarMiProducto(producto.id);

			if (estado === "archivado") {
				setProductos((antes) =>
					antes.map((p) =>
						p.id === producto.id ? { ...p, estado: "archivado" } : p,
					),
				);
				toast(`${producto.name} salió del catálogo`);
			} else {
				setProductos((antes) => antes.filter((p) => p.id !== producto.id));
				toast(`Borraste ${producto.name}`);
			}

			return null;
		} catch (error) {
			return error instanceof ErrorProveedor
				? error.message
				: "No pudimos quitarlo. Inténtalo otra vez.";
		}
	}

	return (
		<div className="flex flex-col">
			<div className="flex items-center justify-between gap-6">
				<h1 className="font-display text-[30px] font-semibold leading-[38px] tracking-[-0.032em] text-tinta">
					Mis productos
				</h1>
				<Link
					href="/proveedor/productos/nuevo"
					className="flex h-[46px] items-center gap-2.5 rounded-lg bg-tinta px-5 text-[15px] font-semibold text-lima"
				>
					<Plus className="size-4" aria-hidden />
					Nuevo producto
				</Link>
			</div>

			{cargando ? (
				<p className="pt-8 text-[15px] text-tinta/60">Cargando…</p>
			) : productos.length === 0 ? (
				<div className="mt-7 flex flex-col items-start gap-3 rounded-xl border border-tinta/12 bg-hueso px-8 py-12">
					<h2 className="font-display text-[22px] font-semibold leading-7 tracking-[-0.032em] text-tinta">
						Todavía no publicas nada
					</h2>
					<p className="max-w-[520px] text-[15px] leading-[26px] text-tinta/70">
						Da de alta tu primer producto con sus colores, tallas y lados de
						impresión. Cuando lo mandes a revisión lo aprobamos y entra al
						catálogo.
					</p>
					<Link
						href="/proveedor/productos/nuevo"
						className="mt-2 flex h-12 items-center rounded-lg border-[1.5px] border-tinta px-5 text-[15px] font-semibold text-tinta"
					>
						Dar de alta un producto
					</Link>
				</div>
			) : (
				<>
					<div className="flex flex-col pt-7">
						<div className="flex items-center gap-5 pb-[11px]">
							<Columna className="flex-1">PRODUCTO</Columna>
							<Columna className="w-[160px]">TÉCNICA</Columna>
							<Columna className="w-[110px]">PRECIO BASE</Columna>
							<Columna className="w-[110px]">ESTADO</Columna>
							{/* El hueco del botón de quitar: sin él la columna de estado
							    quedaría descuadrada respecto a las filas. */}
							<span className="w-11" />
						</div>

						{visibles.map((p) => (
							<Fila key={p.id} producto={p} onQuitar={() => setPorQuitar(p)} />
						))}

						{visibles.length === 0 && (
							<p className="border-t border-tinta/12 py-6 text-[15px] text-tinta/60">
								Todo lo que tienes está archivado.
							</p>
						)}

						<div className="border-t border-tinta/12" />
					</div>

					<div className="flex flex-wrap items-center justify-between gap-4 pt-4">
						<span className="max-w-[560px] text-[13px] leading-[21px] text-tinta/55">
							Un producto entra al catálogo cuando lo mandas a revisión y lo
							aprobamos. Si le cambias algo después, vuelve a revisión.
						</span>

						{/* Sólo cuando hay algo que enseñar: un interruptor que descubre
						    una lista vacía hace dudar de si falló. */}
						{archivados.length > 0 && (
							<button
								type="button"
								onClick={() => setVerArchivados((antes) => !antes)}
								aria-expanded={verArchivados}
								className="shrink-0 text-[13px] font-semibold text-tinta underline underline-offset-4 hover:text-tinta/70"
							>
								{verArchivados
									? "Ocultar archivados"
									: `Ver archivados (${archivados.length})`}
							</button>
						)}
					</div>
				</>
			)}

			<ConfirmarQuitarProducto
				producto={porQuitar}
				onCerrar={() => setPorQuitar(null)}
				onConfirmar={quitar}
			/>
		</div>
	);
}

/**
 * Una fila de la tabla.
 *
 * LA FILA ENTERA LLEVA A EDITAR —cuando un producto vuelve rechazado,
 * corregirlo es lo único que el taller quiere hacer— pero el enlace envuelve
 * SÓLO el nombre y se estira con un pseudo-elemento. Envolver la fila entera
 * dejaría el botón de quitar dentro de un `<a>`, que no es HTML válido y deja
 * al teclado sin saber a cuál de los dos va. Es lo mismo que ya se resolvió
 * así en la tarjeta de producto del comprador.
 */
function Fila({
	producto: p,
	onQuitar,
}: {
	producto: ProductoDeTaller;
	onQuitar: () => void;
}) {
	return (
		<div className="group relative flex items-center gap-5 border-t border-tinta/12 py-3.5 transition-colors hover:bg-hueso">
			<div className="flex min-w-0 flex-1 items-center gap-3.5">
				<div className="flex size-[46px] shrink-0 items-center justify-center rounded-lg bg-gris">
					{p.images?.[0]?.url ? (
						<Image
							src={p.images[0].url}
							alt=""
							width={80}
							height={100}
							className="max-h-[84%] w-auto max-w-[74%] object-contain"
						/>
					) : null}
				</div>

				<div className="flex min-w-0 flex-col gap-[3px]">
					<Link
						href={`/proveedor/productos/editar?id=${p.id}`}
						className="truncate rounded text-[15px] font-semibold text-tinta after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tinta/30"
					>
						{p.name}
					</Link>

					{/* Si lo regresaron, el motivo pesa más que la dirección: es lo
					    único que le dice al taller qué corregir. */}
					{p.estado === "rechazado" && p.notaRevision ? (
						<span className="truncate text-xs text-[#c0392b]">
							{p.notaRevision}
						</span>
					) : (
						<span className="font-mono truncate text-xs text-tinta/55">
							{p.slug}
						</span>
					)}
				</div>
			</div>

			<span className="w-[160px] text-sm text-tinta">—</span>
			<span className="font-mono w-[110px] text-sm text-tinta">
				{p.pricing ? `$${p.pricing.basePrice}` : "—"}
			</span>
			<span className="w-[110px]">
				<span
					className={`inline-flex rounded-lg px-3 py-[5px] text-xs font-semibold ${
						p.estado === "activo"
							? "bg-lima text-tinta"
							: p.estado === "rechazado"
								? "border-[1.5px] border-[rgba(192,57,43,0.4)] text-[#c0392b]"
								: "border-[1.5px] border-tinta/20 text-tinta"
					}`}
				>
					{ETIQUETA_ESTADO_PRODUCTO[p.estado] ?? p.estado}
				</span>
			</span>

			{/* `relative` lo levanta por encima del enlace estirado; si no, el clic
			    caería en editar. Y va SIEMPRE visible, no al pasar el ratón: un
			    control que sólo existe con el puntero encima no se puede encontrar
			    con el teclado. En rojo sólo al apuntarlo, para que una tabla de
			    veinte filas no parezca una fila de botones de borrar. */}
			<button
				type="button"
				onClick={onQuitar}
				aria-label={`Quitar ${p.name}`}
				className="relative inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-tinta/40 transition-colors hover:bg-[rgba(192,57,43,0.08)] hover:text-[#c0392b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(192,57,43,0.4)]"
			>
				<Trash2 className="size-[18px]" aria-hidden />
			</button>
		</div>
	);
}

function Columna({
	children,
	className,
}: {
	children: string;
	className?: string;
}) {
	return (
		<span
			className={`font-mono text-[11px] tracking-[0.7px] text-tinta/50 ${className ?? ""}`}
		>
			{children}
		</span>
	);
}
