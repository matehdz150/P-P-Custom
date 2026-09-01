/** Chevron de los botones, igual que en la landing y el catálogo. */
export function Chevron({ className }: { className?: string }) {
	return (
		<svg
			width="15"
			height="15"
			viewBox="0 0 14 14"
			fill="none"
			aria-hidden="true"
			className={className}
		>
			<path
				d="M5.833 10.5L9.333 7L5.833 3.5"
				stroke="currentColor"
				strokeWidth="1.7"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

/** Palomita de las micro-garantías. */
export function Palomita() {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden="true"
			className="shrink-0 text-lima-oscuro md:h-[15px] md:w-[15px]"
		>
			<path
				d="M4.5 12.6l4.8 4.8L19.5 7.2"
				stroke="currentColor"
				strokeWidth="3"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}
