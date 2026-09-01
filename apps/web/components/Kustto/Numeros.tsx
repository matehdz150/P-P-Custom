const NUMEROS = [
	{
		antes: "Más de",
		cifra: "50",
		texto: "productos publicados por proveedores de todo México.",
	},
	{
		antes: "Entre",
		cifra: "7 y 14 días",
		texto: "de producción y entrega, desde que apruebas el mockup.",
	},
	{
		antes: "El",
		cifra: "100%",
		texto: "de los pedidos con mockup aprobado antes de entrar a producción.",
	},
];

export default function Numeros() {
	return (
		<section className="bg-white px-5 py-16 md:px-8 md:py-[100px]">
			<div className="mx-auto flex max-w-[1200px] flex-col gap-9 md:gap-15">
				<div className="flex flex-col gap-4 md:gap-5">
					<div className="flex items-center gap-2.5">
						<span className="inline-block h-2.5 w-2.5 rounded-full border-[1.6px] border-tinta" />
						<span className="text-sm font-medium text-tinta md:text-base">
							Nuestros números
						</span>
					</div>
					<h2 className="max-w-[820px] font-display text-3xl leading-9 tracking-[-0.033em] text-tinta md:text-[40px] md:leading-[48px]">
						Catálogo, técnica y tiempos que puedes prometerle a tu cliente.
					</h2>
				</div>

				<div className="grid grid-cols-1 gap-7 md:grid-cols-3 md:gap-12">
					{NUMEROS.map((n) => (
						<div
							key={n.cifra}
							className="flex flex-col gap-2 border-t border-tinta/15 pt-5 md:pt-7"
						>
							<span className="text-[15px] text-tinta/55 md:text-base">
								{n.antes}
							</span>
							<span className="font-display text-[44px] leading-[1.05] tracking-[-0.037em] text-tinta md:text-[64px]">
								{n.cifra}
							</span>
							<p className="text-[15px] leading-[25px] text-tinta/60 md:text-base md:leading-[26px]">
								{n.texto}
							</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
