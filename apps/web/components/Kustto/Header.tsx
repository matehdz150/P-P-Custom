"use client";

import Link from "next/link";
import { useState } from "react";
import BotonCarrito from "./BotonCarrito";
import { Logotipo } from "./Marca";
import MenuCuenta from "./MenuCuenta";

const NAV = [
	{ label: "Catálogo", href: "/catalogo" },
	{ label: "Cómo funciona", href: "#como-funciona" },
];

/** Sólo para el menú de móvil: "Soy proveedor" ya va en `navIzquierda`. */
const NAV_SECUNDARIA = [{ label: "Rastrea tu pedido", href: "/rastreo" }];

/**
 * `centrado` es el de la portada: el logotipo al medio, nav a un lado y
 * acciones al otro. Sirve cuando debajo viene un hero centrado.
 *
 * `alineado` es el del resto del sitio: el logotipo arranca en el mismo
 * margen que el contenido de la página, así que la cabecera y lo que hay
 * debajo comparten eje en vez de pelearse.
 */
export default function Header({
	variante = "alineado",
}: {
	variante?: "centrado" | "alineado";
}) {
	const [abierto, setAbierto] = useState(false);
	const centrado = variante === "centrado";

	const marca = (
		<Link href="/" className="flex items-center">
			<Logotipo className="text-[26px] md:text-[30px]" />
		</Link>
	);

	/**
	 * La navegación de la izquierda: a dónde se puede ir en el sitio.
	 *
	 * "Soy proveedor" vive AQUÍ y no entre las acciones de la derecha, aunque
	 * ahí estaba antes. Va dirigido a otro público —talleres que quieren
	 * vender, no gente que quiere comprar— y puesto junto al carrito y a la
	 * cuenta competía con las acciones de quien sí viene a comprar. Va más
	 * apagado que el resto porque tampoco es el camino principal de esta
	 * página: existe para quien lo busca.
	 */
	const navIzquierda = (
		<>
			{NAV.map((item) => (
				<Link
					key={item.label}
					href={item.href}
					className="text-base font-medium text-tinta hover:text-lima-oscuro"
				>
					{item.label}
				</Link>
			))}
			<Link
				href="/proveedores"
				className="text-base font-medium text-tinta/55 hover:text-tinta"
			>
				Soy proveedor
			</Link>
		</>
	);

	/**
	 * La derecha: lo que es TUYO. Tu cuenta, tu carrito, y el paso siguiente.
	 *
	 * EL VERDE VA EN "Empieza a diseñar" y no en la cuenta, que es donde suele
	 * acabar en una plantilla de SaaS. Aquí **se puede pedir sin cuenta** —la
	 * ruta pública no exige sesión y el seguimiento viaja en el enlace del
	 * correo—, así que hacer de "Iniciar sesión" el botón más fuerte de la
	 * página le diría a todo el mundo que hace falta registrarse para comprar.
	 * Es de los errores que más caro salen en una tienda, y aquí sería además
	 * mentira. Por eso tampoco hay botón de "Registrarse": registrarse queda a
	 * un clic dentro de la cuenta, que es lo que merece.
	 *
	 * EL CARRITO CIERRA LA FILA y está siempre, apagado mientras esté vacío
	 * (ver `BotonCarrito`). Es el último porque es donde se busca en cualquier
	 * tienda; el botón de menú queda después, pero sólo existe por debajo de
	 * `lg`, donde el borde derecho es suyo por convención.
	 */
	const acciones = (
		<>
			<MenuCuenta />
			<Link
				href="/catalogo"
				className="inline-flex h-11 items-center rounded-full bg-lima px-4 text-[15px] font-semibold text-tinta md:h-[46px] md:px-[22px] md:text-base"
			>
				<span className="md:hidden">Diseñar</span>
				<span className="hidden md:inline">Empieza a diseñar</span>
			</Link>
			<BotonCarrito />

			<button
				type="button"
				aria-label="Abrir menú"
				aria-expanded={abierto}
				onClick={() => setAbierto((v) => !v)}
				className="flex h-11 w-11 items-center justify-center rounded-lg border-[1.5px] border-tinta lg:hidden"
			>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
					<title>Menú</title>
					<path
						d="M4 7h16M4 12h16M4 17h16"
						stroke="currentColor"
						strokeWidth="1.9"
						strokeLinecap="round"
					/>
				</svg>
			</button>
		</>
	);

	return (
		<header className="bg-transparent">
			<div
				className={`flex items-center justify-between gap-4 px-5 py-3.5 md:gap-10 md:py-[18px] ${
					centrado ? "mx-auto max-w-[1440px] md:px-11" : "md:px-14"
				}`}
			>
				{centrado ? (
					<>
						<nav className="hidden flex-1 items-center gap-7 lg:flex">
							{navIzquierda}
						</nav>

						{marca}

						<div className="flex flex-1 items-center justify-end gap-2 md:gap-3.5">
							{acciones}
						</div>
					</>
				) : (
					<>
						<div className="flex items-center gap-8 lg:gap-10">
							{marca}
							<nav className="hidden items-center gap-7 lg:flex">
								{navIzquierda}
							</nav>
						</div>

						<div className="flex items-center gap-2 md:gap-3.5">{acciones}</div>
					</>
				)}
			</div>

			{abierto && (
				<nav
					className={`flex flex-col gap-1 border-t border-tinta/10 px-5 py-3 lg:hidden ${
						centrado ? "mx-auto max-w-[1440px]" : ""
					}`}
				>
					{[
						...NAV,
						{ label: "Soy proveedor", href: "/proveedores" },
						...NAV_SECUNDARIA,
					].map((item) => (
						<Link
							key={item.label}
							href={item.href}
							onClick={() => setAbierto(false)}
							className="py-3 text-base font-medium text-tinta"
						>
							{item.label}
						</Link>
					))}
					<MenuCuenta enMenuMovil />
				</nav>
			)}
		</header>
	);
}
