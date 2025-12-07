"use client";

interface Props {
	zoom: number;
	zoomIn: () => void;
	zoomOut: () => void;
}

export default function DesignerZoomControls({ zoom, zoomIn, zoomOut }: Props) {
	return (
		<div className="absolute top-6 right-6 bg-white shadow-md border rounded-lg flex items-center gap-2 px-3 py-2 z-50">
			<button
				type="button"
				onClick={zoomOut}
				className="px-2 py-1 border rounded hover:bg-gray-100"
			>
				-
			</button>

			<span className="text-sm w-12 text-center">
				{Math.round(zoom * 100)}%
			</span>

			<button
				type="button"
				onClick={zoomIn}
				className="px-2 py-1 border rounded hover:bg-gray-100"
			>
				+
			</button>
		</div>
	);
}
