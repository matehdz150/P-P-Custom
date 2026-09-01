const BENEFICIOS = [
	{
		titulo: "Eliges proveedor",
		texto:
			"Un mismo producto lo publican varios proveedores. Comparas precio, técnica y tiempo antes de pedir.",
	},
	{
		titulo: "Desde una pieza",
		texto:
			"Tres para tu equipo o trescientas para tu evento: el precio se ajusta solo a tu cantidad.",
	},
	{
		titulo: "No pagas a ciegas",
		texto:
			"La cotización se actualiza mientras diseñas, con tu producto y tu cantidad. Lo que ves es lo que pagas.",
	},
	{
		titulo: "Apruebas antes de producir",
		texto:
			"Ves el mockup final de tu producto antes de que entre a producción. Si no te late, lo cambias.",
	},
];

export default function Beneficios() {
	return (
		<section className="bg-white px-5 py-16 md:px-8 md:py-[110px]">
			<div className="mx-auto flex max-w-[1200px] flex-col gap-10 md:gap-16">
				<div className="flex flex-col gap-4 md:gap-5">
					<div className="flex items-center gap-2.5">
						<span className="inline-block h-2.5 w-2.5 rounded-full border-[1.6px] border-tinta" />
						<span className="text-sm font-medium text-tinta md:text-base">
							Por qué aquí
						</span>
					</div>
					<h2 className="max-w-[780px] font-display text-3xl leading-9 tracking-[-0.033em] text-tinta md:text-[40px] md:leading-[48px]">
						Lo que normalmente te frena al pedir personalizados.
					</h2>
				</div>

				<div className="grid grid-cols-1 gap-8 md:grid-cols-4 md:gap-9">
					{BENEFICIOS.map((b) => (
						<div
							key={b.titulo}
							className="flex flex-col gap-3 border-t border-tinta/15 pt-5 md:gap-3.5 md:pt-[26px]"
						>
							<h3 className="text-xl font-semibold leading-[25px] tracking-[-0.025em] text-tinta md:text-2xl md:leading-[29px]">
								{b.titulo}
							</h3>
							<p className="text-[15px] leading-[25px] text-tinta/60 md:text-base md:leading-[26px]">
								{b.texto}
							</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
