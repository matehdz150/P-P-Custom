import Link from "next/link";
import Eyebrow from "./Eyebrow";

const VENTAJAS = [
	{
		titulo: "Pedidos ya pagados",
		texto: "Nada de anticipos por WhatsApp.",
	},
	{
		titulo: "Archivo listo para imprimir",
		texto: "En la posición y el tamaño que tú definiste.",
	},
	{
		titulo: "Tus precios, tus tiempos",
		texto: "Tú pones el escalonado por cantidad.",
	},
	{
		titulo: "Seguimiento en un panel",
		texto: "Cambias la etapa y el cliente se entera solo.",
	},
];

/** En móvil cierra la sección; en escritorio vive dentro de la columna de texto. */
function BotonPublica({ className }: { className: string }) {
	return (
		<Link
			href="/proveedores"
			className={`h-14 items-center justify-center gap-2.5 rounded-full bg-tinta px-[30px] text-base font-semibold text-hueso md:text-[17px] ${className}`}
		>
			Publica tus productos
			<svg
				width="15"
				height="15"
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
	);
}

export default function Proveedores() {
	return (
		<section className="bg-lavanda px-5 py-14 md:px-11 md:py-24">
			<div className="mx-auto flex max-w-[1200px] flex-col gap-5 md:flex-row md:items-center md:justify-between md:gap-20">
				<div className="flex flex-col gap-5 md:max-w-[560px] md:gap-[22px]">
					<Eyebrow>Para proveedores</Eyebrow>
					<h2 className="font-display text-[30px] font-extrabold leading-[37px] tracking-[-0.021em] text-tinta md:text-[40px] md:leading-[48px]">
						¿Tienes la máquina? Nosotros te traemos los pedidos
					</h2>
					<p className="text-[15px] leading-[26px] text-tinta/70 md:text-[17px] md:leading-[29px]">
						Publica tus productos, define tus precios por cantidad y tus
						tiempos. Los pedidos te llegan ya pagados y con el archivo de
						impresión listo.
					</p>
					<BotonPublica className="hidden w-fit md:flex" />
				</div>

				<div className="grid grid-cols-1 gap-2.5 md:w-[520px] md:shrink-0 md:grid-cols-2 md:gap-4">
					{VENTAJAS.map((v) => (
						<div
							key={v.titulo}
							className="flex flex-col gap-1.5 rounded-[14px] bg-hueso p-[18px] md:gap-2 md:rounded-2xl md:p-6"
						>
							<span className="text-base font-semibold text-tinta md:text-[17px]">
								{v.titulo}
							</span>
							<span className="text-sm leading-[23px] text-tinta/60 md:text-[15px] md:leading-6">
								{v.texto}
							</span>
						</div>
					))}
				</div>

				<BotonPublica className="flex md:hidden" />
			</div>
		</section>
	);
}
