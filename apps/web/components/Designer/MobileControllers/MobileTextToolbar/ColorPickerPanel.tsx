"use client";

import { useEffect, useState } from "react";

const isValidHex = (v: string) => /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(v);

type ColorPickerPanelProps = {
	colors: string[];
	value: string;
	onChange: (color: string) => void;
};

export function ColorPickerPanel({
	colors,
	value,
	onChange,
}: ColorPickerPanelProps) {
	const [hex, setHex] = useState(value);

	// Sync externo → input
	useEffect(() => {
		setHex(value);
	}, [value]);

	// 🔥 APLICAR COLOR EN TIEMPO REAL
	useEffect(() => {
		if (isValidHex(hex)) {
			onChange(hex);
		}
	}, [hex, onChange]);

	return (
		<div
			className="bg-white rounded-[0.2rem] p-3 w-[270px] border"
			style={{ touchAction: "none" }}
			onPointerDown={(e) => e.stopPropagation()}
		>
			{/* Colores default */}
			<div className="flex flex-wrap gap-2">
				{colors.map((c) => (
					<button
						key={c}
						type="button"
						className="w-8 h-8 rounded-full border"
						style={{ background: c }}
						onClick={() => onChange(c)}
						aria-label={`Color ${c}`}
					/>
				))}
			</div>

			{/* Input HEX */}
			<div className="mt-3 flex items-center">
				<span className="px-2 py-2 bg-[#f6f5ee] border rounded-l-[0.2rem]">
					#
				</span>
				<input
					value={hex.replace(/^#/, "")}
					onChange={(e) => {
						const raw = e.target.value
							.replace(/[^0-9A-Fa-f]/g, "")
							.toUpperCase();

						setHex(`#${raw}`);
					}}
					placeholder="RRGGBB"
					className="
            flex-1 py-2 border border-l-0
            rounded-r-[0.2rem]
            text-[16px] uppercase pl-1
            outline-none
          "
				/>
			</div>

			{!isValidHex(hex) && hex.length > 1 && (
				<p className="mt-1 text-xs text-red-500">Hex inválido</p>
			)}
		</div>
	);
}
