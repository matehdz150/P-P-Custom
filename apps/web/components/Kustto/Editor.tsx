import Image from "next/image";

const CAPACIDADES = [
	{
		titulo: "Sube tu logo",
		texto:
			"PNG, JPG o SVG. Lo acomodas dentro del área editable y lo escalas hasta que quede.",
		icono: (
			<>
				<rect
					x="3.5"
					y="4.5"
					width="17"
					height="15"
					rx="2.5"
					stroke="currentColor"
					strokeWidth="1.5"
				/>
				<path
					d="M4 16l4.8-4.8 3.7 3.7 3.2-3.2L20 15.4"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
				<circle cx="9" cy="9" r="1.4" stroke="currentColor" strokeWidth="1.5" />
			</>
		),
	},
	{
		titulo: "Escribe tu texto",
		texto:
			"Tipografías, texto curvo y la paleta de colores que maneja cada proveedor, sin salir del navegador.",
		icono: (
			<path
				d="M5 7V5h14v2M12 5v14M9 19h6"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		),
	},
	{
		titulo: "Revisa cada lado",
		texto:
			"Frente, espalda y manga. Ves los tres antes de confirmar el pedido.",
		icono: (
			<path
				d="M12 3.2l8.3 4.6-8.3 4.6-8.3-4.6 8.3-4.6zM3.7 12.4l8.3 4.6 8.3-4.6M3.7 16.6l8.3 4.6 8.3-4.6"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		),
	},
	{
		titulo: "Elige color y tallas",
		texto:
			"Color de prenda y tallas pieza por pieza, todo dentro del mismo pedido.",
		icono: (
			<>
				<circle
					cx="9.2"
					cy="9.2"
					r="5"
					stroke="currentColor"
					strokeWidth="1.5"
				/>
				<circle
					cx="15.4"
					cy="15.4"
					r="5"
					stroke="currentColor"
					strokeWidth="1.5"
				/>
			</>
		),
	},
];

export default function Editor() {
	return (
		<section className="bg-tinta px-5 py-16 md:px-8 md:py-[110px]">
			<div className="mx-auto flex max-w-[1200px] flex-col gap-10 md:gap-15">
				<div className="flex flex-col gap-4 md:gap-5">
					<div className="flex items-center gap-2.5">
						<span className="inline-block h-2.5 w-2.5 rounded-full border-[1.6px] border-white/80" />
						<span className="text-sm font-medium text-white/80 md:text-base">
							El editor
						</span>
					</div>
					<h2 className="max-w-[760px] font-display text-3xl leading-9 tracking-[-0.033em] text-white md:text-[40px] md:leading-[48px]">
						Hecho para que no necesites un diseñador.
					</h2>
				</div>

				<div className="flex justify-center">
					<div className="w-full max-w-[1040px] overflow-hidden rounded-xl border border-white/60 bg-white shadow-[0_0_50px_rgba(0,0,0,0.25)]">
						<div className="flex h-11 items-center gap-3.5 border-b border-[#E4E4E0] bg-[#F3F3F1] px-4">
							<div className="flex items-center gap-[7px]">
								<span className="h-2.5 w-2.5 rounded-full bg-tinta/15" />
								<span className="h-2.5 w-2.5 rounded-full bg-tinta/15" />
								<span className="h-2.5 w-2.5 rounded-full bg-tinta/15" />
							</div>
							<span className="flex-1 text-center text-xs text-tinta/55">
								kustto.mx/design/playera-cuello-redondo
							</span>
							<div className="w-12" />
						</div>

						<div className="relative flex h-[240px] items-center justify-center bg-[#f5f7f2] md:h-[420px]">
							<Image
								src="/mockups/tshirtfront.png"
								alt="Mockup de playera en el editor"
								width={520}
								height={480}
								className="h-[80%] w-auto object-contain"
							/>
							<span className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-[9px] border border-[#E4E4E0] bg-white p-1.5">
								<span className="rounded-md bg-tinta px-3.5 py-1.5 text-xs font-semibold text-white">
									Frente
								</span>
								<span className="rounded-md px-3.5 py-1.5 text-xs font-medium text-tinta/55">
									Espalda
								</span>
								<span className="rounded-md px-3.5 py-1.5 text-xs font-medium text-tinta/55">
									Manga
								</span>
							</span>
						</div>
					</div>
				</div>

				<div className="grid grid-cols-1 gap-3.5 md:grid-cols-4 md:gap-5">
					{CAPACIDADES.map((c) => (
						<div
							key={c.titulo}
							className="flex flex-col gap-3 rounded-xl border border-white/15 bg-white/5 p-6 md:gap-4 md:p-7"
						>
							<svg
								width="26"
								height="26"
								viewBox="0 0 24 24"
								fill="none"
								aria-hidden="true"
								className="text-white"
							>
								{c.icono}
							</svg>
							<h3 className="text-xl font-semibold leading-[25px] tracking-[-0.025em] text-white md:text-2xl md:leading-[29px]">
								{c.titulo}
							</h3>
							<p className="text-[15px] leading-[25px] text-white/70">
								{c.texto}
							</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
