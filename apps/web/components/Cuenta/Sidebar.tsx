"use client";

import {
	PanelLeftClose,
	PanelLeftOpen,
	type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

/**
 * La navegación del panel.
 *
 * ES UN DASHBOARD, no una página del sitio con menú. Por eso lleva la marca
 * dentro y ocupa el alto completo: aquí no hay cabecera ni pie que orienten,
 * así que esta columna es lo único que dice dónde estás y cómo salir.
 *
 * DOS FORMAS, UNA LISTA. En pantalla ancha es una columna fija a la izquierda;
 * en el teléfono, una tira que se desliza bajo la marca. No son dos
 * componentes porque entonces habría dos sitios donde agregar una sección, y
 * el segundo se olvida.
 *
 * SON ENLACES, NO BOTONES. La sección va en la URL, así que un enlace de
 * verdad se puede abrir en otra pestaña, copiar y marcar. Un `<button>` con
 * `router.replace` se parece a esto y no hace nada de eso.
 */

export type Seccion = {
	id: string;
	nombre: string;
	Icono: LucideIcon;
};

export function Sidebar({
	secciones,
	actual,
	cuentas,
}: {
	secciones: readonly Seccion[];
	actual: string;
	/** Cuántos hay en cada sección, para la pastilla. Sin número no se pinta. */
	cuentas: Record<string, number | undefined>;
}) {
	const [condensado, setCondensado] = useState(false);

	return (
		<aside
			className={`flex shrink-0 flex-col bg-white transition-[width] duration-200 md:m-2 md:h-[calc(100vh-16px)] md:rounded-[20px] md:py-5 md:shadow-[0_1px_3px_rgba(43,40,18,0.05)] ${
				condensado ? "md:w-[72px]" : "md:w-[236px]"
			}`}
		>
			<div className="flex flex-col gap-5 md:gap-6">
				{/* La marca vuelve a la tienda. Sin cabecera, es la única salida
				    hacia el catálogo, y es donde todo el mundo la busca. */}
				<div
					className={`flex items-center justify-between gap-3 border-b border-tinta/8 px-5 py-3.5 md:border-0 md:py-0 ${
						condensado ? "md:justify-center md:px-4" : "md:px-5"
					}`}
				>
					<Link
						href="/"
						aria-label="Ir a Kustto"
						className={`font-display text-[26px] font-semibold leading-none tracking-[-0.05em] text-tinta ${
							condensado ? "md:hidden" : ""
						}`}
					>
						kustto
					</Link>

					<button
						type="button"
						onClick={() => setCondensado((valor) => !valor)}
						aria-label={condensado ? "Desplegar menú" : "Condensar menú"}
						aria-expanded={!condensado}
						className="hidden size-8 shrink-0 items-center justify-center rounded-lg border border-tinta/10 text-tinta/55 transition-colors hover:bg-[#f0f0ee] hover:text-tinta md:inline-flex"
					>
						{condensado ? (
							<PanelLeftOpen className="size-[19px]" aria-hidden />
						) : (
							<PanelLeftClose className="size-[19px]" aria-hidden />
						)}
					</button>
				</div>

				<nav className="-mx-5 flex gap-1 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-col md:gap-1.5 md:overflow-visible md:px-3 md:pb-0">
					{secciones.map((s) => {
						const activa = s.id === actual;
						const cuantos = cuentas[s.id];

						return (
							<Link
								key={s.id}
								href={`/cuenta?s=${s.id}`}
								replace
								aria-current={activa ? "page" : undefined}
								/* El activo va en tinta con el texto en lima, no en gris
								   claro: es el mismo contraste invertido de los botones
								   principales, y en una barra blanca una pastilla gris
								   sobre blanco casi no se distingue de las demás. */
								aria-label={condensado ? s.nombre : undefined}
								title={condensado ? s.nombre : undefined}
								className={`flex h-10 shrink-0 items-center gap-[11px] rounded-xl px-3 text-[14px] whitespace-nowrap transition-colors ${
									condensado ? "md:justify-center md:gap-0" : ""
								} ${
									activa
										? "bg-[#ececea] font-medium text-tinta"
										: "text-tinta/65 hover:bg-[#f3f3f1] hover:text-tinta"
								}`}
							>
								<s.Icono className="size-[19px] shrink-0" aria-hidden />
								<span className={condensado ? "md:hidden" : "md:flex-1"}>
									{s.nombre}
								</span>
								{cuantos !== undefined && cuantos > 0 && (
									<span
										className={`h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-semibold text-tinta/65 tabular-nums shadow-[inset_0_0_0_1px_rgba(43,40,18,0.1)] ${condensado ? "flex md:hidden" : "flex"}`}
									>
										{cuantos}
									</span>
								)}
							</Link>
						);
					})}
				</nav>
			</div>
		</aside>
	);
}
