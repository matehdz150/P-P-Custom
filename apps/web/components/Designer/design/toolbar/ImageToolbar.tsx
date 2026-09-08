"use client";

import { Path } from "fabric";
import { useDesigner } from "@/Contexts/DesignerContext";
import { esObjetoGrafico } from "@/lib/fabric/esObjetoGrafico";
import { useAccionesDeGrafico } from "../../hooks/useAccionesDeGrafico";
import MobileImageToolbar from "../../MobileControllers/MobileTextToolbar/MobileImageToolbar/MobileImageToolbar";

export default function ImageToolbar() {
	const { activeObject, getCanvas } = useDesigner();
	const { aplicar, duplicar, borrar } = useAccionesDeGrafico(activeObject);
	if (
		!getCanvas() ||
		!esObjetoGrafico(activeObject) ||
		activeObject instanceof Path
	)
		return null;

	return (
		<div className="absolute top-0 left-1/2 -translate-x-1/2 flex items-center gap-3 w-full py-3 bg-white/90 border-b z-300 pl-30">
			<MobileImageToolbar
				compacto
				image={activeObject}
				apply={aplicar}
				onDuplicate={duplicar}
				onRemove={borrar}
			/>
		</div>
	);
}
