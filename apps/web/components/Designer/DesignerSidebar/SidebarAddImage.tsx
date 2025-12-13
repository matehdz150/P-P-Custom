"use client";

import { Circle, FabricImage, type FabricObject, Rect } from "fabric";
import { useDesigner } from "@/Contexts/DesignerContext";
import { useHistory } from "@/Contexts/HistoryContext";
import { AddObjectCommand } from "@/lib/history/commands/AddObjectCommand";

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

function applyClip(obj: FabricObject, area: FabricObject | null) {
	if (!area) return;

	let clip: FabricObject | null = null;

	if (area instanceof Rect) {
		clip = new Rect({
			left: area.left,
			top: area.top,
			width: area.width,
			height: area.height,
			absolutePositioned: true,
		});
	} else if (area instanceof Circle) {
		clip = new Circle({
			left: area.left,
			top: area.top,
			radius: area.radius,
			absolutePositioned: true,
		});
	}

	if (!clip) return;

	clip.set({ selectable: false, evented: false });
	obj.clipPath = clip;
}

/* 👇👇👇
   ESTA FUNCIÓN NO SE QUITA
   porque otros componentes la importan
*/
export function useAddImageLogic() {
	const { getCanvas, getEditableAreas, setActiveObject } = useDesigner();
	const { execute } = useHistory();

	const addImage = (file: File) => {
		const canvas = getCanvas();
		if (!canvas) return;

		const area = getEditableAreas()[0] ?? null;

		const reader = new FileReader();
		reader.onload = () => {
			const htmlImg = new Image();
			htmlImg.src = reader.result as string;

			htmlImg.onload = async () => {
				const img = new FabricImage(htmlImg, {
					originX: "center",
					originY: "center",
				});

				applySelectionStyle(img);

				let centerX = canvas.getWidth() / 2;
				let centerY = canvas.getHeight() / 2;
				let maxW = 300;

				if (area) {
					const b = area.getBoundingRect();
					centerX = b.left + b.width / 2;
					centerY = b.top + b.height / 2;
					maxW = b.width * 0.8;
				}

				img.scaleToWidth(maxW);
				img.set({ left: centerX, top: centerY });

				await applyClip(img, area);

				execute(new AddObjectCommand(img));
				setActiveObject(img);
			};
		};

		reader.readAsDataURL(file);
	};

	return { addImage };
}

/* 👇👇👇
   DEFAULT EXPORT para el sidebar
*/
export default function SidebarAddImage() {
	const { addImage } = useAddImageLogic();

	return (
		<div className="flex flex-col gap-2">
			<label className="bg-black text-white py-2 rounded cursor-pointer text-sm text-center">
				Agregar imagen
				<input
					type="file"
					accept="image/*"
					className="hidden"
					onChange={(e) => {
						const file = e.target.files?.[0];
						if (file) addImage(file);
					}}
				/>
			</label>
		</div>
	);
}
