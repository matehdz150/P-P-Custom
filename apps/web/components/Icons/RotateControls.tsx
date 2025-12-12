"use client";

import { useId } from "react";

type Props = {
	label: string;
	value: number;
	onChange: (value: number) => void;
};

export default function RotationInput({ label, value, onChange }: Props) {
	const inputId = useId();

	return (
		<div className="flex flex-col gap-2">
			<label className="text-sm font-medium" htmlFor={inputId}>
				{label}
			</label>

			<div className="flex border rounded-[0.2rem] overflow-hidden justify-between bg-white">
				<input
					id={inputId}
					type="number"
					className="px-2 py-3 text-sm outline-none w-full bg-white"
					value={value}
					onChange={(e) => onChange(Number(e.target.value))}
				/>

				<div className="px-2 bg-[#f6f5ee] text-gray-600 text-sm flex items-center">
					Gdo
				</div>
			</div>
		</div>
	);
}
