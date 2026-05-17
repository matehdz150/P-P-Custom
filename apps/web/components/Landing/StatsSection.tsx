import { Sora } from "next/font/google";

const sora = Sora({
	subsets: ["latin-ext"],
	weight: ["600", "700", "800"],
	display: "swap",
});

const STATS = [
	{ value: "50+", label: "Productos disponibles" },
	{ value: "100%", label: "Bordado premium" },
	{ value: "7–14", label: "Días de entrega" },
	{ value: "∞", label: "Posibilidades de diseño" },
];

export default function StatsSection() {
	return (
		<section className={`${sora.className} bg-[#1a1a17] py-12 px-6`}>
			<div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
				{STATS.map((stat) => (
					<div key={stat.label} className="flex flex-col items-center gap-1">
						<span className="text-4xl font-black text-[#fe6241]">
							{stat.value}
						</span>
						<span className="text-sm text-[#aaa] font-medium leading-tight">
							{stat.label}
						</span>
					</div>
				))}
			</div>
		</section>
	);
}
