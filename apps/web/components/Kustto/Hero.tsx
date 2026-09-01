import Image from "next/image";
import Link from "next/link";

const GARANTIAS = [
	{ corto: "Diseñar es gratis", largo: "Diseñar y cotizar es gratis" },
	{
		corto: "Mockup antes de pagar",
		largo: "Apruebas el mockup antes de pagar",
	},
	{ corto: "Envío a todo México", largo: "Envío a todo México" },
];

function Palomita() {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden="true"
			className="shrink-0 text-lima-oscuro md:h-[15px] md:w-[15px]"
		>
			<path
				d="M4.5 12.6l4.8 4.8L19.5 7.2"
				stroke="currentColor"
				strokeWidth="3"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

/** Etiqueta que va encima de cada pieza del abanico. */
function Etiqueta({ children }: { children: string }) {
	return (
		<span className="absolute bottom-3 left-3 inline-flex rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-tinta md:bottom-5 md:left-5 md:px-[13px] md:py-1.5 md:text-[13px]">
			{children}
		</span>
	);
}

export default function Hero() {
	return (
		<section className="bg-white px-5 pt-9 md:px-11 md:pt-16">
			<div className="flex flex-col items-center">
				<span className="inline-flex items-center rounded-full bg-lima px-[15px] py-[7px] text-[13px] font-semibold text-tinta md:px-[18px] md:py-2 md:text-sm">
					<span className="md:hidden">Marketplace de personalizados</span>
					<span className="hidden md:inline">
						El marketplace de personalizados de México
					</span>
				</span>

				<h1 className="mt-5 max-w-[300px] text-center font-display text-[44px] font-semibold leading-[49px] tracking-[-0.021em] text-tinta md:mt-[26px] md:max-w-[900px] md:text-[82px] md:leading-[90px]">
					Diseña lo tuyo, pídelo desde una pieza
				</h1>

				<Link
					href="/catalogo"
					className="mt-7 flex h-14 w-full items-center justify-center gap-2.5 rounded-full bg-[#2B2812] text-[17px] font-semibold text-lima md:mt-[38px] md:h-[62px] md:w-auto md:px-10 md:text-lg"
				>
					Empieza a diseñar
					<svg
						width="15"
						height="15"
						viewBox="0 0 14 14"
						fill="none"
						aria-hidden="true"
						className="md:h-4 md:w-4"
					>
						<path
							d="M5.833 10.5L9.333 7L5.833 3.5"
							stroke="currentColor"
							strokeWidth="1.8"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				</Link>

				<div className="mt-[18px] flex flex-wrap justify-center gap-x-[18px] gap-y-2 md:gap-x-[26px]">
					{GARANTIAS.map((g) => (
						<span
							key={g.largo}
							className="flex items-center gap-[7px] text-[13px] font-medium text-tinta/65 md:gap-2 md:text-sm"
						>
							<Palomita />
							<span className="md:hidden">{g.corto}</span>
							<span className="hidden md:inline">{g.largo}</span>
						</span>
					))}
				</div>
			</div>

			{/* Abanico de piezas: en móvil son tres, en escritorio se abren las cinco. */}
			<div className="flex h-[186px] items-end justify-center overflow-hidden pt-[30px] pb-[46px] md:h-[330px] md:mt-14 md:mb-24 md:gap-2.5 md:overflow-visible md:pt-0 md:pb-0">
				<div className="relative h-[186px] w-[130px] shrink-0 overflow-hidden rounded-[30px] bg-gris [transform:rotate(-12deg)_translateY(30px)] md:h-[330px] md:w-[236px] md:rounded-[46px] md:[transform:rotate(-18deg)_translateY(58px)]">
					<Image
						src="/products/tshirt.png"
						alt="Playera personalizada"
						width={296}
						height={368}
						className="absolute -bottom-5 left-1/2 h-auto w-[164px] max-w-none -translate-x-1/2 md:-bottom-[34px] md:w-[296px]"
					/>
					<span className="absolute left-1/2 top-[82px] inline-flex -translate-x-1/2 items-center rounded-[5px] bg-tinta px-[7px] py-[3px] text-[9px] font-bold tracking-[0.5px] text-lima md:top-[148px] md:rounded-md md:px-[11px] md:py-[5px] md:text-[11px] md:tracking-[0.6px]">
						GEN 2026
					</span>
					<Etiqueta>Playeras</Etiqueta>
				</div>

				<div className="relative -ml-[18px] h-[186px] w-[130px] shrink-0 overflow-hidden rounded-[30px] md:ml-0 md:h-[330px] md:w-[236px] md:rounded-[46px] md:[transform:rotate(-9deg)_translateY(16px)]">
					<Image
						src="/event2.png"
						alt="Totes personalizados para una boda"
						width={236}
						height={330}
						className="h-full w-full object-cover"
					/>
					<Etiqueta>Bodas</Etiqueta>
				</div>

				<div className="relative -ml-[18px] h-[186px] w-[130px] shrink-0 overflow-hidden rounded-[30px] bg-lima [transform:rotate(12deg)_translateY(30px)] md:ml-0 md:h-[330px] md:w-[236px] md:rounded-[46px] md:[transform:none]">
					<Image
						src="/products/cap.png"
						alt="Gorra personalizada"
						width={238}
						height={296}
						className="absolute left-1/2 top-[30px] h-auto w-[132px] max-w-none -translate-x-1/2 md:top-[52px] md:w-[238px]"
					/>
					<Etiqueta>Gorras</Etiqueta>
				</div>

				<div className="relative hidden h-[330px] w-[236px] shrink-0 overflow-hidden rounded-[46px] md:block md:[transform:rotate(9deg)_translateY(16px)]">
					<Image
						src="/event.png"
						alt="Graduación"
						width={236}
						height={330}
						className="h-full w-full object-cover"
					/>
					<Etiqueta>Graduaciones</Etiqueta>
				</div>

				<div className="relative hidden h-[330px] w-[236px] shrink-0 overflow-hidden rounded-[46px] bg-lavanda md:block md:[transform:rotate(18deg)_translateY(58px)]">
					<Image
						src="/products/totebag.png"
						alt="Tote bag personalizado"
						width={212}
						height={284}
						className="absolute left-1/2 top-[34px] h-auto w-[212px] max-w-none -translate-x-1/2"
					/>
					<Etiqueta>Totes</Etiqueta>
				</div>
			</div>
		</section>
	);
}
