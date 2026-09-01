import Link from "next/link";

export default function Cierre() {
	return (
		<section className="bg-lima px-5 py-16 md:px-11 md:py-[110px]">
			<div className="flex flex-col items-center gap-5 md:gap-[30px]">
				<h2 className="text-center font-display text-[34px] font-extrabold leading-[41px] tracking-[-0.021em] text-tinta md:max-w-[880px] md:text-[56px] md:leading-[64px]">
					Trae tu idea. Nosotros la volvemos 30 playeras
				</h2>
				<p className="text-center text-base leading-[27px] text-tinta/70 md:max-w-[600px] md:text-lg md:leading-[30px]">
					Abre el editor, sube tu logo y mira tu producto terminado antes de
					gastar un peso.
				</p>
				<Link
					href="/catalogo"
					className="flex h-14 w-full items-center justify-center gap-2.5 rounded-full bg-tinta text-[17px] font-semibold text-hueso md:h-[62px] md:w-auto md:px-10 md:text-lg"
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
			</div>
		</section>
	);
}
