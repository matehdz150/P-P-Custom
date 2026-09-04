"use client";

import { ArrowLeft, Eye, Info, Pencil } from "lucide-react";
import { useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import InfoPanelMobile from "./InfoPanelMobile";
import MobileDrawer from "./MobileDrawer";

export default function DesignerHeaderMobile() {
	const [mode, setMode] = useState<"edit" | "preview">("edit");
	const { setPidiendo, setAgregando, plantilla } = useDesigner();

	return (
		<div className="relative h-20 w-full border-b flex items-center px-4 bg-white rounded-[0.2rem]">
			{/* ⬅ Flecha izquierda */}

			<div className="flex">
				<ArrowLeft className="z-10" />
				<MobileDrawer
					trigger={
						<button type="button" className="ml-3">
							<Info size={22} />
						</button>
					}
					title="Información del producto"
				>
					{({ closeDrawer }) => <InfoPanelMobile close={closeDrawer} />}
				</MobileDrawer>
			</div>

			{/* 🔘 Botones centrados */}
			<div className="absolute left-1/2 -translate-x-1/2 flex border rounded-[0.2rem] overflow-hidden">
				{/* EDIT BUTTON */}
				<button
					type="button"
					onClick={() => setMode("edit")}
					className={`px-3 py-1.5 ${
						mode === "edit" ? "bg-tinta text-hueso-suave" : "bg-white"
					}`}
				>
					<Pencil />
				</button>

				{/* PREVIEW BUTTON */}
				<button
					type="button"
					onClick={() => setMode("preview")}
					className={`px-3 py-1.5 ${
						mode === "preview" ? "bg-tinta text-hueso-suave" : "bg-white"
					}`}
				>
					<Eye />
				</button>
			</div>

			{/* La salida del editor, igual que en escritorio: armando una
			    plantilla no se pide, se agrega. Antes decía "Guardar" y no
			    tenía onClick. */}
			<button
				type="button"
				onClick={() => (plantilla ? setAgregando(true) : setPidiendo(true))}
				className="ml-auto px-3 py-1.5 bg-lima text-tinta rounded-[0.2rem] font-medium z-10 font-sora"
			>
				{plantilla ? "Agregar" : "Pedir"}
			</button>
		</div>
	);
}
