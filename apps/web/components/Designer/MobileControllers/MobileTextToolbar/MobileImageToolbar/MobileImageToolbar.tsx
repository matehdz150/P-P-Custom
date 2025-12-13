"use client";

import type { Image as FabricImage } from "fabric";
import {
	Copy,
	FlipHorizontal,
	FlipVertical,
	RotateCw,
	Trash2,
	ZoomIn,
	ZoomOut,
} from "lucide-react";

export default function MobileImageToolbar({
	image,
	apply,
	onRemove,
}: {
	image: FabricImage;
	apply: (props: Record<string, unknown>) => void;
	onRemove: () => void;
}) {
	return (
		<div
			className="
        bg-white rounded-[0.2rem]
        px-2 py-2
        flex flex-nowrap items-center gap-2
        max-w-[92vw]
        overflow-x-auto whitespace-nowrap
        touch-pan-x
        border
      "
			style={{ WebkitOverflowScrolling: "touch" }}
		>
			<div className="flex">
				{/* Escala */}
				<button
					type="button"
					className="shrink-0 p-2 border rounded-l-[0.2rem]"
					onClick={() =>
						apply({
							scaleX: (image.scaleX ?? 1) * 0.9,
							scaleY: (image.scaleY ?? 1) * 0.9,
						})
					}
				>
					<ZoomOut size={22} />
				</button>

				<button
					type="button"
					className="shrink-0 p-2 border border-l-0 rounded-r-[0.2rem]"
					onClick={() =>
						apply({
							scaleX: (image.scaleX ?? 1) * 1.1,
							scaleY: (image.scaleY ?? 1) * 1.1,
						})
					}
				>
					<ZoomIn size={22} />
				</button>
			</div>

			<div className="flex">
				{/* Flip */}
				<button
					type="button"
					className="shrink-0 p-2 border rounded-l-[0.2rem]"
					onClick={() => apply({ flipX: !image.flipX })}
				>
					<FlipHorizontal size={22} />
				</button>

				<button
					type="button"
					className="shrink-0 p-2 border border-l-0 rounded-r-[0.2rem]"
					onClick={() => apply({ flipY: !image.flipY })}
				>
					<FlipVertical size={22} />
				</button>
			</div>

			<div className="flex">
				{/* Rotar */}
				{/* Rotar izquierda */}
				<button
					type="button"
					className="shrink-0 p-2 border rounded-l-[0.2rem]"
					onClick={() =>
						apply({
							angle: ((image.angle ?? 0) - 15 + 360) % 360,
						})
					}
				>
					<RotateCw size={22} className="-scale-x-100" />
				</button>

				{/* Rotar derecha */}
				<button
					type="button"
					className="shrink-0 p-2 border border-l-0 rounded-r-[0.2rem]"
					onClick={() =>
						apply({
							angle: ((image.angle ?? 0) + 15) % 360,
						})
					}
				>
					<RotateCw size={22} />
				</button>
			</div>

			{/* Duplicar */}
			<button
				type="button"
				className="shrink-0 p-2 border rounded-[0.2rem]"
				onClick={async () => {
					const clone = (await image.clone()) as FabricImage;

					clone.set({
						left: (image.left ?? 0) + 16,
						top: (image.top ?? 0) + 16,
					});

					apply({}); // opcional si quieres forzar render previo
					image.canvas?.add(clone);
					image.canvas?.setActiveObject(clone);
					image.canvas?.requestRenderAll();
				}}
			>
				<Copy size={18} />
			</button>

			{/* Eliminar */}
			<button
				type="button"
				className="shrink-0 border p-2 rounded-[0.2rem]"
				onClick={onRemove}
			>
				<Trash2 size={22} />
			</button>
		</div>
	);
}
