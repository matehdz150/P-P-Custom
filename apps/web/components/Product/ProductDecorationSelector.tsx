"use client";

type Decoration = "dtg" | "embroidery";

type Props = {
	value: Decoration;
	onChange: (v: Decoration) => void;
};

const OPTIONS: { id: Decoration; label: string; hint: string }[] = [
	{ id: "dtg", label: "DTG", hint: "Estampado directo" },
	{ id: "embroidery", label: "Bordado", hint: "Hilo premium" },
];

export function ProductDecorationSelector({ value, onChange }: Props) {
	return (
		<div className="flex flex-col gap-2">
			<span className="text-sm font-semibold text-[#1a1a17]">
				Método de personalización
			</span>

			<div className="grid grid-cols-2 gap-3">
				{OPTIONS.map((opt) => {
					const active = value === opt.id;
					return (
						<button
							key={opt.id}
							type="button"
							onClick={() => onChange(opt.id)}
							className={`rounded-xl border p-3 text-left transition ${
								active
									? "border-[#fe6241] bg-[#fe6241]/5 ring-1 ring-[#fe6241]"
									: "border-gray-200 hover:border-gray-300"
							}`}
						>
							<p className="text-sm font-bold text-[#1a1a17]">
								{opt.label}
							</p>
							<p className="text-xs text-gray-500">{opt.hint}</p>
						</button>
					);
				})}
			</div>
		</div>
	);
}
