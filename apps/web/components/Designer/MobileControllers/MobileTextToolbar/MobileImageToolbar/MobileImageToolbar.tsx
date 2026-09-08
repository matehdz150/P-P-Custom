"use client";

import type { FabricObject } from "fabric";
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
	onDuplicate,
	compacto = false,
}: {
	image: FabricObject;
	apply: (props: Record<string, unknown>) => void;
	onRemove: () => void;
	onDuplicate: () => void;
	compacto?: boolean;
}) {
	return (
		<div
			className={
				compacto
					? "flex items-center gap-2"
					: `
        bg-white rounded-[0.2rem]
        px-2 py-2
        flex flex-nowrap items-center gap-2
        max-w-[92vw]
        overflow-x-auto whitespace-nowrap
        touch-pan-x
        border
      `
			}
			style={{ WebkitOverflowScrolling: "touch" }}
		>
			<div className="flex">
				{/* Escala */}
				<button
					type="button"
					aria-label="Hacer más pequeño"
					title="Hacer más pequeño"
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
					aria-label="Hacer más grande"
					title="Hacer más grande"
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
					aria-label="Invertir horizontalmente"
					title="Invertir horizontalmente"
					className="shrink-0 p-2 border rounded-l-[0.2rem]"
					onClick={() => apply({ flipX: !image.flipX })}
				>
					<FlipHorizontal size={22} />
				</button>

				<button
					type="button"
					aria-label="Invertir verticalmente"
					title="Invertir verticalmente"
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
					aria-label="Rotar a la izquierda"
					title="Rotar a la izquierda"
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
					aria-label="Rotar a la derecha"
					title="Rotar a la derecha"
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
				aria-label="Duplicar"
				title="Duplicar"
				className="shrink-0 p-2 border rounded-[0.2rem]"
				onClick={onDuplicate}
			>
				<Copy size={18} />
			</button>

			{/* Eliminar */}
			<button
				type="button"
				aria-label="Borrar"
				title="Borrar"
				className="shrink-0 border p-2 rounded-[0.2rem]"
				onClick={onRemove}
			>
				<Trash2 size={22} />
			</button>
		</div>
	);
}
