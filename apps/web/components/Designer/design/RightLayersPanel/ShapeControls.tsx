"use client";

import type { Path } from "fabric";
import { useId } from "react";
import { useHistory } from "@/Contexts/HistoryContext";
import ColorPickerHex from "@/components/Icons/ColorPickerHex";
import OpacityControl from "@/components/Icons/OpacityControls";
import RotationInput from "@/components/Icons/RotateControls";
import { ChangePropertyCommand } from "@/lib/history/commands/ChangePropertyCommand";

export default function ShapeControls({ obj }: { obj: Path }) {
	const { execute } = useHistory();
	const strokeWidthId = useId();

	const fill = typeof obj.fill === "string" ? obj.fill : "#000000";
	const stroke =
		typeof obj.stroke === "string" ? obj.stroke : "#000000";
	const strokeWidth = obj.strokeWidth ?? 0;

	return (
		<div className="pl-4 pr-4 pb-5 mt-4 space-y-4 flex flex-col gap-2">
			{/* RELLENO */}
			<div className="flex flex-col gap-1">
				<span className="text-sm font-medium">Color de relleno</span>
				<ColorPickerHex
					value={fill}
					onChange={(c) =>
						execute(new ChangePropertyCommand(obj, "fill", c))
					}
				/>
			</div>

			{/* COLOR DE BORDE */}
			<div className="flex flex-col gap-1">
				<span className="text-sm font-medium">Color de borde</span>
				<ColorPickerHex
					value={stroke}
					onChange={(c) =>
						execute(new ChangePropertyCommand(obj, "stroke", c))
					}
				/>
			</div>

			{/* TAMAÑO DE BORDE */}
			<div className="flex flex-col gap-2">
				<div className="flex items-center justify-between">
					<label className="text-sm font-medium" htmlFor={strokeWidthId}>
						Tamaño de borde
					</label>
					<div className="flex border rounded-[0.2rem] overflow-hidden bg-white">
						<input
							id={strokeWidthId}
							type="number"
							min={0}
							max={50}
							step={1}
							className="w-14 px-2 py-1.5 text-sm outline-none bg-white text-right"
							value={strokeWidth}
							onChange={(e) =>
								execute(
									new ChangePropertyCommand(
										obj,
										"strokeWidth",
										Math.max(0, Number(e.target.value)),
									),
								)
							}
						/>
						<div className="px-2 bg-[#f6f5ee] text-gray-600 text-sm flex items-center">
							px
						</div>
					</div>
				</div>
				<input
					type="range"
					min={0}
					max={50}
					step={1}
					className="w-full accent-tinta"
					value={strokeWidth}
					onChange={(e) =>
						execute(
							new ChangePropertyCommand(
								obj,
								"strokeWidth",
								Number(e.target.value),
							),
						)
					}
				/>
			</div>

			{/* OPACIDAD */}
			<OpacityControl
				value={obj.opacity ?? 1}
				onChange={(v) =>
					execute(new ChangePropertyCommand(obj, "opacity", v))
				}
			/>

			{/* ROTAR */}
			<RotationInput
				label="Rotar"
				value={obj.angle ?? 0}
				onChange={(angle) =>
					execute(new ChangePropertyCommand(obj, "angle", angle))
				}
			/>
		</div>
	);
}
