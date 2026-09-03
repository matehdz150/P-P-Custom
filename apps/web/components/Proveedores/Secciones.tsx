import Link from "next/link";
import { Entrada } from "@/components/Animaciones/Entrada";
import {
	Chevron,
	IconoCatalogo,
	IconoPedido,
	IconoPerfil,
	IconoPrecio,
} from "./Iconos";

/** Etiqueta de sección: el punto-anillo del resto del sitio. */
function Eyebrow({ children }: { children: string }) {
	return (
		<span className="flex items-center gap-2.5 text-sm font-medium text-tinta md:text-base">
			<span className="inline-block h-2.5 w-2.5 rounded-full border-[1.6px] border-tinta" />
			{children}
		</span>
	);
}

function Titular({
	children,
	className,
}: {
	children: string;
	className?: string;
}) {
	return (
		<h2
			className={`font-display text-[30px] font-semibold leading-[37px] tracking-[-0.032em] text-tinta md:text-[40px] md:leading-[48px] ${className ?? ""}`}
		>
			{children}
		</h2>
	);
}

const VENTAJAS = [
	{
		titulo: "No buscas clientes",
		texto:
			"Los pedidos llegan del catálogo. El cliente ya eligió producto, cantidad y diseño antes de que tú lo veas.",
	},
	{
		titulo: "No inviertes en inventario",
		texto:
			"Publicas lo que ya sabes producir. Nada se fabrica hasta que hay un pedido pagado de por medio.",
	},
	{
		titulo: "No adivinas el archivo",
		texto:
			"Cada pedido llega con el diseño colocado dentro del área imprimible, el lado, el color y las tallas.",
	},
];

/** Lavanda: separa la sección de la principal, que va en hueso. */
export function PorQue() {
	return (
		<section className="bg-lavanda px-5 pb-15 pt-14 md:px-8 md:pb-26 md:pt-24">
			<div className="mx-auto flex max-w-[1200px] flex-col gap-[30px] md:gap-14">
				<Entrada className="flex flex-col gap-4 md:gap-5">
					<Eyebrow>Por qué te conviene</Eyebrow>
					<Titular className="md:max-w-[800px]">
						Lo que más te cuesta de un pedido personalizado, ya viene resuelto.
					</Titular>
				</Entrada>

				<div className="grid grid-cols-1 gap-[22px] md:grid-cols-3 md:gap-12">
					{VENTAJAS.map((v, i) => (
						<Entrada
							key={v.titulo}
							delay={i * 0.08}
							desplazamiento={18}
							className="flex flex-col gap-2.5 border-t-[1.5px] border-tinta pt-[18px] motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out motion-safe:hover:-translate-y-1 md:gap-3.5 md:pt-[26px]"
						>
							<h3 className="font-display text-[21px] font-semibold leading-[27px] tracking-[-0.032em] text-tinta md:text-2xl md:leading-[30px]">
								{v.titulo}
							</h3>
							<p className="text-[15px] leading-[26px] text-tinta md:text-[17px] md:leading-[29px]">
								{v.texto}
							</p>
						</Entrada>
					))}
				</div>
			</div>
		</section>
	);
}

const CAPACIDADES = [
	{
		icono: <IconoCatalogo />,
		titulo: "Publica tus productos",
		texto:
			"Das de alta prendas con sus colores, tallas y lados de impresión, sin pedirle nada a nadie.",
	},
	{
		icono: <IconoPrecio />,
		titulo: "Tú pones el precio",
		texto:
			"Defines precio por pieza, tus escalas por cantidad y el tiempo de producción que sí aguantas.",
	},
	{
		icono: <IconoPedido />,
		titulo: "Pedidos listos para máquina",
		texto:
			"Recibes el archivo final y la ficha completa del pedido. Sin cadenas de correos ni capturas de pantalla.",
	},
	{
		icono: <IconoPerfil />,
		titulo: "Tu perfil público",
		texto:
			"Tienes página propia dentro del catálogo, con tus productos y tu nombre como proveedor.",
	},
];

export function TuPanel() {
	return (
		<section className="bg-gris px-5 pb-14 pt-13 md:px-8 md:pb-26 md:pt-24">
			<div className="mx-auto flex max-w-[1200px] flex-col gap-[26px] md:gap-13">
				<Entrada className="flex flex-col gap-4 md:gap-5">
					<Eyebrow>Tu panel</Eyebrow>
					<Titular className="md:max-w-[760px]">
						Todo tu catálogo y tus pedidos, en un solo lugar.
					</Titular>
				</Entrada>

				<div className="grid grid-cols-1 gap-3 md:grid-cols-4 md:gap-5">
					{CAPACIDADES.map((c, i) => (
						<Entrada
							key={c.titulo}
							delay={i * 0.07}
							desplazamiento={18}
							className="flex flex-col gap-2 rounded-[10px] border border-tinta/12 bg-white p-5 motion-safe:transition-[transform,box-shadow] motion-safe:duration-300 motion-safe:ease-out motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-[0_12px_28px_rgba(43,40,18,0.08)] md:gap-3.5 md:p-[26px]"
						>
							<span className="hidden md:block">{c.icono}</span>
							<h3 className="text-base font-semibold text-tinta md:text-[17px]">
								{c.titulo}
							</h3>
							<p className="text-sm leading-[23px] text-tinta/70 md:text-[15px] md:leading-6">
								{c.texto}
							</p>
						</Entrada>
					))}
				</div>
			</div>
		</section>
	);
}

const PASOS = [
	{
		n: "01",
		titulo: "Regístrate como proveedor",
		texto:
			"Nos cuentas qué técnicas manejas, qué prendas produces y en qué tiempos trabajas.",
	},
	{
		n: "02",
		titulo: "Publica tu catálogo",
		texto:
			"Subes tus productos con fotos, colores, tallas y precios desde tu panel. Tú decides qué muestras.",
	},
	{
		n: "03",
		titulo: "Recibe pedidos",
		texto:
			"El cliente diseña sobre tus productos y aprueba su mockup. El pedido te llega pagado y con el archivo listo.",
	},
	{
		n: "04",
		titulo: "Produce y cobra",
		texto:
			"Produces, marcas el pedido como listo y se libera tu pago según las condiciones que acordamos: [TU ESQUEMA DE PAGO].",
	},
];

export function ComoEntras() {
	return (
		<section
			id="como-funciona"
			className="scroll-mt-6 bg-hueso px-5 pb-15 pt-14 md:px-8 md:pb-26 md:pt-24"
		>
			<div className="mx-auto flex max-w-[1200px] flex-col gap-[26px] md:gap-12">
				<Entrada className="flex flex-col gap-4 md:gap-5">
					<Eyebrow>Cómo entras</Eyebrow>
					<Titular className="md:max-w-[760px]">
						Cuatro pasos y empiezas a recibir pedidos.
					</Titular>
				</Entrada>

				<div className="flex flex-col">
					{PASOS.map((p, i) => (
						<Entrada
							key={p.n}
							delay={i * 0.07}
							desplazamiento={16}
							className={`flex flex-col gap-2 border-t border-tinta/16 py-5 md:flex-row md:items-start md:gap-12 md:py-[30px] ${
								i === PASOS.length - 1 ? "border-b border-tinta/16" : ""
							}`}
						>
							<span className="font-display text-[28px] font-semibold leading-none tracking-[-0.032em] text-lima-oscuro md:w-16 md:shrink-0 md:text-[40px]">
								{p.n}
							</span>
							<h3 className="font-display text-xl font-semibold leading-[26px] tracking-[-0.032em] text-tinta md:w-80 md:shrink-0 md:text-2xl md:leading-[30px]">
								{p.titulo}
							</h3>
							<p className="text-[15px] leading-[26px] text-tinta md:max-w-[620px] md:flex-1 md:text-[17px] md:leading-[29px]">
								{p.texto}
							</p>
						</Entrada>
					))}
				</div>
			</div>
		</section>
	);
}

export function CierreProveedor() {
	return (
		<section className="bg-lima px-5 py-14 md:px-8 md:py-19">
			<div className="mx-auto flex max-w-[1200px] flex-col items-center gap-5 md:gap-7">
				<Entrada desplazamiento={18} className="flex justify-center">
					<h2 className="text-center font-display text-[30px] font-semibold leading-[37px] tracking-[-0.032em] text-tinta md:max-w-[880px] md:text-[40px] md:leading-[48px]">
						Pon tu producción a trabajar
					</h2>
				</Entrada>
				<Entrada delay={0.07} desplazamiento={18} className="flex justify-center">
					<p className="text-center text-[15px] leading-[26px] text-tinta/75 md:max-w-[600px] md:text-lg md:leading-[30px]">
						Te damos de alta, publicas tu catálogo y empiezas a recibir pedidos
						con el archivo ya resuelto.
					</p>
				</Entrada>
				<Entrada delay={0.14} desplazamiento={18} className="flex w-full justify-center">
					<Link
						href="/proveedores/registro"
						className="flex h-14 w-full items-center justify-center gap-2.5 rounded-lg bg-tinta text-base font-semibold text-lima motion-safe:transition-[transform,box-shadow] motion-safe:duration-300 motion-safe:ease-out motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-lg md:h-[62px] md:w-auto md:px-9 md:text-lg"
					>
						Regístrate como proveedor
						<Chevron className="md:h-4 md:w-4" />
					</Link>
				</Entrada>
				<Entrada delay={0.2} desplazamiento={12}>
					<span className="text-center text-sm text-tinta/65 md:text-[15px]">
						¿Dudas antes de entrar? Escríbenos a [TU CORREO]
					</span>
				</Entrada>
			</div>
		</section>
	);
}
