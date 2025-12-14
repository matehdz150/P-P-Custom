"use client";

import type { Textbox } from "fabric";
import { useId } from "react";
import { useHistory } from "@/Contexts/HistoryContext";
import ColorPickerHex from "@/components/Icons/ColorPickerHex";
import OpacityControl from "@/components/Icons/OpacityControls";
import { ChangePropertyCommand } from "@/lib/history/commands/ChangePropertyCommand";
import { useIsMobile } from "../../hooks/useIsMobile";
import LineHeightControlMobile from "../../MobileControllers/LineHeightControlMobile";
import OpacityControlMobile from "../../MobileControllers/OpacityControlMobile";
import RotationControlMobile from "../../MobileControllers/RotationControlMobile";

export default function TextControls({ obj }: { obj: Textbox }) {
	const { execute } = useHistory();
	const isMobile = useIsMobile();

	const lineHeightId = useId();
	const rotationId = useId();

	return (
		<div className="pl-4 pr-4 pb-5 mt-4 space-y-4 flex flex-col gap-2">
			{/* COLOR – solo desktop */}
			{!isMobile && (
				<ColorPickerHex
					value={obj.fill as string}
					onChange={(c) => execute(new ChangePropertyCommand(obj, "fill", c))}
				/>
			)}

			{/* OPACITY */}
			{isMobile ? (
				<OpacityControlMobile
					value={obj.opacity ?? 1}
					onChange={(v) =>
						execute(new ChangePropertyCommand(obj, "opacity", v))
					}
				/>
			) : (
				<OpacityControl
					value={obj.opacity ?? 1}
					onChange={(v) =>
						execute(new ChangePropertyCommand(obj, "opacity", v))
					}
				/>
			)}

			{/* LINE HEIGHT */}
			{isMobile ? (
				<LineHeightControlMobile
					value={obj.lineHeight ?? 1}
					onChange={(v) =>
						execute(new ChangePropertyCommand(obj, "lineHeight", v))
					}
				/>
			) : (
				<div className="flex flex-col gap-2">
					<label className="text-sm font-medium" htmlFor={lineHeightId}>
						Altura de texto
					</label>

					<div className="flex border rounded-[0.2rem] overflow-hidden bg-white">
						<input
							id={lineHeightId}
							type="number"
							min={50}
							max={300}
							step={5}
							className="px-2 py-3 text-sm outline-none w-full bg-white"
							value={Math.round((obj.lineHeight ?? 1) * 100)}
							onChange={(e) => {
								const pct = Number(e.target.value);
								execute(
									new ChangePropertyCommand(obj, "lineHeight", pct / 100),
								);
							}}
						/>
						<div className="px-2 bg-[#f6f5ee] text-gray-600 text-sm flex items-center">
							%
						</div>
					</div>
				</div>
			)}

			{/* ROTATION */}
			{isMobile ? (
				<RotationControlMobile
					value={obj.angle ?? 0}
					onChange={(v) => execute(new ChangePropertyCommand(obj, "angle", v))}
				/>
			) : (
				<div className="flex flex-col gap-2">
					<label className="text-sm font-medium" htmlFor={rotationId}>
						Rotar
					</label>

					<div className="flex border rounded-[0.2rem] overflow-hidden bg-white">
						<input
							id={rotationId}
							type="number"
							className="px-2 py-3 text-sm outline-none w-full bg-white"
							value={obj.angle ?? 0}
							onChange={(e) =>
								execute(
									new ChangePropertyCommand(
										obj,
										"angle",
										Number(e.target.value),
									),
								)
							}
						/>
						<div className="px-2 bg-[#f6f5ee] text-gray-600 text-sm flex items-center">
							°
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
