import { FabricImage, type FabricObject, Path, Textbox } from "fabric";
import { Image as ImageIcon, Shapes, Type } from "lucide-react";
import { CurvedText } from "@/lib/fabric/CurvedText";
import { esObjetoGrafico } from "@/lib/fabric/esObjetoGrafico";

const clavesDeCapas = new WeakMap<FabricObject, string>();
let siguienteClave = 0;

/** Una copia tiene su propia identidad, incluso si conserva el tipo o el id. */
export function claveDeCapa(objeto: FabricObject) {
	let clave = clavesDeCapas.get(objeto);
	if (!clave) {
		clave = `capa-${++siguienteClave}`;
		clavesDeCapas.set(objeto, clave);
	}
	return clave;
}

export const getIcon = (obj: FabricObject) => {
	if (obj instanceof Textbox) return <Type size={18} />;
	if (obj instanceof CurvedText)
		return (
			<svg
				width={18}
				height={18}
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth={2}
				strokeLinecap="round"
			>
				<title>Texto curvado</title>
				<path d="M4 18 Q12 6 20 18" />
			</svg>
		);
	if (obj instanceof FabricImage) return <ImageIcon size={18} />;
	if (obj instanceof Path) return <Shapes size={18} />;
	if (esObjetoGrafico(obj)) return <ImageIcon size={18} />;
	return <div className="w-4 h-4 bg-gray-300 rounded" />;
};

export const getLabel = (obj: FabricObject) => {
	if (obj instanceof Textbox) return obj.text || "Enter text";
	if (obj instanceof CurvedText) return obj.text || "Texto curvado";
	if (obj instanceof FabricImage) return "Image";
	if (obj instanceof Path) return "Forma";
	if (esObjetoGrafico(obj)) return "Gráfico SVG";
	return obj.type;
};

export const getSubtitle = (obj: FabricObject) => {
	if (obj instanceof Textbox) return obj.fontFamily;
	if (obj instanceof CurvedText) return `⌒ Curvado · ${obj.fontFamily}`;
	return "";
};
