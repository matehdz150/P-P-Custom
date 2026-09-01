"use client";

import { type FabricObject, Group, Path } from "fabric";
import { X } from "lucide-react";
import { useDesigner } from "@/Contexts/DesignerContext";
import { useHistory } from "@/Contexts/HistoryContext";
import { useElementGuard } from "@/components/Designer/hooks/useProductConfig";
import { makeAreaClip } from "@/lib/fabric/areaClip";
import { GRAPHICS, SHAPES, type ShapeDef } from "@/lib/fabric/shapes";
import { AddObjectCommand } from "@/lib/history/commands/AddObjectCommand";

const SELECCION = "#2b2812";

function applySelectionStyle(obj: FabricObject) {
	obj.set({
		transparentCorners: false,
		cornerColor: "#ffffff",
		cornerStrokeColor: SELECCION,
		borderColor: SELECCION,
		cornerSize: 8,
		cornerStyle: "rect",
	} as never);
}

/** Los trazos de una figura, ya sea mono (un `d`) o gráfico (varios `paths`). */
function trazos(shape: ShapeDef) {
	if (shape.paths) return shape.paths;
	return shape.d ? [{ d: shape.d, fill: undefined }] : [];
}

export default function ShapesPanel({ close }: { close: () => void }) {
	const { getCanvas, getEditableAreas, setActiveObject } = useDesigner();
	const { execute } = useHistory();
	const guard = useElementGuard();

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

		const partes = trazos(shape).map(
			(p) => new Path(p.d, { fill: p.fill ?? "#000000" }),
		);
		if (partes.length === 0) return;

		// Un gráfico a color entra como grupo: es una sola pieza que se mueve
		// y escala junta, pero conserva el color de cada trazo.
		const obj: FabricObject =
			partes.length === 1
				? (partes[0] as FabricObject)
				: new Group(partes as FabricObject[]);

		obj.set({ originX: "center", originY: "center", left: cx, top: cy });

		// Escalar por la caja real y no por los 100 del viewBox: así todas
		// aterrizan del mismo tamaño aunque el trazo no llene el cuadro.
		const lado = Math.max(obj.width || 100, obj.height || 100);
		const scale = target / lado;
		obj.set({ scaleX: scale, scaleY: scale });

		const clip = makeAreaClip(area);
		if (clip) obj.clipPath = clip;
		applySelectionStyle(obj);

		execute(new AddObjectCommand(obj));
		canvas.setActiveObject(obj);
		setActiveObject(obj);
		canvas.requestRenderAll();
	};

	return (
		<div className="h-full flex flex-col">
			<div className="p-6 flex justify-between items-center border-b bg-white">
				<h2 className="font-semibold text-xl text-tinta">Gráficos y formas</h2>
				<button type="button" onClick={close}>
					<X size={22} />
				</button>
			</div>

			<div className="flex-1 overflow-y-auto p-6">
				<Rejilla
					titulo="Gráficos"
					nota="Entran a color. Para cambiarlos, desagrupa."
					lista={GRAPHICS}
					onPick={insertShape}
				/>

				<Rejilla
					titulo="Formas"
					nota="Entran en negro y las recoloreas."
					lista={SHAPES}
					onPick={insertShape}
					className="mt-8"
				/>
			</div>
		</div>
	);
}

function Rejilla({
	titulo,
	nota,
	lista,
	onPick,
	className,
}: {
	titulo: string;
	nota: string;
	lista: ShapeDef[];
	onPick: (s: ShapeDef) => void;
	className?: string;
}) {
	return (
		<div className={className}>
			<h3 className="text-md font-semibold">{titulo}</h3>
			<p className="mb-3 text-xs text-neutral-500">{nota}</p>

			<div className="grid grid-cols-3 gap-3">
				{lista.map((shape) => (
					<button
						key={shape.id}
						type="button"
						onClick={() => onPick(shape)}
						title={shape.name}
						className="aspect-square rounded-lg border border-gray-200 bg-white p-3
							hover:border-tinta hover:shadow-sm transition
							flex items-center justify-center"
					>
						<svg
							viewBox="-2 -2 104 104"
							className="w-full h-full"
							preserveAspectRatio="xMidYMid meet"
						>
							<title>{shape.name}</title>
							{trazos(shape).map((p) => (
								<path key={p.d} d={p.d} fill={p.fill ?? "#5b5b3f"} />
							))}
						</svg>
					</button>
				))}
			</div>
		</div>
	);
}
