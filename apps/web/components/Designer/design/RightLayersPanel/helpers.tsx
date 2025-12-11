import { FabricImage, type FabricObject, Textbox } from "fabric";
import { Image as ImageIcon, Type } from "lucide-react";

export const getIcon = (obj: FabricObject) => {
	if (obj instanceof Textbox) return <Type size={18} />;
	if (obj instanceof FabricImage) return <ImageIcon size={18} />;
	return <div className="w-4 h-4 bg-gray-300 rounded" />;
};

export const getLabel = (obj: FabricObject) => {
	if (obj instanceof Textbox) return obj.text || "Enter text";
	if (obj instanceof FabricImage) return "Image";
	return obj.type;
};

export const getSubtitle = (obj: FabricObject) => {
	if (obj instanceof Textbox) return obj.fontFamily;
	return "";
};
