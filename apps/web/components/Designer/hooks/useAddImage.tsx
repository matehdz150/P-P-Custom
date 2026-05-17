"use client";
import { FabricImage, type FabricObject } from "fabric";
import { useDesigner } from "@/Contexts/DesignerContext";
import { makeAreaClip } from "@/lib/fabric/areaClip";
import { useElementGuard } from "./useProductConfig";

const ORANGE = "#fe6241";

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

	const addImage = (file: File) => {
		const canvas = getCanvas();
		if (!canvas) return;
		if (!guard.canAdd(1)) return;

		const areas = getEditableAreas();
		const area = areas[0] ?? null;

		const reader = new FileReader();

		reader.onload = () => {
			const url = reader.result as string;
			const htmlImg = new Image();
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

		reader.readAsDataURL(file);
	};

	return { addImage };
}
