import Image from "next/image";
import Eyebrow from "./Eyebrow";

const CASOS = [
	{
		img: "/event2.png",
		alt: "Totes personalizados para una boda",
		titulo: "Bodas y eventos",
		texto:
			"Totes y playeras para los invitados, con el diseño de los novios y la fecha en cada pieza.",
	},
	{
		img: "/event.png",
		alt: "Birrete de graduación",
		titulo: "Graduaciones",
		texto:
			"Generación, escuela y el nombre de cada quien. Pedido de grupo, sin mínimos rígidos.",
	},
	{
		img: "/business.png",
		alt: "Equipo de trabajo",
		titulo: "Empresas y marcas",
		texto:
			"Kits de bienvenida y merch con tu logo, listos para volver a pedir cuando entre gente nueva.",
	},
];

export default function Casos() {
	return (
		<section className="bg-white px-5 py-16 md:px-11 md:py-[100px]">
			<div className="mx-auto flex max-w-[1200px] flex-col gap-7 md:gap-11">
				<div className="flex flex-col gap-3.5 md:gap-[18px]">
					<Eyebrow>Para qué lo usan</Eyebrow>
					<h2 className="font-display text-[30px] font-extrabold leading-[37px] tracking-[-0.021em] text-tinta md:max-w-[780px] md:text-[40px] md:leading-[48px]">
						Bodas, graduaciones y equipos de trabajo
					</h2>
				</div>

				<div className="grid grid-cols-1 gap-[26px] md:grid-cols-3 md:gap-6">
					{CASOS.map((c) => (
						<div key={c.titulo} className="flex flex-col gap-3 md:gap-4">
							<Image
								src={c.img}
								alt={c.alt}
								width={420}
								height={320}
								className="h-[240px] w-full rounded-[24px] object-cover md:h-[320px] md:rounded-[28px]"
							/>
							<h3 className="text-xl font-semibold leading-[25px] tracking-[-0.025em] text-tinta md:text-[22px] md:leading-7">
								{c.titulo}
							</h3>
							<p className="text-[15px] leading-[25px] text-tinta/65 md:text-base md:leading-[26px]">
								{c.texto}
							</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
