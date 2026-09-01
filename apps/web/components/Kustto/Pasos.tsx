import Eyebrow from "./Eyebrow";

const PASOS = [
	{
		n: "01",
		titulo: "Elige tu producto",
		texto:
			"Busca por evento, por empresa o por producto suelto. Escoge color y tallas antes de abrir el editor.",
	},
	{
		n: "02",
		titulo: "Diseña en el navegador",
		texto:
			"Sube tu logo o escribe tu texto, acomódalo dentro del área editable y revisa cada lado. Sin instalar nada.",
	},
	{
		n: "03",
		titulo: "Aprueba el mockup",
		texto:
			"Ves el precio final con tu cantidad y tu técnica, más el tiempo de producción, antes de confirmar.",
	},
	{
		n: "04",
		titulo: "Lo producen y te llega",
		texto:
			"Sigues el pedido desde la app, etapa por etapa, hasta que sale con número de rastreo.",
	},
];

export default function Pasos() {
	return (
		<section
			id="como-funciona"
			className="bg-white px-5 py-16 md:px-11 md:py-[100px]"
		>
			<div className="mx-auto flex max-w-[1200px] flex-col gap-8 md:gap-14">
				<div className="flex flex-col gap-3.5 md:items-center md:gap-[18px]">
					<Eyebrow>Cómo funciona</Eyebrow>
					<h2 className="font-display text-[30px] font-extrabold leading-[37px] tracking-[-0.021em] text-tinta md:max-w-[820px] md:text-center md:text-[44px] md:leading-[52px]">
						Cuatro pasos entre tu idea y la caja en tu puerta
					</h2>
				</div>

				<div className="grid grid-cols-1 gap-[22px] md:grid-cols-4 md:gap-8">
					{PASOS.map((p) => (
						<div
							key={p.n}
							className="flex flex-col gap-2.5 border-t border-tinta/15 pt-5 md:gap-3.5 md:pt-[26px]"
						>
							<span className="font-display text-[34px] font-extrabold leading-none tracking-[-0.021em] text-lima-oscuro md:text-[44px]">
								{p.n}
							</span>
							<h3 className="text-xl font-semibold leading-[25px] tracking-[-0.025em] text-tinta md:text-[22px] md:leading-7">
								{p.titulo}
							</h3>
							<p className="text-[15px] leading-[25px] text-tinta/60 md:text-base md:leading-[26px]">
								{p.texto}
							</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
