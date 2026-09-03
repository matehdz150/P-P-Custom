"use client";

import Link from "next/link";
import { useCuentaDelCarrito } from "@/lib/carrito/useCuenta";

/**
 * El carrito en la cabecera.
 *
 * ESTÁ SIEMPRE Y ES LO ÚLTIMO DE LA FILA, con algo dentro o sin nada. Es donde
 * se busca en cualquier tienda, y esa costumbre pesa más que el argumento de
 * ahorrar un elemento: un carrito que aparece y desaparece no se aprende nunca
 * —quien no lo ha visto con algo dentro no sabe que el sitio tiene uno—, y al
 * montarse empujaba el resto de la cabecera, porque `useCuentaDelCarrito`
 * arranca en cero y se llena después. Ocupando siempre el mismo hueco, la
 * cabecera ya no se mueve.
 *
 * Lo que cambia con el contenido es el PESO, no la presencia: vacío va apagado
 * y sin número, para no competir con el verde de "Empieza a diseñar", que es
 * lo que convierte a quien todavía no tiene nada. Con algo dentro toma el
 * contraste completo y saca su contador.
 *
 * NO SE PINTA AL PRE-RENDERIZAR. El sitio es estático detrás de CloudFront: un
 * contador metido en el HTML se cachearía con el número de una persona y se le
 * serviría a las demás. `useCuentaDelCarrito` arranca en cero y se llena
 * después de montar, así que el servidor nunca ve una cifra.
 */
export default function BotonCarrito() {
	const piezas = useCuentaDelCarrito();
	const lleno = piezas > 0;

	return (
		<Link
			href="/carrito"
			aria-label={
				lleno
					? `Tu carrito, ${piezas} ${piezas === 1 ? "pieza" : "piezas"}`
					: "Tu carrito, vacío"
			}
			className={`relative inline-flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] transition-colors hover:border-tinta hover:bg-tinta hover:text-lima md:h-[46px] md:w-[46px] ${
				lleno ? "border-tinta text-tinta" : "border-tinta/25 text-tinta/55"
			}`}
		>
			<svg
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				aria-hidden="true"
			>
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
			{lleno && (
				<span className="absolute -right-1 -top-1 flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-tinta px-1.5 text-[12px] font-semibold leading-none text-lima ring-2 ring-hueso">
					{piezas > 99 ? "99+" : piezas}
				</span>
			)}
		</Link>
	);
}
