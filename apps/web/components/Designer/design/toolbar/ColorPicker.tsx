"use client";

import { Type } from "lucide-react";
import { useRef } from "react";

export default function ColorPickerMinimal({
	value,
	onChange,
}: {
	value: string;
	onChange: (color: string) => void;
}) {
	const colorInputRef = useRef<HTMLInputElement>(null);

	return (
		<div className="flex items-center">
			{/* Icon + underline */}
			<button
				type="button"
				className="flex flex-col items-center cursor-pointer"
				onClick={() => colorInputRef.current?.click()}
			>
				<Type size={22} className="text-black" />

				{/* Dynamic underline showing current color */}
				<div
					className="w-8 h-1 rounded mt-1"
					style={{ backgroundColor: value }}
				/>
			</button>

			{/* Hidden native color input */}
			<input
				ref={colorInputRef}
				type="color"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className="absolute opacity-0 w-0 h-0 pointer-events-none"
			/>
		</div>
	);
}
