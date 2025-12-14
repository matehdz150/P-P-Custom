"use client";

import { useId } from "react";

type Props = {
	value: number; // grados
	onChange: (value: number) => void;
};

export default function RotationControlMobile({ value, onChange }: Props) {
	const rotate = (delta: number) => {
		const next = (value + delta) % 360;
		onChange(next < 0 ? next + 360 : next);
	};
	const displayId = useId();

	return (
		<div className="space-y-2">
			{/* LABEL */}
			<label className="text-sm font-medium text-[#3b3b2f]" htmlFor={displayId}>
				Rotar
			</label>

			{/* CONTROL */}
			<div className="flex items-center gap-2">
				{/* − */}
				<button
					type="button"
					onClick={() => rotate(-15)}
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
					value={`${Math.round(value)}°`}
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
					onClick={() => rotate(15)}
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
