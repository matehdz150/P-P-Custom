"use client";

import {
	ArrowLeft,
	Heart,
	House,
	Layers,
	LayoutGrid,
	ShoppingBag,
	UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { useComprador } from "@/Contexts/CompradorContext";
import Ajustes from "@/components/Cuenta/Ajustes";
import CatalogoEnPanel from "@/components/Cuenta/Catalogo";
import { DatosDelPanel, useDatosDelPanel } from "@/components/Cuenta/datos";
import DetalleEnPanel from "@/components/Cuenta/DetallePedido";
import Disenos from "@/components/Cuenta/Disenos";
import Favoritos from "@/components/Cuenta/Favoritos";
import Inicio from "@/components/Cuenta/Inicio";
import Pedidos from "@/components/Cuenta/Pedidos";
import Repetir from "@/components/Cuenta/Repetir";
import { type Seccion, Sidebar } from "@/components/Cuenta/Sidebar";
import BotonCarrito from "@/components/Kustto/BotonCarrito";
import MenuCuenta from "@/components/Kustto/MenuCuenta";

/**
 * El panel del comprador.
 *
 * ES UN DASHBOARD, NO UNA PÁGINA DEL SITIO. Sin la cabecera ni el pie: el
 * armazón entero es el sidebar más el área de contenido, y cada uno scrollea
 * por su cuenta. La cabecera del sitio sirve para descubrir la tienda; aquí ya
 * se entró, y lo que hace falta es que la navegación no se mueva mientras se
 * recorren treinta pedidos.
 *
 * ES UNA SOLA RUTA CON SECCIONES, no cuatro rutas con un layout compartido, y
 * es a propósito: `/cuenta/entrar` y `/cuenta/callback` cuelgan del mismo
 * prefijo, y un `layout.tsx` en `/cuenta` se les aplicaría también — pidiendo
 * sesión justo en las dos pantallas que sirven para no tenerla.
 *
 * La sección va en la URL (`?s=pedidos`) para que se pueda compartir y para
 * que el botón de atrás haga lo que uno espera.
 */

const SECCIONES = [
	{ id: "inicio", nombre: "Inicio", Icono: House, Vista: Inicio },
	{ id: "pedidos", nombre: "Pedidos", Icono: ShoppingBag, Vista: Pedidos },
	{ id: "disenos", nombre: "Mis diseños", Icono: Layers, Vista: Disenos },
	{ id: "favoritos", nombre: "Favoritos", Icono: Heart, Vista: Favoritos },
	{
		id: "catalogo",
		nombre: "Catálogo",
		Icono: LayoutGrid,
		Vista: CatalogoEnPanel,
	},
	{ id: "perfil", nombre: "Perfil", Icono: UserRound, Vista: Ajustes },
] as const;

/**
 * Las secciones que NO están en el menú, y no es un olvido.
 *
 * A las dos se llega desde un pedido concreto y siempre llevan `?id=`, así que
 * sin ese id no significan nada. Un elemento de menú que a veces lleva a una
 * pantalla vacía es peor que no tenerlo. Las dos cuelgan de Pedidos.
 */
const APARTE = [
	{ id: "pedido", Vista: DetalleEnPanel },
	{ id: "repetir", Vista: Repetir },
] as const;

/** El título de cada sección. En "Pedidos" saluda; en el resto, nombra. */
const TITULOS: Record<string, string> = {
	inicio: "Inicio",
	pedidos: "Pedidos",
	disenos: "Mis diseños",
	favoritos: "Favoritos",
	catalogo: "Catálogo",
	perfil: "Perfil",
	pedido: "Tu pedido",
	repetir: "Volver a pedir",
};

export default function CuentaPage() {
	return (
		<Suspense fallback={null}>
			<DatosDelPanel>
				<Panel />
			</DatosDelPanel>
		</Suspense>
	);
}

function Panel() {
	const { comprador, cargando } = useComprador();
	const router = useRouter();
	const params = useSearchParams();
	const { pedidos, disenos } = useDatosDelPanel();

	const pedida = params.get("s");
	const actual =
		APARTE.find((s) => s.id === pedida) ??
		SECCIONES.find((s) => s.id === pedida) ??
		SECCIONES[0];

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

	const nombre = comprador.nombre?.split(" ")[0] ?? "";
	const titulo =
		TITULOS[actual.id] ?? (nombre ? `Hola, ${nombre}` : "Tus pedidos");

	const esDetalle = actual.id === "pedido" || actual.id === "repetir";
	const idPedido = params.get("id");
	const volverA =
		actual.id === "repetir" && idPedido
			? `/cuenta?s=pedido&id=${encodeURIComponent(idPedido)}`
			: "/cuenta?s=pedidos";

	return (
		/* `h-screen` con `overflow-hidden` y el scroll dentro del <main>: es lo
		   que hace que el sidebar se quede quieto. Con el scroll en el body, la
		   columna se iría hacia arriba al bajar por la lista. */
		<div className="flex min-h-screen flex-col bg-[#f6f6f5] text-tinta md:h-screen md:flex-row md:overflow-hidden">
			<Sidebar
				secciones={SECCIONES as readonly Seccion[]}
				// Las de fuera del menú cuelgan de Pedidos: se llega desde ahí, y
				// dejar el menú sin nada marcado hace dudar de dónde está uno.
				actual={
					APARTE.some((s) => s.id === actual.id) ? "pedidos" : actual.id
				}
				cuentas={{ pedidos: pedidos?.length, disenos: disenos?.length }}
			/>

			<div className="flex min-w-0 flex-1 flex-col bg-white md:my-2 md:mr-2 md:h-[calc(100vh-16px)] md:overflow-hidden md:rounded-[20px] md:shadow-[0_1px_3px_rgba(43,40,18,0.035)]">
				<header className="flex h-14 shrink-0 items-center justify-end px-5 md:h-[60px] md:px-10">
					<div className="flex items-center gap-3">
						<MenuCuenta />
						<BotonCarrito />
					</div>
				</header>

				<main className="min-w-0 flex-1 px-5 pb-20 pt-2 md:overflow-y-auto md:px-10 md:pb-16 md:pt-1">
					<div className="flex min-w-0 items-center gap-2.5">
						{esDetalle && (
							<Link
								href={volverA}
								replace
								aria-label={
									actual.id === "repetir"
										? "Volver al pedido"
										: "Volver a mis pedidos"
								}
								className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-tinta text-tinta transition-colors hover:bg-tinta/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tinta/30"
							>
								<ArrowLeft className="size-5" aria-hidden />
							</Link>
						)}

						<h1 className="truncate font-display text-[36px] font-semibold leading-[1.15] tracking-[-0.032em] md:text-[55px]">
							{titulo}
						</h1>
					</div>

					<div className="pt-4">
						<actual.Vista />
					</div>
				</main>
			</div>
		</div>
	);
}
