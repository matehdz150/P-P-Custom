"use client";

import { ArrowLeft, Eye, Info, Pencil } from "lucide-react";
import { useDesigner } from "@/Contexts/DesignerContext";
import type { ModoDelEditor } from "../design/PreviewEditButtons";
import InfoPanelMobile from "./InfoPanelMobile";
import MobileDrawer from "./MobileDrawer";

export default function DesignerHeaderMobile({
	modo,
	onModo,
	onVolver,
}: {
	modo: ModoDelEditor;
	onModo: (m: ModoDelEditor) => void;
	onVolver: () => void;
}) {
	const { setPidiendo, setAgregando, plantilla, evento } = useDesigner();

	return (
		<div className="relative h-20 w-full border-b flex items-center px-4 bg-white rounded-[0.2rem]">
			{/* ⬅ Flecha izquierda */}

			<div className="flex">
				{/* Era un icono suelto, sin `onClick`: la única forma de salir del
				    editor en el teléfono no hacía nada. Sale por el mismo aviso de
				    salida que el escritorio, que es quien avisa de perder el diseño. */}
				<button type="button" onClick={onVolver} aria-label="Volver">
					<ArrowLeft className="z-10" />
				</button>
				<MobileDrawer
					trigger={
						<button
							type="button"
							aria-label="Información del producto"
							className="ml-3"
						>
							<Info size={22} />
						</button>
					}
					title="Información del producto"
				>
					{() => <InfoPanelMobile />}
				</MobileDrawer>
			</div>

			{/* 🔘 Botones centrados */}
			<div className="absolute left-1/2 -translate-x-1/2 flex border rounded-[0.2rem] overflow-hidden">
				{/* EDIT BUTTON */}
				<button
					type="button"
					onClick={() => onModo("editar")}
					aria-pressed={modo === "editar"}
					aria-label="Editar"
					className={`px-3 py-1.5 ${
						modo === "editar" ? "bg-tinta text-hueso-suave" : "bg-white"
					}`}
				>
					<Pencil />
				</button>

				{/* PREVIEW BUTTON */}
				<button
					type="button"
					onClick={() => onModo("probar")}
					aria-pressed={modo === "probar"}
					aria-label="Previsualizar"
					className={`px-3 py-1.5 ${
						modo === "probar" ? "bg-tinta text-hueso-suave" : "bg-white"
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
				onClick={() =>
					plantilla || evento ? setAgregando(true) : setPidiendo(true)
				}
				className="ml-auto px-3 py-1.5 bg-lima text-tinta rounded-[0.2rem] font-medium z-10 font-sora"
			>
				{plantilla || evento ? "Guardar" : "Pedir"}
			</button>
		</div>
	);
}
