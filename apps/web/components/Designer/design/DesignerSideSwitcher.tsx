"use client";

interface Props {
	side: "front" | "back";
	onChange: (side: "front" | "back") => void;
}

export default function DesignerSideSwitcher({ side, onChange }: Props) {
	return (
		<div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-3 bg-white/70 backdrop-blur-sm px-4 py-2 rounded-full shadow-md border">
			{/* Front Button */}
			<button
				type="button"
				onClick={() => onChange("front")}
				className={`px-4 py-1.5 text-sm rounded-md border transition ${
					side === "front"
						? "bg-black text-white border-black"
						: "bg-white text-black border-gray-300 hover:bg-gray-100"
				}`}
			>
				Parte delantera
			</button>

			{/* Back Button */}
			<button
				type="button"
				onClick={() => onChange("back")}
				className={`px-4 py-1.5 text-sm rounded-md border transition ${
					side === "back"
						? "bg-black text-white border-black"
						: "bg-white text-black border-gray-300 hover:bg-gray-100"
				}`}
			>
				Parte trasera
			</button>
		</div>
	);
}
