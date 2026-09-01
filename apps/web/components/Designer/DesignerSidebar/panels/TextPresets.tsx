"use client";

import { type FabricObject, Textbox } from "fabric";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import { useHistory } from "@/Contexts/HistoryContext";
import { useElementGuard } from "@/components/Designer/hooks/useProductConfig";
import { makeAreaClip } from "@/lib/fabric/areaClip";
import { CurvedText } from "@/lib/fabric/CurvedText";
import {
	type PresetElement,
	TEXT_PRESETS,
	type TextPreset,
} from "@/lib/fabric/textPresets";
import { AddObjectCommand } from "@/lib/history/commands/AddObjectCommand";
import { GroupCommand } from "@/lib/history/commands/GroupCommand";

const SELECCION = "#2b2812";

/** Cuántos diseños se asoman en la tira antes de abrirlos todos. */
const ASOMADOS = 6;

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

// ── preview SVG: arco aproximado para líneas curvadas ───────────────────────
function PresetThumb({ preset }: { preset: TextPreset }) {
	const VB = 280;
	const cx = VB / 2;
	const cy = VB / 2;

	return (
		<svg
			viewBox={`0 0 ${VB} ${VB}`}
			className="w-full h-full"
			preserveAspectRatio="xMidYMid meet"
		>
			<title>{preset.name}</title>
			{preset.elements.map((el, i) => {
				const ex = cx + (el.dx ?? 0);
				const ey = cy + el.dy;
				const fontStyle = el.italic ? "italic" : "normal";
				const fontWeight = el.weight ?? "normal";
				const family = `"${el.font}"`;

				if (el.curvature && el.curvature !== 0) {
					// ancho aprox del texto y sagitta según curvatura
					const w = Math.min(VB * 0.92, el.text.length * el.size * 0.62);
					const sag = (Math.abs(el.curvature) / 100) * el.size * 2.2;
					const dir = el.curvature < 0 ? -1 : 1; // -1 arch up
					const pid = `arc-${preset.id}-${i}`;
					// Q: punto de control desplazado para curvar
					const d = `M ${ex - w / 2} ${ey} Q ${ex} ${ey + dir * sag * 2} ${ex + w / 2} ${ey}`;
					return (
						<g key={pid}>
							<path id={pid} d={d} fill="none" />
							<text
								fontFamily={family}
								fontSize={el.size}
								fontStyle={fontStyle}
								fontWeight={fontWeight}
								fill="#111"
							>
								<textPath
									href={`#${pid}`}
									startOffset="50%"
									textAnchor="middle"
								>
									{el.text}
								</textPath>
							</text>
						</g>
					);
				}

				return (
					<text
						key={`${preset.id}-${i}`}
						x={ex}
						y={ey}
						fontFamily={family}
						fontSize={el.size}
						fontStyle={fontStyle}
						fontWeight={fontWeight}
						textAnchor="middle"
						dominantBaseline="middle"
						fill="#111"
						letterSpacing={el.spacing ?? 0}
					>
						{el.text}
					</text>
				);
			})}
		</svg>
	);
}

export default function TextPresets() {
	const { getCanvas, getEditableAreas, setActiveObject } = useDesigner();
	const { execute } = useHistory();
	const guard = useElementGuard();

	const makeClip = (area: FabricObject | null) => makeAreaClip(area);

	const buildElement = (
		el: PresetElement,
		cx: number,
		cy: number,
		clip: FabricObject | undefined,
	): FabricObject => {
		const left = cx + (el.dx ?? 0);
		const top = cy + el.dy;
		const common = {
			left,
			top,
			originX: "center" as const,
			originY: "center" as const,
			fontSize: el.size,
			fontFamily: el.font,
			fontWeight: el.weight ?? "normal",
			fontStyle: el.italic ? "italic" : "normal",
			fill: "#000000",
		};

		let obj: FabricObject;
		if (el.curvature && el.curvature !== 0) {
			obj = new CurvedText({
				text: el.text,
				curvature: el.curvature,
				spacing: el.spacing ?? 2,
				...common,
			} as never);
		} else {
			obj = new Textbox(el.text, {
				...common,
				textAlign: "center",
				width: Math.max(120, el.text.length * el.size * 0.62),
				charSpacing: (el.spacing ?? 0) * 20,
			});
		}
		if (clip) obj.clipPath = clip;
		applySelectionStyle(obj);
		return obj;
	};

	const insertPreset = (preset: TextPreset) => {
		const canvas = getCanvas();
		if (!canvas) return;
		if (!guard.canAdd(preset.elements.length)) return;

		const area = getEditableAreas?.()?.[0] ?? null;
		let cx = canvas.getWidth() / 2;
		let cy = canvas.getHeight() / 2;
		if (area) {
			const b = area.getBoundingRect();
			cx = b.left + b.width / 2;
			cy = b.top + b.height / 2;
		}

		const cmds = preset.elements.map((el) => {
			// cada elemento necesita su propio clip (no se puede compartir)
			const clip = makeClip(area);
			return new AddObjectCommand(buildElement(el, cx, cy, clip));
		});

		execute(new GroupCommand(cmds));

		// seleccionar el último elemento insertado
		const objs = canvas.getObjects();
		const last = objs[objs.length - 1];
		if (last) {
			canvas.setActiveObject(last);
			setActiveObject(last);
		}
		canvas.requestRenderAll();
	};

	const [abierto, setAbierto] = useState(false);
	const visibles = abierto ? TEXT_PRESETS : TEXT_PRESETS.slice(0, ASOMADOS);

	const miniatura = (preset: TextPreset) => (
		<button
			key={preset.id}
			type="button"
			onClick={() => insertPreset(preset)}
			title={preset.name}
			className={`aspect-square rounded-lg border border-gray-200 bg-white p-2
				hover:border-tinta hover:shadow-sm transition flex items-center justify-center
				${abierto ? "" : "w-[104px] shrink-0"}`}
		>
			<PresetThumb preset={preset} />
		</button>
	);

	return (
		<div>
			<div className="mt-2 mb-3 flex items-center justify-between gap-3">
				<h3 className="text-md font-semibold">Diseños</h3>
				<button
					type="button"
					onClick={() => setAbierto((v) => !v)}
					className="flex items-center gap-1 text-sm font-medium text-tinta hover:underline"
				>
					{abierto ? (
						"Ver menos"
					) : (
						<>
							<Plus size={16} />
							Ver más
						</>
					)}
				</button>
			</div>

			{abierto ? (
				<div className="grid grid-cols-2 gap-3">{visibles.map(miniatura)}</div>
			) : (
				// Tira horizontal: una fila en vez de media pantalla. El margen
				// negativo deja que se recorran hasta el borde del panel.
				<div className="-mx-6 overflow-x-auto px-6 pb-1">
					<div className="flex w-max gap-3">{visibles.map(miniatura)}</div>
				</div>
			)}
		</div>
	);
}
