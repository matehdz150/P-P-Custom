"use client";

import { type Object as FabricObject, type Group, IText } from "fabric";
import { useEffect, useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";

import { convertPlainToCurved } from "@/lib/fabric/convertPlainToCurved";
import { updateCurvedAmount } from "@/lib/fabric/editableCurvedText";

export default function DesignerPropertiesPanel() {
	const { canvas, activeObject } = useDesigner();
	const [curve, setCurve] = useState(0);

	// Cuando cambia el objeto seleccionado, actualizamos el slider
	useEffect(() => {
		if (!activeObject) {
			setCurve(0);
			return;
		}

		const cfg = (
			activeObject as FabricObject & {
				__curveConfig?: { curved?: number };
			}
		).__curveConfig;

		if (
			(activeObject as FabricObject & { designType?: string }).designType ===
				"curved-text" &&
			cfg
		) {
			setCurve(cfg.curved ?? 0);
		} else {
			setCurve(0);
		}
	}, [activeObject]);

	if (!canvas || !activeObject) return null;

	const handleCurveChange = (value: number) => {
		setCurve(value);

		if (!canvas) return;

		const current = canvas.getActiveObject();
		if (!current) return;

		const designType = (current as FabricObject & { designType?: string })
			.designType;
		const isPlain = current instanceof IText && !designType;
		const isCurved = designType === "curved-text";

		if (value === 0) {
			if (isCurved) updateCurvedAmount(canvas, current as Group, 0);
			return;
		}

		if (isPlain) {
			convertPlainToCurved(canvas, current as IText, {
				radius: 150,
				spacing: 12,
				direction: "arc-up",
				curved: value,
			});
			return;
		}

		if (isCurved) {
			updateCurvedAmount(canvas, current as Group, value);
		}
	};

	return (
		<div className="w-[260px] border-l bg-white p-4 text-sm">
			<h2 className="font-semibold mb-3">Propiedades</h2>

			<label className="flex flex-col gap-1">
				<span className="text-xs text-gray-600">Curva</span>

				<input
					type="range"
					min={0}
					max={100}
					value={curve}
					onChange={(e) => handleCurveChange(Number(e.target.value))}
					className="w-full"
				/>

				<span className="text-xs text-gray-500">{curve}</span>
			</label>
		</div>
	);
}
