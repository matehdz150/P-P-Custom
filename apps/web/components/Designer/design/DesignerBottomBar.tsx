"use client";

import DesignerPanButton from "./DesignerPanButton";

interface Props {
	zoom: number;
	zoomIn: () => void;
	zoomOut: () => void;
	isPanning: boolean;
	togglePan: () => void;
	onSave: () => void;
	saving?: boolean;
	onSaveDraft?: () => void;
}

export default function DesignerBottomBar({
	zoom,
	zoomIn,
	zoomOut,
	isPanning,
	togglePan,
	onSave,
	saving,
	onSaveDraft,
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
 
			{/* ACCIONES DE GUARDADO */}
			<div className="flex gap-2">
				{onSaveDraft && (
					<button
						type="button"
						onClick={onSaveDraft}
						disabled={saving}
						className="border border-[#1a1a1a] hover:bg-gray-50 disabled:opacity-50 text-[#1a1a1a] font-semibold px-5 py-2 rounded-lg text-sm transition-colors cursor-pointer"
					>
						Guardar borrador
					</button>
				)}
				<button
					type="button"
					onClick={onSave}
					disabled={saving}
					className="bg-[#1a1a1a] hover:bg-[#333] disabled:opacity-50 text-white font-semibold px-6 py-2 rounded-lg text-sm transition-colors font-sora cursor-pointer"
				>
					{saving ? "Preparando…" : "Continuar con el pedido →"}
				</button>
			</div>
		</div>
	);
}
