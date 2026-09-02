"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useComprador } from "@/Contexts/CompradorContext";

/**
 * Quién eres, en la cabecera.
 *
 * Sin sesión es el enlace a entrar; con sesión, la inicial y el menú.
 *
 * Lleva a `/cuenta/entrar`, que es pantalla NUESTRA. La interfaz alojada de
 * Cognito hace lo mismo y no se usa: es genérica, y es lo primero que ve
 * alguien que iba a comprar.
 */
export default function MenuCuenta({
	enMenuMovil = false,
}: {
	enMenuMovil?: boolean;
}) {
	const { comprador, cargando, salir } = useComprador();
	const ruta = usePathname() ?? "/";
	const [abierto, setAbierto] = useState(false);
	const caja = useRef<HTMLDivElement>(null);

	// Cerrar al pulsar fuera o con Escape. Un menú que sólo se cierra con su
	// propio botón se queda abierto encima del contenido al navegar.
	useEffect(() => {
		if (!abierto) return;

		const fuera = (e: MouseEvent) => {
			if (caja.current && !caja.current.contains(e.target as Node)) {
				setAbierto(false);
			}
		};
		const cerrarConEsc = (e: KeyboardEvent) => {
			if (e.key === "Escape") setAbierto(false);
		};

		document.addEventListener("mousedown", fuera);
		document.addEventListener("keydown", cerrarConEsc);
		return () => {
			document.removeEventListener("mousedown", fuera);
			document.removeEventListener("keydown", cerrarConEsc);
		};
	}, [abierto]);

	/**
	 * Mientras se lee el navegador no se pinta nada.
	 *
	 * El HTML se pre-renderiza sin sesión: enseñar "Iniciar sesión" y cambiarlo
	 * un instante después haría parpadear la cabecera en cada carga.
	 */
	if (cargando) {
		return <span aria-hidden className={enMenuMovil ? "" : "h-11 w-px"} />;
	}

	if (!comprador) {
		return (
			<Link
				// Se lleva de dónde venías para devolverte ahí, y no a la portada.
				href={`/cuenta/entrar?volver=${encodeURIComponent(ruta)}`}
				className={
					enMenuMovil
						? "py-3 text-base font-semibold text-tinta"
						: "hidden text-base font-semibold text-tinta hover:text-lima-oscuro md:inline"
				}
			>
				Iniciar sesión
			</Link>
		);
	}

	const inicial =
		(comprador.nombre ?? comprador.email).trim()[0]?.toUpperCase() ?? "?";
	const nombreCorto = comprador.nombre?.split(" ")[0] ?? comprador.email;

	if (enMenuMovil) {
		return (
			<>
				<div className="flex items-center gap-3 border-t border-tinta/10 pt-3">
					<Inicial letra={inicial} />
					<div className="min-w-0">
						<p className="truncate text-base font-semibold text-tinta">
							{comprador.nombre ?? "Tu cuenta"}
						</p>
						<p className="truncate text-sm text-tinta/55">{comprador.email}</p>
					</div>
				</div>
				<Link href="/cuenta" className="py-3 text-base font-medium text-tinta">
					Mi cuenta
				</Link>
				<button
					type="button"
					onClick={salir}
					className="py-3 text-left text-base font-medium text-tinta/60"
				>
					Cerrar sesión
				</button>
			</>
		);
	}

	return (
		<div ref={caja} className="relative">
			<button
				type="button"
				onClick={() => setAbierto((v) => !v)}
				aria-expanded={abierto}
				aria-haspopup="menu"
				className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-tinta/5"
			>
				<Inicial letra={inicial} />
				<span className="hidden max-w-[120px] truncate text-[15px] font-semibold text-tinta lg:inline">
					{nombreCorto}
				</span>
			</button>

			{abierto && (
				<div
					role="menu"
					className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-tinta/10 bg-white shadow-[0_12px_32px_rgba(43,40,18,0.14)]"
				>
					<div className="border-b border-tinta/10 px-4 py-3">
						<p className="truncate text-[15px] font-semibold text-tinta">
							{comprador.nombre ?? "Tu cuenta"}
						</p>
						<p className="truncate text-[13px] text-tinta/55">
							{comprador.email}
						</p>
					</div>

					<Link
						href="/cuenta"
						role="menuitem"
						onClick={() => setAbierto(false)}
						className="block px-4 py-3 text-[15px] font-medium text-tinta hover:bg-gris"
					>
						Mis pedidos y diseños
					</Link>

					<button
						type="button"
						role="menuitem"
						onClick={salir}
						className="block w-full px-4 py-3 text-left text-[15px] font-medium text-tinta/60 hover:bg-gris"
					>
						Cerrar sesión
					</button>
				</div>
			)}
		</div>
	);
}

function Inicial({ letra }: { letra: string }) {
	return (
		<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lima font-display text-[15px] font-bold text-tinta">
			{letra}
		</span>
	);
}
