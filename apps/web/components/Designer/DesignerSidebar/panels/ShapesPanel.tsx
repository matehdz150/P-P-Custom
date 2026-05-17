"use client";

import { type FabricObject, Path } from "fabric";
import { X } from "lucide-react";
import { useDesigner } from "@/Contexts/DesignerContext";
import { useHistory } from "@/Contexts/HistoryContext";
import { makeAreaClip } from "@/lib/fabric/areaClip";
import { AddObjectCommand } from "@/lib/history/commands/AddObjectCommand";
import { useElementGuard } from "@/components/Designer/hooks/useProductConfig";
import { type ShapeDef, SHAPES } from "@/lib/fabric/shapes";

const ORANGE = "#fe6241";

function applySelectionStyle(obj: FabricObject) {
	obj.set({
		transparentCorners: false,
		cornerColor: "#ffffff",
		cornerStrokeColor: ORANGE,
		borderColor: ORANGE,
		cornerSize: 8,
		cornerStyle: "rect",
	} as never);
}

export default function ShapesPanel({ close }: { close: () => void }) {
	const { getCanvas, getEditableAreas, setActiveObject } = useDesigner();
	const { execute } = useHistory();
	const guard = useElementGuard();

	const makeClip = (area: FabricObject | null) => makeAreaClip(area);

	const insertShape = (shape: ShapeDef) => {
		const canvas = getCanvas();
		if (!canvas) return;
		if (!guard.canAdd(1)) return;

		const area = getEditableAreas?.()?.[0] ?? null;
		let cx = canvas.getWidth() / 2;
		let cy = canvas.getHeight() / 2;
		let target = 260;
		if (area) {
			const b = area.getBoundingRect();
			cx = b.left + b.width / 2;
			cy = b.top + b.height / 2;
			target = Math.min(b.width, b.height) * 0.5;
		}

		// el path está en espacio 0..100 → escalar a `target` px
		const path = new Path(shape.d, {
			fill: "#000000",
			originX: "center",
			originY: "center",
			left: cx,
			top: cy,
		});

		const scale = target / 100;
		path.set({ scaleX: scale, scaleY: scale });

		const clip = makeClip(area);
		if (clip) path.clipPath = clip;
		applySelectionStyle(path);

		execute(new AddObjectCommand(path));
		canvas.setActiveObject(path);
		setActiveObject(path);
		canvas.requestRenderAll();
	};

	return (
		<div className="h-[80%] flex flex-col">
			<div className="p-6 flex justify-between items-center border-b bg-white">
				<h2 className="font-semibold text-xl text-black">
					Gráficos y formas
				</h2>
				<button type="button" onClick={close}>
					<X size={22} />
				</button>
			</div>

			<div className="flex-1 overflow-y-auto p-6">
				<h3 className="mb-3 text-md font-semibold">Formas</h3>
				<div className="grid grid-cols-3 gap-3">
					{SHAPES.map((shape) => (
						<button
							key={shape.id}
							type="button"
							onClick={() => insertShape(shape)}
							title={shape.name}
							className="aspect-square rounded-lg border border-gray-200 bg-white p-3
								hover:border-[#fe6241] hover:shadow-sm transition
								flex items-center justify-center"
						>
							<svg
								viewBox="0 0 100 100"
								className="w-full h-full"
								preserveAspectRatio="xMidYMid meet"
							>
								<title>{shape.name}</title>
								<path d={shape.d} fill="#5b5b3f" />
							</svg>
						</button>
					))}
				</div>
			</div>
		</div>
	);
}
