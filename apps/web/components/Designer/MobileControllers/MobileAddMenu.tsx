"use client";

import { Shapes, Type } from "lucide-react";
import { useState } from "react";
import { RejillasDeGraficos } from "@/components/Designer/DesignerSidebar/panels/ShapesPanel";
import BibliotecaDeImagenes from "@/components/Designer/panels/BibliotecaDeImagenes";
import { useDesignRules } from "../hooks/useProductConfig";
import MobileAddTextPanel from "./MobileAddTextPanel";

export default function MobileAddMenu({
	closeDrawer,
}: {
	closeDrawer: () => void;
}) {
	const { allowImages, allowText } = useDesignRules();

	const [view, setView] = useState<"menu" | "text" | "shapes">("menu");

	if (view === "text") {
		return (
			<MobileAddTextPanel
				goBack={() => setView("menu")}
				closeDrawer={closeDrawer}
			/>
		);
	}

	if (view === "shapes") {
		return (
			<div className="pb-6">
				<button
					type="button"
					onClick={() => setView("menu")}
					className="mb-4 text-sm text-tinta/60"
				>
					← Volver
				</button>
				<RejillasDeGraficos />
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{/* La MISMA pieza que el editor de escritorio, no una versión corta.
			    Antes aquí sólo se podía subir del dispositivo, así que las
			    imágenes guardadas existían en un editor y no en el otro — y quien
			    diseña desde el teléfono es justo quien menos ganas tiene de ir a
			    buscar el logo en su galería. */}
			{allowImages ? (
				<BibliotecaDeImagenes />
			) : (
				<div className="w-full px-4 py-5 border border-dashed rounded-lg text-sm text-neutral-500">
					Este producto no permite imágenes
				</div>
			)}

			{/* GRÁFICOS Y FORMAS. Faltaban entera en el teléfono: existían en la
			    barra de escritorio y aquí no había forma de llegar a ellas. */}
			<button
				type="button"
				onClick={() => setView("shapes")}
				className="w-full text-left px-4 py-6 border rounded-lg flex gap-3 items-center"
			>
				<Shapes />
				Gráficos y formas
			</button>

			{/* TEXTO */}
			{allowText ? (
				<button
					type="button"
					onClick={() => setView("text")}
					className="w-full text-left px-4 py-6 border rounded-lg flex gap-3 items-center"
				>
					<Type />
					Texto
				</button>
			) : (
				<div className="w-full px-4 py-5 border border-dashed rounded-lg text-sm text-neutral-500">
					Este producto no permite texto
				</div>
			)}
		</div>
	);
}
