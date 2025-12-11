"use client";

import { Pipette, Type } from "lucide-react";
import { useRef, useState } from "react";

export default function ColorPickerHex({
	value,
	onChange,
}: {
	value: string;
	onChange: (color: string) => void;
}) {
	const colorInputRef = useRef<HTMLInputElement>(null);
	const [hex, setHex] = useState(value.replace("#", ""));

	const updateColor = (newColor: string) => {
		setHex(newColor.replace("#", ""));
		onChange(newColor.startsWith("#") ? newColor : `#${newColor}`);
	};

	return (
		<div className="flex items-center gap-3 justify-between">
			{/* LEFT: Icon + underline */}
			<button
				type="button"
				className="flex flex-col items-center cursor-pointer"
				onClick={() => colorInputRef.current?.click()}
			>
				<Type size={22} className="text-black" />
				<div
					className="w-8 h-1 rounded mt-1"
					style={{ backgroundColor: value }}
				/>
			</button>

			<div className="flex gap-2">
				{/* MIDDLE: HEX input */}
				<div className="flex border rounded-[0.2rem] overflow-hidden">
					<input
						readOnly
						type="text"
						className="px-2 py-2 w-25 text-sm outline-none bg-white"
						value={hex}
						onChange={(e) => {
							const raw = e.target.value.replace(/[^0-9a-fA-F]/g, "");
							setHex(raw);
							if (raw.length === 6) updateColor(`#${raw}`);
						}}
					/>
					<div className="px-2 bg-[#f6f5ee] flex items-center text-gray-600 text-sm">
						#
					</div>
				</div>

				{/* RIGHT: Eyedropper */}
				<button
					type="button"
					onClick={() => colorInputRef.current?.click()}
					className="p-2 border rounded hover:bg-gray-100"
				>
					<Pipette size={18} />
				</button>
			</div>

			{/* HIDDEN COLOR INPUT */}
			<input
				ref={colorInputRef}
				type="color"
				value={value}
				onChange={(e) => {
					const newColor = e.target.value;
					updateColor(newColor); // <-- ACTUALIZA HEX
				}}
				className="
            absolute
            opacity-0
            w-0 h-0
            pointer-events-none
          "
			/>
		</div>
	);
}
