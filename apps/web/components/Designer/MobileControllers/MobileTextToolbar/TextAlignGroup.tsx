"use client";

import { AlignCenter, AlignLeft, AlignRight } from "lucide-react";
import { cn } from "@/lib/utils";

type AlignValue = "left" | "center" | "right";

type TextAlignGroupProps = {
	value: AlignValue;
	onChange: (value: AlignValue) => void;
};

export function TextAlignGroup({ value, onChange }: TextAlignGroupProps) {
	return (
		<div className="flex rounded-[0.2rem] border overflow-hidden">
			<button
				type="button"
				aria-label="Alinear izquierda"
				onClick={() => onChange("left")}
				className={cn(
					"h-9 w-9 flex items-center justify-center transition border-r",
					value === "left"
						? "bg-black text-white border-r-0"
						: "text-gray-700 hover:bg-gray-100",
				)}
			>
				<AlignLeft size={18} />
			</button>

			<button
				type="button"
				aria-label="Alinear centro"
				onClick={() => onChange("center")}
				className={cn(
					"h-9 w-9 flex items-center justify-center transition border-r",
					value === "center"
						? "bg-black text-white border-r-0"
						: "text-gray-700 hover:bg-gray-100",
				)}
			>
				<AlignCenter size={18} />
			</button>

			<button
				type="button"
				aria-label="Alinear derecha"
				onClick={() => onChange("right")}
				className={cn(
					"h-9 w-9 flex items-center justify-center transition",
					value === "right"
						? "bg-black text-white"
						: "text-gray-700 hover:bg-gray-100",
				)}
			>
				<AlignRight size={18} />
			</button>
		</div>
	);
}
