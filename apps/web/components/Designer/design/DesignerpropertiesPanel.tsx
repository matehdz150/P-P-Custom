"use client";

import type { FabricImage, IText } from "fabric";
import { useDesigner } from "@/Contexts/DesignerContext";
import ImagePropertiesPanel from "./panels/ImagePropertiesPanel";
import TextPropertiesPanel from "./panels/TextPropertiesPanel";

export default function DesignerPropertiesPanel() {
	const { activeObject } = useDesigner();

	if (!activeObject) {
		return (
			<div className="w-[260px] bg-white border-l p-4 text-gray-400 flex items-center justify-center">
				Nada seleccionado
			</div>
		);
	}

	// Detectar tipo
	const type = activeObject.type;

	return (
		<div className="w-[260px] bg-white border-l p-4 overflow-y-auto">
			{type === "i-text" && (
				<TextPropertiesPanel active={activeObject as IText} />
			)}
			{type === "image" && (
				<ImagePropertiesPanel active={activeObject as FabricImage} />
			)}

			{/* Otros paneles futuros:
        - CurvedTextPropertiesPanel
        - GroupPropertiesPanel
        - ShapePropertiesPanel
      */}
		</div>
	);
}
