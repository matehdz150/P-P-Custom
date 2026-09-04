"use client";
import { FabricImage, type FabricObject } from "fabric";
import { useDesigner } from "@/Contexts/DesignerContext";
import { makeAreaClip } from "@/lib/fabric/areaClip";
import { useElementGuard } from "./useProductConfig";

const ORANGE = "#2b2812";

function applySelectionStyle(obj: FabricObject) {
	obj.set({
		transparentCorners: false,
		cornerColor: "#ffffff",
		cornerStrokeColor: ORANGE,
		borderColor: ORANGE,
		cornerSize: 8,
		borderScaleFactor: 1.1,
		cornerStyle: "rect",
	});
}

export function useAddImage() {
	const { getCanvas, getEditableAreas, setActiveObject } = useDesigner();
	const guard = useElementGuard();

	/**
	 * Mete una imagen ya cargada en el lienzo.
	 *
	 * Separado de `addImage` porque la fuente son DOS: un archivo del disco y
	 * una imagen de la biblioteca, que llega por URL. Lo que se hace con ella
	 * —escalar al área, recortar, seleccionar— es lo mismo en los dos casos.
	 */
	const ponerEnElLienzo = (url: string) => {
		const canvas = getCanvas();
		if (!canvas) return;
		if (!guard.canAdd(1)) return;

		const areas = getEditableAreas();
		const area = areas[0] ?? null;

		const htmlImg = new Image();

		/* Sin esto, una imagen de la biblioteca CONTAMINA el lienzo y
		   `toDataURL` empieza a lanzar `SecurityError` al exportar el arte: el
		   pedido se queda sin archivo de producción. Va con `anonymous` y no
		   con credenciales porque `/medios/…` es público de lectura.

		   Las que vienen del disco son `data:` y esto no les afecta. */
		htmlImg.crossOrigin = "anonymous";
		htmlImg.src = url;
		htmlImg.onload = () => {
			const img = new FabricImage(htmlImg, {
				originX: "center",
				originY: "center",
			});

			applySelectionStyle(img as unknown as FabricObject);

			// posición
			if (area) {
				img.scaleToWidth(area.width * 0.8);
				img.left = area.left + area.width / 2;
				img.top = area.top + area.height / 2;
			} else {
				img.scaleToWidth(300);
				img.left = canvas.getWidth() / 2;
				img.top = canvas.getHeight() / 2;
			}

			// clip — soporta rect/elipse/triángulo
			if (area) {
				const clip = makeAreaClip(area);
				if (clip) img.clipPath = clip;
			}

			canvas.add(img);
			canvas.setActiveObject(img);
			canvas.requestRenderAll();
			setActiveObject(img);
		};
	};

	const addImage = (file: File) => {
		const reader = new FileReader();
		reader.onload = () => ponerEnElLienzo(reader.result as string);
		reader.readAsDataURL(file);
	};

	return { addImage, ponerEnElLienzo };
}
