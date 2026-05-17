import { Check } from "lucide-react";
import { Sora } from "next/font/google";
import Image from "next/image";
import Link from "next/link";

const sora = Sora({
	subsets: ["latin-ext"],
	weight: ["300", "400", "500", "600", "700", "800"],
	display: "swap",
});

const CHECKS = [
	"Diseña online",
	"Más de 50 productos",
	"Producción y entrega",
];

export default function HeroSection() {
	return (
		<section className={`${sora.className} bg-white pt-16 pb-0 overflow-hidden`}>
			{/* ─── TEXT BLOCK ─── */}
			<div className="flex flex-col items-center text-center px-6 max-w-4xl mx-auto">
				<h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.05] text-[#1a1a17] uppercase">
					Lo creas tú mismo,
					<br />
					<span className="text-[#fe6241]">nosotros</span> producimos.
				</h1>

				<p className="mt-5 text-base sm:text-lg text-[#555] font-light max-w-xl">
					Diseña productos bordados personalizados desde tu navegador. Nosotros
					nos encargamos de producirlos y entregarlos.
				</p>

				{/* Checks */}
				<div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-5">
					{CHECKS.map((label) => (
						<span
							key={label}
							className="flex items-center gap-1.5 text-sm font-medium text-[#333]"
						>
							<Check className="w-4 h-4 text-[#fe6241]" strokeWidth={2.5} />
							{label}
						</span>
					))}
				</div>

				{/* CTA */}
				<div className="flex flex-col items-center gap-2 mt-8">
					<Link
						href="/catalogo"
						className="px-10 py-4 bg-[#fe6241] text-black font-bold text-base rounded-sm hover:bg-[#e5573a] transition-colors"
					>
						Empieza ahora
					</Link>
					<span className="text-xs text-[#888]">Sin tarjeta de crédito</span>
				</div>
			</div>

			{/* ─── PRODUCT IMAGE SHOWCASE ─── */}
			<div className="mt-14 w-full flex justify-center items-end gap-4 px-4 sm:px-8">
				{/* Left card — slightly taller, offset down */}
				<div className="relative w-[42%] max-w-[340px] aspect-[4/5] overflow-hidden rounded-t-xl shadow-md hidden sm:block self-end translate-y-6">
					<Image
						src="/event1.png"
						alt="Producto para eventos"
						fill
						className="object-cover"
					/>
					<div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
					<span className="absolute bottom-4 left-4 text-white text-sm font-semibold">
						Eventos
					</span>
				</div>

				{/* Center card — tallest, no offset */}
				<div className="relative w-[90%] sm:w-[44%] max-w-[380px] aspect-[4/5] overflow-hidden rounded-t-xl shadow-lg">
					<Image
						src="/business.png"
						alt="Producto para negocios"
						fill
						className="object-cover"
					/>
					<div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
					<span className="absolute bottom-4 left-4 text-white text-sm font-semibold">
						Negocios
					</span>
				</div>

				{/* Right card — medium, offset down */}
				<div className="relative w-[42%] max-w-[340px] aspect-[4/5] overflow-hidden rounded-t-xl shadow-md hidden sm:block self-end translate-y-4">
					<Image
						src="/event2.png"
						alt="Producto personalizado"
						fill
						className="object-cover"
					/>
					<div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
					<span className="absolute bottom-4 left-4 text-white text-sm font-semibold">
						Personalizado
					</span>
				</div>
			</div>
		</section>
	);
}
