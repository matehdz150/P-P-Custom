"use client";

import { useId } from "react";
import { Slider } from "@/components/ui/slider";

type Props = {
	value: number;
	onChange: (value: number) => void;
};

export default function OpacityControl({ value, onChange }: Props) {
	const sliderId = useId();

	return (
		<div className="space-y-2">
			{/* LABEL + % INPUT */}
			<div className="flex justify-between items-center">
				<label className="text-sm font-medium" htmlFor={sliderId}>
					Opacidad
				</label>

				{/* % Box */}
				<div className="flex items-center gap-1 text-sm">
					<input
						id={sliderId}
						type="number"
						min={0}
						max={100}
						value={Math.round(value * 100)}
						onChange={(e) => onChange(Number(e.target.value) / 100)}
						className="w-14 border rounded px-2 py-1 text-right text-sm bg-white"
					/>
					<span className="text-gray-500">%</span>
				</div>
			</div>

			<Slider
				value={[value * 100]}
				onValueChange={([v]) => onChange(v / 100)}
				max={100}
				step={1}
			/>
		</div>
	);
}
