"use client";

import { useId } from "react";

type Props = {
	value: number; // 0–1
	onChange: (value: number) => void;
};

export default function OpacityControlMobile({ value, onChange }: Props) {
	const pct = Math.round(value * 100);
	const displayId = useId();

	const setPct = (next: number) => {
		const clamped = Math.min(100, Math.max(0, next));
		onChange(clamped / 100);
	};

	return (
		<div className="space-y-2">
			{/* LABEL */}
			<label className="text-sm font-medium text-[#3b3b2f]" htmlFor={displayId}>
				Opacidad
			</label>

			{/* CONTROL */}
			<div className="flex items-center gap-2">
				{/* − */}
				<button
					type="button"
					onClick={() => setPct(pct - 5)}
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
					value={`${pct} %`}
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
					onClick={() => setPct(pct + 5)}
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
