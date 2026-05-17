import { Brush, Package, Truck } from "lucide-react";
import { Sora } from "next/font/google";

const sora = Sora({
	subsets: ["latin-ext"],
	weight: ["300", "400", "600", "700", "800"],
	display: "swap",
});

const FEATURES = [
	{
		icon: Brush,
		title: "Editor en línea",
		desc: "Personaliza colores, textos e imágenes con nuestro editor visual. Visualiza el resultado en tiempo real antes de hacer tu pedido.",
	},
	{
		icon: Package,
		title: "Catálogo amplio",
		desc: "Camisas, gorras, bolsas, uniformes y más. Todos los artículos listos para ser bordados con tu diseño.",
	},
	{
		icon: Truck,
		title: "Producción y entrega",
		desc: "Nosotros gestionamos la producción con maquinaria de bordado industrial y entregamos directo a tus manos.",
	},
];

export default function FeaturesSection() {
	return (
		<section className={`${sora.className} bg-[#f9f8f5] py-20 px-6`}>
			<div className="max-w-5xl mx-auto">
				{/* Heading */}
				<div className="text-center mb-14">
					<h2 className="text-3xl sm:text-4xl font-black text-[#1a1a17] leading-tight">
						Todo lo que necesitas,
						<br />
						en un solo lugar
					</h2>
					<p className="mt-3 text-sm text-[#777] font-light max-w-md mx-auto">
						Desde el diseño hasta la entrega, cubrimos cada paso del proceso.
					</p>
				</div>

				{/* Cards */}
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
					{FEATURES.map((f) => (
						<div
							key={f.title}
							className="bg-white rounded-xl p-7 flex flex-col gap-4 shadow-sm border border-[#ebebeb] hover:shadow-md transition-shadow"
						>
							<div className="w-11 h-11 rounded-lg bg-[#fe6241]/10 flex items-center justify-center">
								<f.icon className="w-5 h-5 text-[#fe6241]" strokeWidth={2} />
							</div>
							<h3 className="font-bold text-lg text-[#1a1a17]">{f.title}</h3>
							<p className="text-sm text-[#666] font-light leading-relaxed">
								{f.desc}
							</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
