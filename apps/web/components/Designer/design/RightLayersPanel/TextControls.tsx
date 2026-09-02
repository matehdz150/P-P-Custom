"use client";

import type { Textbox } from "fabric";
import { useId } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import { useHistory } from "@/Contexts/HistoryContext";
import ColorPickerHex from "@/components/Icons/ColorPickerHex";
import OpacityControl from "@/components/Icons/OpacityControls";
import { CurvedText } from "@/lib/fabric/CurvedText";
import { ChangePropertyCommand } from "@/lib/history/commands/ChangePropertyCommand";
import { useIsMobile } from "../../hooks/useIsMobile";
import LineHeightControlMobile from "../../MobileControllers/LineHeightControlMobile";
import OpacityControlMobile from "../../MobileControllers/OpacityControlMobile";
import RotationControlMobile from "../../MobileControllers/RotationControlMobile";

type TextLike = Textbox | CurvedText;

export default function TextControls({ obj }: { obj: TextLike }) {
	const { execute } = useHistory();
	const { getCanvas } = useDesigner();
	const isMobile = useIsMobile();

	const lineHeightId = useId();
	const rotationId = useId();
	const radiusId = useId();
	const textId = useId();

	const isCurved = obj instanceof CurvedText;

	// Update curved text content and immediately re-render
	const handleTextChange = (value: string) => {
		if (!(obj instanceof CurvedText)) return;
		execute(new ChangePropertyCommand(obj, "text", value));
		const canvas = getCanvas();
		canvas?.requestRenderAll();
	};

	// Update curvature % and immediately re-render
	const handleRadiusChange = (value: number) => {
		if (!(obj instanceof CurvedText)) return;
		execute(new ChangePropertyCommand(obj, "curvature", value));
		const canvas = getCanvas();
		canvas?.requestRenderAll();
	};

	return (
		<div className="pl-4 pr-4 pb-5 mt-4 space-y-4 flex flex-col gap-2">
			{/* ── CURVED TEXT CONTROLS ─────────────────────────────────── */}
			{isCurved && (
				<>
					{/* Text content input */}
					<div className="flex flex-col gap-2">
						<label className="text-sm font-medium" htmlFor={textId}>
							Texto
						</label>
						<div className="flex border rounded-[0.2rem] overflow-hidden bg-white">
							<input
								id={textId}
								type="text"
								className="px-2 py-3 text-sm outline-none w-full bg-white"
								value={(obj as CurvedText).text}
								onChange={(e) => handleTextChange(e.target.value)}
							/>
						</div>
					</div>

					{/* Curvature slider -100 → 0 → +100 */}
					<div className="flex flex-col gap-2">
						<div className="flex items-center justify-between">
							<label className="text-sm font-medium" htmlFor={radiusId}>
								Curvatura
							</label>
							<div className="flex items-center gap-1">
								<div className="flex border rounded-[0.2rem] overflow-hidden bg-white">
									<input
										id={radiusId}
										type="number"
										min={-100}
										max={100}
										step={1}
										className="w-14 px-2 py-1.5 text-sm outline-none bg-white text-right"
										value={(obj as CurvedText).curvature}
										onChange={(e) =>
											handleRadiusChange(
												Math.max(-100, Math.min(100, Number(e.target.value))),
											)
										}
									/>
									<div className="px-2 bg-[#f6f5ee] text-gray-600 text-sm flex items-center">
										%
									</div>
								</div>
							</div>
						</div>

						<input
							type="range"
							min={-100}
							max={100}
							step={1}
							className="w-full accent-tinta"
							value={(obj as CurvedText).curvature}
							onChange={(e) => handleRadiusChange(Number(e.target.value))}
						/>

						<div className="flex justify-between text-[10px] text-gray-400">
							<span>⌒ Arch up</span>
							<span>Plano</span>
							<span>⌣ Arch down</span>
						</div>
					</div>
				</>
			)}

			{/* ── COLOR — solo desktop ──────────────────────────────────── */}
			{!isMobile && (
				<ColorPickerHex
					value={obj.fill as string}
					onChange={(c) => execute(new ChangePropertyCommand(obj, "fill", c))}
				/>
			)}

			{/* ── OPACITY ──────────────────────────────────────────────── */}
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

			{/* ── LINE HEIGHT — solo Textbox ───────────────────────────── */}
			{!isCurved && (
				<>
					{isMobile ? (
						<LineHeightControlMobile
							value={(obj as Textbox).lineHeight ?? 1}
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
									value={Math.round(((obj as Textbox).lineHeight ?? 1) * 100)}
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
				</>
			)}

			{/* ── ROTATION ────────────────────────────────────────────── */}
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
