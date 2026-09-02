"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import AltaProducto from "@/components/Provider/alta/AltaProducto";
import { type Alta, deProductoAAlta } from "@/components/Provider/alta/tipos";
import { miProducto, type ProductoDeTaller } from "@/lib/api/proveedores";

/**
 * Corregir un producto ya guardado.
 *
 * Es el asistente de alta con el producto cargado dentro: mismas reglas,
 * mismos pasos. A esta pantalla se llega sobre todo desde un rechazo, así
 * que lo que el admin escribió viaja hasta arriba del formulario.
 */
function EditarProducto() {
	/* El id va en la query y no en la ruta.

	   El sitio se publica como export estático y una ruta dinámica necesita
	   conocer todas sus URLs en el build. Los productos del taller se crean
	   después de desplegar, así que `[id]` no se puede pre-renderizar. Aquí no
	   se pierde nada: es una pantalla privada que no se indexa. */
	const id = useSearchParams().get("id") ?? "";

	const [producto, setProducto] = useState<ProductoDeTaller | null>(null);
	const [inicial, setInicial] = useState<Alta | null>(null);
	const [fallo, setFallo] = useState<string | null>(null);

	useEffect(() => {
		miProducto(id)
			.then((p) => {
				setProducto(p);
				setInicial(deProductoAAlta(p));
			})
			.catch((e) =>
				setFallo(e instanceof Error ? e.message : "No pudimos cargarlo"),
			);
	}, [id]);

	if (fallo) {
		return (
			<div className="flex flex-col items-start gap-3 rounded-xl border border-tinta/12 bg-hueso px-8 py-12">
				<h1 className="font-display text-[22px] font-semibold leading-7 tracking-[-0.032em] text-tinta">
					No pudimos abrir este producto
				</h1>
				<p className="max-w-[520px] text-[15px] leading-[26px] text-tinta/70">
					{fallo}
				</p>
				<Link
					href="/proveedor/productos"
					className="mt-2 flex h-12 items-center rounded-lg border-[1.5px] border-tinta px-5 text-[15px] font-semibold text-tinta"
				>
					Volver a mis productos
				</Link>
			</div>
		);
	}

	if (!producto || !inicial) {
		return <p className="text-[15px] text-tinta/60">Cargando…</p>;
	}

	return (
		<AltaProducto
			editando={{
				id: producto.id,
				inicial,
				notaRevision:
					producto.estado === "rechazado" ? producto.notaRevision : null,
				yaPublicado: producto.estado === "activo",
			}}
		/>
	);
}

/**
 * `useSearchParams` obliga a un límite de Suspense.
 *
 * Al construir el sitio estático, Next pre-renderiza esta página sin conocer
 * la query —no existe hasta que alguien abre su enlace—, y sin el Suspense el
 * build falla. El envoltorio es lo que le permite dejar el hueco y rellenarlo
 * en el navegador.
 */
export default function Pagina() {
	return (
		<Suspense fallback={<p className="text-[15px] text-tinta/60">Cargando…</p>}>
			<EditarProducto />
		</Suspense>
	);
}
