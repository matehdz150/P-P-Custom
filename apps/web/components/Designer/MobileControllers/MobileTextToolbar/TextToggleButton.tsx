"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type TextToggleButtonProps = {
	active: boolean;
	onClick: () => void;
	children: ReactNode;
	ariaLabel?: string;
};

export function TextToggleButton({
	active,
	onClick,
	children,
	ariaLabel,
}: TextToggleButtonProps) {
	return (
		<button
			type="button"
			aria-label={ariaLabel}
			onClick={onClick}
			className={cn(
				"h-9 w-9 flex items-center justify-center rounded-[0.2rem] transition",
				"border border-transparent",
				active
					? "bg-tinta text-hueso-suave"
					: "bg-transparent text-gray-700 hover:bg-gray-100",
			)}
		>
			{children}
		</button>
	);
}
