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

export function useAddImageLogic() {
	const { getCanvas, getEditableAreas, setActiveObject } = useDesigner();
	const { execute } = useHistory();

	const addImage = (file: File) => {
		const canvas = getCanvas();
		if (!canvas) return;

		const area = getEditableAreas()[0] ?? null;

		const reader = new FileReader();
		reader.onload = async () => {
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
				img.left = centerX;
				img.top = centerY;

				// ClipPath
				if (area) {
					const clip =
						area instanceof Rect
							? new Rect({
									left: area.left,
									top: area.top,
									width: area.width,
									height: area.height,
									absolutePositioned: true,
								})
							: area instanceof Circle
								? new Circle({
										left: area.left,
										top: area.top,
										radius: area.radius,
										absolutePositioned: true,
									})
								: ((await area.clone()) as unknown as FabricObject);

					clip.set({ selectable: false, evented: false });
					img.clipPath = clip;
				}

				execute(new AddObjectCommand(img));
				setActiveObject(img);
			};
		};

		reader.readAsDataURL(file);
	};

	return { addImage };
}

// El componente normal sigue igual:
export default function SidebarAddImage() {
	const { addImage } = useAddImageLogic();

	return (
		<label className="bg-black text-white py-2 rounded cursor-pointer text-sm">
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
	);
}
