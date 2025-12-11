"use client";

import DesignerPanButton from "./DesignerPanButton";

interface Props {
	zoom: number;
	zoomIn: () => void;
	zoomOut: () => void;
	isPanning: boolean;
	togglePan: () => void;
}

export default function DesignerBottomBar({
	zoom,
	zoomIn,
	zoomOut,
	isPanning,
	togglePan,
}: Props) {
	return (
		<div
			className="
      absolute bottom-0 left-0 w-full 
      bg-white border-t shadow-lg 
      py-3 px-4 
      flex items-center justify-between
      z-70
    "
		>
			{/* CONTROLES DE ZOOM (compactos como Printify) */}
			<div className="flex items-center gap-2">
				<button
					type="button"
					onClick={zoomOut}
					className="px-3 py-1 border rounded hover:bg-gray-100"
				>
					-
				</button>

				<span className="px-4 py-1 border rounded text-sm bg-white">
					{Math.round(zoom * 100)}%
				</span>

				<button
					type="button"
					onClick={zoomIn}
					className="px-3 py-1 border rounded hover:bg-gray-100"
				>
					+
				</button>

				{/* Botón de mover (mano) */}
				<DesignerPanButton isPanning={isPanning} togglePan={togglePan} />
			</div>

			{/* BOTÓN DE GUARDAR */}
			<button
				type="button"
				className="bg-[#fe6241] hover:bg-lime-400 text-black font-medium px-6 py-2 rounded"
			>
				Guardar producto
			</button>
		</div>
	);
}
