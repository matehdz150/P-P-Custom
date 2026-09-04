"use client";

import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export type ModoDelEditor = "editar" | "probar";

/**
 * El interruptor Editar / Probar, y el de las capas.
 *
 * "Probar" llevaba desde siempre sin `onClick`: los dos botones se pintaban
 * como si uno estuviera activo, pero el estado era una clase escrita a mano y
 * nunca cambiaba. Ahora manda el modo de verdad y el par se pinta desde él.
 *
 * Van como dos botones de estado con `aria-pressed` y no como un grupo de
 * radio: `role="radio"` pide `<input type="radio">` de verdad para funcionar
 * bien con el teclado, y un par de conmutadores es la forma correcta para dos
 * estados excluyentes de la MISMA pantalla. Lo que importa —que se oiga cuál
 * está puesto— lo da igual.
 */
export default function PreviewEditButtons({
	onToggleLayers,
	isLayersOpen,
	modo,
	onModo,
}: {
	onToggleLayers: () => void;
	isLayersOpen: boolean;
	modo: ModoDelEditor;
	onModo: (m: ModoDelEditor) => void;
}) {
	return (
		<div className="absolute top-1 right-4 flex items-center py-2 z-400 font-sora">
			{/* `<fieldset>` y no un `<div role="group">`: es el elemento que ya
			    significa "grupo de controles", y es lo que usan los filtros del
			    catálogo. La leyenda va oculta — el par se lee solo. */}
			<fieldset className="flex items-center">
				<legend className="sr-only">Modo del editor</legend>
				<Pestana
					activa={modo === "editar"}
					onClick={() => onModo("editar")}
					className="rounded-l-[0.2rem] border-r-0"
				>
					Editar
				</Pestana>
				<Pestana
					activa={modo === "probar"}
					onClick={() => onModo("probar")}
					className="rounded-r-[0.2rem] border-l-0"
				>
					Probar
				</Pestana>
			</fieldset>

			{/* Las capas son del lienzo: en "Probar" no hay nada que ordenar. */}
			{modo === "editar" && (
				<button
					type="button"
					onClick={onToggleLayers}
					aria-expanded={isLayersOpen}
					aria-label={isLayersOpen ? "Cerrar opciones" : "Abrir opciones"}
					title={isLayersOpen ? "Cerrar opciones" : "Abrir opciones"}
					className={cn(
						"ml-3 px-2 py-2 border rounded-[0.2rem] cursor-pointer transition-colors",
						isLayersOpen
							? "bg-tinta text-hueso-suave border-tinta"
							: "bg-white text-tinta hover:bg-gray-100",
					)}
				>
					<SlidersHorizontal size={22} />
				</button>
			)}
		</div>
	);
}

function Pestana({
	activa,
	onClick,
	className,
	children,
}: {
	activa: boolean;
	onClick: () => void;
	className: string;
	children: string;
}) {
	return (
		<button
			type="button"
			aria-pressed={activa}
			onClick={onClick}
			className={cn(
				"px-10 py-2 border cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tinta/30",
				activa
					? "bg-tinta text-hueso-suave border-tinta"
					: "bg-white text-tinta hover:bg-gray-100",
				className,
			)}
		>
			<span className="font-semibold">{children}</span>
		</button>
	);
}
