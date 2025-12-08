"use client";

interface Props {
	currentSide: string;
	sides: string[];
	onChange: (side: string) => void;
}

export default function DesignerSideSwitcher({
	currentSide,
	sides,
	onChange,
}: Props) {
	return (
		<div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-3 bg-white/70 backdrop-blur-sm px-4 py-2 rounded-full shadow-md border z-100">
			{sides.map((side) => (
				<button
					key={side}
					type="button"
					onClick={() => onChange(side)}
					className={`px-4 py-1.5 text-sm rounded-md border transition ${
						currentSide === side
							? "bg-black text-white border-black"
							: "bg-white text-black border-gray-300 hover:bg-gray-100"
					}`}
				>
					{side}
				</button>
			))}
		</div>
	);
}
