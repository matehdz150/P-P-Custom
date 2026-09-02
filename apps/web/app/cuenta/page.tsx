"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { useComprador } from "@/Contexts/CompradorContext";
import Ajustes from "@/components/Cuenta/Ajustes";
import CatalogoEnPanel from "@/components/Cuenta/Catalogo";
import Disenos from "@/components/Cuenta/Disenos";
import Pedidos from "@/components/Cuenta/Pedidos";
import Footer from "@/components/Kustto/Footer";
import Header from "@/components/Kustto/Header";

/**
 * El panel del comprador.
 *
 * ES UNA SOLA RUTA CON PESTAÑAS, no cuatro rutas con un layout compartido, y
 * es a propósito: `/cuenta/entrar` y `/cuenta/callback` cuelgan del mismo
 * prefijo, y un `layout.tsx` en `/cuenta` se les aplicaría también — pidiendo
 * sesión justo en las dos pantallas que sirven para no tenerla.
 *
 * La sección va en la URL (`?s=pedidos`) para que se pueda compartir y para
 * que el botón de atrás haga lo que uno espera.
 */

const SECCIONES = [
	{ id: "pedidos", nombre: "Pedidos", Vista: Pedidos },
	{ id: "disenos", nombre: "Mis diseños", Vista: Disenos },
	{ id: "catalogo", nombre: "Catálogo", Vista: CatalogoEnPanel },
	{ id: "ajustes", nombre: "Ajustes", Vista: Ajustes },
] as const;

export default function CuentaPage() {
	return (
		<Suspense fallback={null}>
			<Panel />
		</Suspense>
	);
}

function Panel() {
	const { comprador, cargando } = useComprador();
	const router = useRouter();
	const params = useSearchParams();

	const pedida = params.get("s");
	const actual = SECCIONES.find((s) => s.id === pedida) ?? SECCIONES[0];

	useEffect(() => {
		// `cargando` es la diferencia entre "no ha entrado" y "todavía no hemos
		// leído el navegador". Sin esperarlo, cada carga rebotaría al login un
		// instante antes de saber que sí había sesión.
		if (!cargando && !comprador) {
			router.replace("/cuenta/entrar?volver=%2Fcuenta");
		}
	}, [cargando, comprador, router]);

	if (cargando || !comprador) {
		return <div className="min-h-screen bg-hueso" />;
	}

	const nombre = comprador.nombre?.split(" ")[0] ?? "Hola";

	return (
		<div className="flex min-h-screen flex-col bg-hueso text-tinta">
			<Header />

			<main className="mx-auto w-full max-w-[1200px] flex-1 px-5 pb-20 pt-4 md:px-14 md:pt-8">
				<h1 className="font-display text-[30px] font-semibold leading-[1.15] tracking-[-0.032em] md:text-[38px]">
					{comprador.nombre ? `Hola, ${nombre}` : "Tu cuenta"}
				</h1>

				<nav className="-mx-5 mt-6 flex gap-1 overflow-x-auto border-b border-tinta/12 px-5 md:mx-0 md:px-0">
					{SECCIONES.map((s) => {
						const activa = s.id === actual.id;
						return (
							<button
								key={s.id}
								type="button"
								// replace y no push: entrar al panel y tocar cuatro pestañas
								// no debería obligar a pulsar atrás cinco veces para salir.
								onClick={() => router.replace(`/cuenta?s=${s.id}`)}
								aria-current={activa ? "page" : undefined}
								className={`shrink-0 whitespace-nowrap border-b-2 px-3 pb-3 pt-1 text-[15px] font-semibold transition-colors ${
									activa
										? "border-tinta text-tinta"
										: "border-transparent text-tinta/55 hover:text-tinta"
								}`}
							>
								{s.nombre}
							</button>
						);
					})}
				</nav>

				<div className="pt-7">
					<actual.Vista />
				</div>
			</main>

			<Footer />
		</div>
	);
}
