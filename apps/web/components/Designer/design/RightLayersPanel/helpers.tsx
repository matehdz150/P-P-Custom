import { FabricImage, type FabricObject, Path, Textbox } from "fabric";
import { Image as ImageIcon, Shapes, Type } from "lucide-react";
import { CurvedText } from "@/lib/fabric/CurvedText";

export const getIcon = (obj: FabricObject) => {
	if (obj instanceof Textbox) return <Type size={18} />;
	if (obj instanceof CurvedText) return (
		<svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
			<path d="M4 18 Q12 6 20 18" />
		</svg>
	);
	if (obj instanceof FabricImage) return <ImageIcon size={18} />;
	if (obj instanceof Path) return <Shapes size={18} />;
	return <div className="w-4 h-4 bg-gray-300 rounded" />;
};

export const getLabel = (obj: FabricObject) => {
	if (obj instanceof Textbox) return obj.text || "Enter text";
	if (obj instanceof CurvedText) return obj.text || "Texto curvado";
	if (obj instanceof FabricImage) return "Image";
	if (obj instanceof Path) return "Forma";
	return obj.type;
};

export const getSubtitle = (obj: FabricObject) => {
	if (obj instanceof Textbox) return obj.fontFamily;
	if (obj instanceof CurvedText) return `⌒ Curvado · ${obj.fontFamily}`;
	return "";
};
