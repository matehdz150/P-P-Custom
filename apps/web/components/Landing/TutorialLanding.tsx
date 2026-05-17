import { Sora } from "next/font/google";
import Image from "next/image";
import Link from "next/link";

const sora = Sora({
	subsets: ["latin-ext"],
	weight: ["300", "400", "600", "700", "800"],
	display: "swap",
});

const STEPS = [
	{
		n: "1",
		title: "Escoge un producto",
		desc: "Explora nuestro catálogo y encuentra artículos ideales para tu marca. Tenemos opciones para eventos, negocios y proyectos personales.",
	},
	{
		n: "2",
		title: "Diseña tu creación",
		desc: "Personaliza colores, textos e imágenes con nuestro editor sencillo. Visualiza el resultado en tiempo real.",
	},
	{
		n: "3",
		title: "Haz tu pedido",
		desc: "Finaliza tu compra y nosotros nos encargamos de producirlo. Rápido, seguro y con calidad garantizada.",
	},
];

export default function TutorialLanding() {
	return (
		<section className={`${sora.className} bg-white py-20 px-6`}>
			<div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-16">
				{/* LEFT — STEPS */}
				<div className="flex flex-col gap-4 w-full md:w-1/2">
					<h2 className="text-3xl sm:text-4xl font-black text-[#1a1a17] leading-tight mb-4">
						Crea productos
						<br />
						en minutos
					</h2>

					{STEPS.map((step, i) => (
						<div
							key={step.n}
							className={`flex gap-5 py-6 ${i < STEPS.length - 1 ? "border-b border-[#e5e5e5]" : ""}`}
						>
							<span className="text-4xl font-black text-[#fe6241] leading-none pt-0.5 min-w-[2rem]">
								{step.n}
							</span>
							<div className="flex flex-col gap-1.5">
								<h3 className="text-xl font-bold text-[#1a1a17]">
									{step.title}
								</h3>
								<p className="text-sm text-[#666] font-light leading-relaxed">
									{step.desc}
								</p>
							</div>
						</div>
					))}

					<Link
						href="/catalogo"
						className="mt-4 w-fit px-8 py-3.5 bg-[#1a1a17] text-white text-sm font-bold rounded-sm hover:bg-[#333] transition-colors"
					>
						Empieza a diseñar
					</Link>
				</div>

				{/* RIGHT — IMAGE */}
				<div className="w-full md:w-1/2 flex justify-center">
					<div className="relative w-full max-w-[520px] aspect-[4/3] rounded-xl overflow-hidden shadow-md">
						<Image
							src="/tutorial2.png"
							alt="Editor de diseño"
							fill
							className="object-cover"
						/>
					</div>
				</div>
			</div>
		</section>
	);
}
