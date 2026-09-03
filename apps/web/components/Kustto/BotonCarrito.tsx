"use client";

import Link from "next/link";
import { useCuentaDelCarrito } from "@/lib/carrito/useCuenta";

/**
 * El carrito en la cabecera.
 *
 * APARECE SÓLO CUANDO TIENE ALGO, y no siempre. Con el carrito vacío, el sitio
 * de honor es de "Empieza a diseñar": es lo único que convierte a quien llega
 * sin nada, que hoy es casi todo el mundo. Un icono que lleva a "tu carrito
 * está vacío" no le sirve a nadie y le quita peso a la acción que sí importa.
 *
 * Cuando hay algo dentro se invierte: quien ya tiene un diseño guardado está
 * más cerca de comprar que de empezar otro, y entonces el carrito merece
 * competir por la mirada.
 *
 * NO SE PINTA AL PRE-RENDERIZAR. El sitio es estático detrás de CloudFront: un
 * contador metido en el HTML se cachearía con el número de una persona y se le
 * serviría a las demás. `useCuentaDelCarrito` arranca en cero y se llena
 * después de montar, así que el servidor nunca ve una cifra.
 */
export default function BotonCarrito() {
	const piezas = useCuentaDelCarrito();

	if (piezas === 0) return null;

	return (
		<Link
			href="/carrito"
			aria-label={`Tu carrito, ${piezas} ${piezas === 1 ? "pieza" : "piezas"}`}
			className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-tinta text-tinta transition-colors hover:bg-tinta hover:text-lima md:h-[46px] md:w-[46px]"
		>
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
				<title>Carrito</title>
				<path
					d="M3 5h2.2l2 10.2a1.6 1.6 0 0 0 1.6 1.3h7.9a1.6 1.6 0 0 0 1.6-1.2L20 8H6.2"
					stroke="currentColor"
					strokeWidth="1.8"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
				<circle cx="10" cy="20" r="1.4" fill="currentColor" />
				<circle cx="17" cy="20" r="1.4" fill="currentColor" />
			</svg>

			{/* El número va en lima sobre tinta: es el acento de la marca y aquí
			    hace de aviso sin necesitar rojo, que en una tienda se lee como
			    error y no como "tienes algo esperando". */}
			<span className="absolute -right-1 -top-1 flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-tinta px-1.5 text-[12px] font-semibold leading-none text-lima ring-2 ring-hueso">
				{piezas > 99 ? "99+" : piezas}
			</span>
		</Link>
	);
}
