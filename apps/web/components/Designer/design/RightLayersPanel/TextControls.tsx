"use client";

import type { Textbox } from "fabric";
import { useId } from "react";
import { useHistory } from "@/Contexts/HistoryContext";
import ColorPickerHex from "@/components/Icons/ColorPickerHex";
import OpacityControl from "@/components/Icons/OpacityControls";
import { ChangePropertyCommand } from "@/lib/history/commands/ChangePropertyCommand";

export default function TextControls({ obj }: { obj: Textbox }) {
	const { execute } = useHistory();
	const lineHeightId = useId();
	const rotationId = useId();

	return (
		<div className="pl-14 pr-4 pb-5 mt-4 space-y-4 flex flex-col gap-2">
			{/* COLOR */}
			<div>
				<ColorPickerHex
					value={obj.fill as string}
					onChange={(c) => execute(new ChangePropertyCommand(obj, "fill", c))}
				/>
			</div>

			{/* OPACITY */}
			<OpacityControl
				value={obj.opacity ?? 1}
				onChange={(v) => execute(new ChangePropertyCommand(obj, "opacity", v))}
			/>

			{/* LINE HEIGHT */}
			<div className="flex flex-col gap-2">
				<label className="text-sm font-medium" htmlFor={lineHeightId}>
					Altura de texto
				</label>

				<div className="flex border rounded-[0.2rem] overflow-hidden justify-between bg-white">
					<input
						id={lineHeightId}
						type="number"
						min={50}
						max={300}
						step={5}
						className="px-2 py-3 text-sm outline-none w-full bg-white"
						value={Math.round((obj.lineHeight ?? 1) * 100)}
						onChange={(e) => {
							const pct = Number(e.target.value); // ej. 120
							const normalized = pct / 100; // ej. 1.2

							execute(new ChangePropertyCommand(obj, "lineHeight", normalized));
						}}
					/>

					<div className="px-2 bg-[#f6f5ee] text-gray-600 text-sm flex items-center">
						%
					</div>
				</div>
			</div>

			{/* ROTATION */}
			<div className="flex flex-col gap-2">
				<label className="text-sm font-medium" htmlFor={rotationId}>
					Rotar
				</label>

				<div className="flex border rounded-[0.2rem] overflow-hidden justify-between bg-white ">
					<input
						id={rotationId}
						type="number"
						className="px-2 py-3 text-sm outline-none w-full bg-white"
						value={obj.angle ?? 0}
						onChange={(e) =>
							execute(
								new ChangePropertyCommand(obj, "angle", Number(e.target.value)),
							)
						}
					/>

					<div className="px-2 bg-[#f6f5ee] text-gray-600 text-sm flex items-center">
						Gdo
					</div>
				</div>
			</div>
		</div>
	);
}
