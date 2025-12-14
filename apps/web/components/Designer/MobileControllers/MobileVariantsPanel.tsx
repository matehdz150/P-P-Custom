"use client";

export default function MobileVariantsPanel() {
	return (
		<div className="flex flex-col font-sora px-6 pb-24">
			{/* COLOR */}
			<div className="mt-4">
				<span className="text-lg font-medium text-black font-sora">Color</span>

				<div className="flex gap-4 mt-3">
					{["#ffffff", "#000000", "#6b7280", "#c2410c"].map((color, idx) => (
						<button
							key={color}
							type="button"
							className={`
                h-12 w-12 rounded-full
                border
                ${idx === 0 ? "ring-2 ring-black" : "border-gray-300"}
              `}
							style={{ backgroundColor: color }}
							aria-label={`Color ${color}`}
						/>
					))}
				</div>
			</div>

			{/* TALLA */}
			<div className="mt-8">
				<span className="text-lg font-medium text-black">Talla</span>

				<div className="flex gap-3 mt-3 flex-wrap">
					{["XS", "S", "M", "L", "XL"].map((size) => (
						<button
							key={size}
							type="button"
							className={`
                px-4 py-2 rounded-[0.2rem] text-base font-medium
                border
                ${
									size === "M"
										? "bg-black text-white border-black"
										: "bg-white text-black border-gray-300"
								}
              `}
						>
							{size}
						</button>
					))}
				</div>
			</div>
		</div>
	);
}
