"use client";

import { Type } from "lucide-react";

type ColorPickerButtonProps = {
	color: string;
	active?: boolean;
	onClick: () => void;
};

export function ColorPickerButton({ color, onClick }: ColorPickerButtonProps) {
	return (
		<button type="button" onClick={onClick} aria-label="Color" className="px-2">
			<div className="flex flex-col items-center gap-0.5">
				<Type size={22} />
				<div
					className="w-5 h-1 rounded-full"
					style={{ backgroundColor: color }}
				/>
			</div>
		</button>
	);
}
