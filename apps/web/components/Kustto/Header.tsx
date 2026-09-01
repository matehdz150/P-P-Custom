"use client";

import Link from "next/link";
import { useState } from "react";
import { Logotipo } from "./Marca";

const NAV = [
	{ label: "Catálogo", href: "/catalogo" },
	{ label: "Cómo funciona", href: "#como-funciona" },
	{ label: "Paquetes", href: "/catalogo/eventos" },
];

const NAV_SECUNDARIA = [
	{ label: "Soy proveedor", href: "/proveedores" },
	{ label: "Rastrea tu pedido", href: "/rastreo" },
];

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

	const acciones = (
		<>
			<Link
				href="/proveedores"
				className="hidden text-base font-medium text-tinta hover:text-lima-oscuro lg:inline"
			>
				Soy proveedor
			</Link>
			<Link
				href="/login"
				className="hidden text-base font-semibold text-tinta hover:text-lima-oscuro md:inline"
			>
				Iniciar sesión
			</Link>
			<Link
				href="/catalogo"
				className="inline-flex h-11 items-center rounded-full bg-lima px-4 text-[15px] font-semibold text-tinta md:h-[46px] md:px-[22px] md:text-base"
			>
				<span className="md:hidden">Diseñar</span>
				<span className="hidden md:inline">Empieza a diseñar</span>
			</Link>

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
							{NAV.map((item) => (
								<Link
									key={item.label}
									href={item.href}
									className="text-base font-medium text-tinta hover:text-lima-oscuro"
								>
									{item.label}
								</Link>
							))}
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
								{NAV.map((item) => (
									<Link
										key={item.label}
										href={item.href}
										className="text-base font-medium text-tinta hover:text-lima-oscuro"
									>
										{item.label}
									</Link>
								))}
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
					{[...NAV, ...NAV_SECUNDARIA].map((item) => (
						<Link
							key={item.label}
							href={item.href}
							onClick={() => setAbierto(false)}
							className="py-3 text-base font-medium text-tinta"
						>
							{item.label}
						</Link>
					))}
					<Link
						href="/login"
						onClick={() => setAbierto(false)}
						className="py-3 text-base font-semibold text-tinta"
					>
						Iniciar sesión
					</Link>
				</nav>
			)}
		</header>
	);
}
