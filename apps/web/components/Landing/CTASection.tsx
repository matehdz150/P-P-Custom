import { Sora } from "next/font/google";
import Link from "next/link";

const sora = Sora({
	subsets: ["latin-ext"],
	weight: ["400", "700", "800"],
	display: "swap",
});

export default function CTASection() {
	return (
		<section className={`${sora.className} bg-[#1a1a17] py-24 px-6`}>
			<div className="max-w-3xl mx-auto text-center flex flex-col items-center gap-6">
				<h2 className="text-4xl sm:text-5xl font-black text-white leading-tight uppercase tracking-tight">
					¿Listo para crear
					<br />
					<span className="text-[#fe6241]">algo increíble?</span>
				</h2>
				<p className="text-[#aaa] text-base font-light max-w-md">
					Únete a cientos de clientes que ya están personalizando sus productos
					con bordado de alta calidad.
				</p>
				<Link
					href="/catalogo"
					className="mt-2 px-12 py-4 bg-[#fe6241] text-black font-bold text-base rounded-sm hover:bg-[#e5573a] transition-colors"
				>
					Explorar catálogo
				</Link>
				<span className="text-xs text-[#666]">
					Sin tarjeta de crédito requerida
				</span>
			</div>
		</section>
	);
}
