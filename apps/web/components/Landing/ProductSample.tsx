import { Sora } from "next/font/google";
import Image from "next/image";
import Link from "next/link";

const sora = Sora({
	subsets: ["latin-ext"],
	weight: ["300", "400", "600", "700", "800"],
	display: "swap",
});

const CATEGORIES = [
	{
		img: "/event1.png",
		label: "Para eventos",
		desc: "Uniformes, gorras y más para tu próximo evento.",
	},
	{
		img: "/business.png",
		label: "Para negocios",
		desc: "Branding profesional bordado en tus artículos.",
	},
	{
		img: "/event2.png",
		label: "Personalizado",
		desc: "Cualquier diseño, cualquier artículo.",
	},
];

export default function ProductSample() {
	return (
		<section className={`${sora.className} bg-[#f9f8f5] py-20 px-6`}>
			<div className="max-w-6xl mx-auto">
				{/* Heading */}
				<div className="mb-12 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
					<div>
						<h2 className="text-3xl sm:text-4xl font-black text-[#1a1a17] leading-tight">
							Tu marca,
							<br />
							en buenas manos
						</h2>
						<p className="mt-2 text-sm text-[#777] font-light">
							Tecnología de bordado moderna y materiales de alta calidad.
						</p>
					</div>
					<Link
						href="/catalogo"
						className="text-sm font-semibold text-[#1a1a17] underline underline-offset-4 hover:text-[#fe6241] transition-colors whitespace-nowrap"
					>
						Ver catálogo completo →
					</Link>
				</div>

				{/* Grid */}
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
					{CATEGORIES.map((cat) => (
						<Link
							href="/catalogo"
							key={cat.label}
							className="group relative overflow-hidden rounded-xl aspect-[3/4] block shadow-sm"
						>
							<Image
								src={cat.img}
								alt={cat.label}
								fill
								className="object-cover transition-transform duration-500 group-hover:scale-105"
							/>
							<div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
							<div className="absolute bottom-0 left-0 p-5">
								<h3 className="text-white font-bold text-lg leading-tight">
									{cat.label}
								</h3>
								<p className="text-white/75 text-xs mt-1 font-light">
									{cat.desc}
								</p>
							</div>
						</Link>
					))}
				</div>
			</div>
		</section>
	);
}
