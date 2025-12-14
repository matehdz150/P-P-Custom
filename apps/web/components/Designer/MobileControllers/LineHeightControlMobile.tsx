"use client";

import { useId } from "react";

type Props = {
	value: number; // lineHeight normalizado (ej: 1.2)
	onChange: (value: number) => void;
};

export default function LineHeightControlMobile({ value, onChange }: Props) {
	const pct = Math.round(value * 100);
	const displayId = useId();

	const change = (delta: number) => {
		const next = Math.min(300, Math.max(50, pct + delta));
		onChange(next / 100);
	};

	return (
		<div className="space-y-2">
			{/* LABEL */}
			<label className="text-sm font-medium text-[#3b3b2f]" htmlFor={displayId}>
				Altura de texto
			</label>

			{/* CONTROL */}
			<div className="flex items-center gap-2">
				{/* − */}
				<button
					type="button"
					onClick={() => change(-10)}
					className="
            w-10 h-10
            border rounded
            flex items-center justify-center
            text-lg
            bg-white
            active:bg-gray-100
          "
				>
					−
				</button>

				{/* VALUE */}
				<input
					id={displayId}
					readOnly
					value={`${pct}%`}
					className="
	            flex-1
	            h-10
	            border rounded
	            text-center
	            text-sm font-medium
	            bg-white
	          "
				/>

				{/* + */}
				<button
					type="button"
					onClick={() => change(10)}
					className="
            w-10 h-10
            border rounded
            flex items-center justify-center
            text-lg
            bg-white
            active:bg-gray-100
          "
				>
					+
				</button>
			</div>
		</div>
	);
}
