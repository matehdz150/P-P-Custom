import Image from "next/image";
import Link from "next/link";

const PRODUCTOS = [
	{
		nombre: "Playera",
		img: "/products/tshirt.png",
		href: "/catalogo?q=playera",
		/** La playera se ancla abajo: es una foto de cuerpo, no un producto suelto. */
		anclaAbajo: true,
		ancho: "w-[158px] md:w-[250px]",
	},
	{
		nombre: "Gorra",
		img: "/products/cap.png",
		href: "/catalogo?q=gorra",
		anclaAbajo: false,
		ancho: "w-[146px] md:w-[230px]",
	},
	{
		nombre: "Tote bag",
		img: "/products/totebag.png",
		href: "/catalogo?q=tote",
		anclaAbajo: false,
		ancho: "w-[130px] md:w-[205px]",
	},
	{
		nombre: "Termo",
		img: "/products/thermo2.png",
		href: "/catalogo?q=termo",
		anclaAbajo: false,
		ancho: "w-[158px] md:w-[250px]",
	},
];

export default function Catalogo() {
	return (
		<section className="bg-gris px-5 py-14 md:px-11 md:py-24">
			<div className="mx-auto flex max-w-[1200px] flex-col gap-[26px] md:gap-11">
				<div className="flex items-end justify-between gap-16">
					<h2 className="font-display text-[30px] font-extrabold leading-[37px] tracking-[-0.021em] text-tinta md:max-w-[700px] md:text-[40px] md:leading-[48px]">
						Empieza por lo que más se pide
					</h2>
					<Link
						href="/catalogo"
						className="hidden shrink-0 items-center gap-2 pb-1.5 text-base font-semibold text-tinta hover:text-lima-oscuro md:flex"
					>
						Ver catálogo completo
						<svg
							width="14"
							height="14"
							viewBox="0 0 14 14"
							fill="none"
							aria-hidden="true"
						>
							<path
								d="M5.833 10.5L9.333 7L5.833 3.5"
								stroke="currentColor"
								strokeWidth="1.7"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					</Link>
				</div>

				<div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
					{PRODUCTOS.map((p) => (
						<Link key={p.nombre} href={p.href} className="flex flex-col gap-3">
							<div
								className={`flex h-[190px] justify-center overflow-hidden rounded-[24px] bg-white md:h-[300px] md:rounded-[28px] ${
									p.anclaAbajo ? "items-end" : "items-center"
								}`}
							>
								<Image
									src={p.img}
									alt={`${p.nombre} personalizable`}
									width={280}
									height={340}
									className={`h-auto max-w-none object-contain ${p.ancho}`}
								/>
							</div>
							<div className="flex items-baseline justify-between gap-2">
								<span className="text-[15px] font-semibold text-tinta md:text-base">
									{p.nombre}
								</span>
								<span className="text-[13px] text-tinta/60 md:text-sm">
									<span className="md:hidden">[TU PRECIO]</span>
									<span className="hidden md:inline">desde [TU PRECIO]</span>
								</span>
							</div>
						</Link>
					))}
				</div>

				<Link
					href="/catalogo"
					className="flex h-[52px] items-center justify-center gap-2 rounded-full border-[1.5px] border-tinta text-base font-semibold text-tinta md:hidden"
				>
					Ver catálogo completo
					<svg
						width="14"
						height="14"
						viewBox="0 0 14 14"
						fill="none"
						aria-hidden="true"
					>
						<path
							d="M5.833 10.5L9.333 7L5.833 3.5"
							stroke="currentColor"
							strokeWidth="1.7"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				</Link>
			</div>
		</section>
	);
}
