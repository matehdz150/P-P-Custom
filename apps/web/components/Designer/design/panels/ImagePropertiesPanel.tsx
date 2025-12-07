"use client";

import type { FabricImage } from "fabric";

export default function ImagePropertiesPanel({
	active,
}: {
	active: FabricImage;
}) {
	type EditableCanvas = FabricImage["canvas"] & {
		editableArea?: { left: number; top: number; width: number; height: number };
	};

	const align = (
		horizontal: "left" | "center" | "right",
		vertical: "top" | "center" | "bottom",
	) => {
		const canvas = active.canvas as EditableCanvas | null;
		if (!canvas) return;

		const area = canvas.editableArea;
		if (!area) return;

		if (horizontal === "left") active.left = area.left;
		if (horizontal === "center") active.left = area.left + area.width / 2;
		if (horizontal === "right") active.left = area.left + area.width;

		if (vertical === "top") active.top = area.top;
		if (vertical === "center") active.top = area.top + area.height / 2;
		if (vertical === "bottom") active.top = area.top + area.height;

		active.canvas?.requestRenderAll();
	};

	return (
		<div className="flex flex-col gap-5">
			<h2 className="font-semibold text-sm">Imagen</h2>

			{/* Alineación */}
			<div>
				<label className="text-xs text-gray-600" htmlFor="image-align-grid">
					Alineación
				</label>

				<div id="image-align-grid" className="grid grid-cols-3 gap-2 mt-1">
					<button
						type="button"
						className="border p-2"
						onClick={() => align("left", "top")}
					>
						↖
					</button>
					<button
						type="button"
						className="border p-2"
						onClick={() => align("center", "top")}
					>
						↑
					</button>
					<button
						type="button"
						className="border p-2"
						onClick={() => align("right", "top")}
					>
						↗
					</button>

					<button
						type="button"
						className="border p-2"
						onClick={() => align("left", "center")}
					>
						←
					</button>
					<button
						type="button"
						className="border p-2"
						onClick={() => align("center", "center")}
					>
						•
					</button>
					<button
						type="button"
						className="border p-2"
						onClick={() => align("right", "center")}
					>
						→
					</button>

					<button
						type="button"
						className="border p-2"
						onClick={() => align("left", "bottom")}
					>
						↙
					</button>
					<button
						type="button"
						className="border p-2"
						onClick={() => align("center", "bottom")}
					>
						↓
					</button>
					<button
						type="button"
						className="border p-2"
						onClick={() => align("right", "bottom")}
					>
						↘
					</button>
				</div>
			</div>

			{/* Opciones básicas */}
			<div>
				<label className="text-xs text-gray-600" htmlFor="image-opacity">
					Opacidad
				</label>
				<input
					id="image-opacity"
					type="range"
					min={0.1}
					max={1}
					step={0.05}
					value={active.opacity ?? 1}
					onChange={(e) => {
						active.set("opacity", Number(e.target.value));
						active.canvas?.requestRenderAll();
					}}
					className="w-full"
				/>
			</div>
		</div>
	);
}
