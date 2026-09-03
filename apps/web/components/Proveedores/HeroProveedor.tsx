import Link from "next/link";
import { Entrada } from "@/components/Animaciones/Entrada";
import { ArosProveedor } from "./Animaciones";
import { Chevron } from "./Iconos";
import PanelMockup from "./PanelMockup";

/** Etiqueta de sección: el punto-anillo del resto del sitio. */
function Eyebrow({ children }: { children: string }) {
	return (
		<span className="flex items-center gap-2.5 text-sm font-medium text-tinta md:text-base">
			<span className="inline-block h-2.5 w-2.5 rounded-full border-[1.6px] border-tinta" />
			{children}
		</span>
	);
}

function Encabezado() {
	return (
		<div className="relative mx-auto flex max-w-[1376px] items-center justify-between gap-4 px-5 py-3.5 md:gap-8 md:px-8 md:py-[18px]">
			<Link
				href="/"
				className="font-brand text-[26px] font-semibold leading-none tracking-[-0.05em] text-tinta md:text-[30px]"
			>
				kustto
			</Link>

			<div className="flex items-center gap-2 md:gap-6">
				<Link
					href="#como-funciona"
					className="hidden text-base font-medium text-tinta lg:inline"
				>
					Cómo funciona
				</Link>
				<Link
					href="/proveedor"
					className="hidden text-base font-medium text-tinta lg:inline"
				>
					Tu panel
				</Link>
				<Link
					href="/catalogo"
					className="hidden text-base font-medium text-tinta lg:inline"
				>
					Soy comprador
				</Link>
				<Link
					href="/proveedor/login"
					className="hidden h-[46px] items-center rounded-lg border-[1.5px] border-tinta/18 px-5 text-base font-medium text-tinta md:flex"
				>
					Entrar al panel
				</Link>
				<Link
					href="/proveedores/registro"
					className="flex h-11 items-center gap-2 rounded-lg bg-lima px-4 text-[15px] font-semibold text-tinta md:h-[46px] md:px-[22px] md:text-base"
				>
					<span className="md:hidden">Regístrate</span>
					<span className="hidden md:inline">Regístrate como proveedor</span>
					<Chevron className="hidden h-3.5 w-3.5 md:block" />
				</Link>
			</div>
		</div>
	);
}

export default function HeroProveedor() {
	return (
		<section className="relative overflow-hidden bg-hueso">
			{/* Aros concéntricos: dan profundidad sin recurrir a un degradado. */}
			<ArosProveedor />

			<Encabezado />

			<div className="relative mx-auto flex max-w-[1376px] flex-col gap-[22px] px-5 pt-10 md:gap-[34px] md:px-8 md:pt-[76px]">
				<Entrada alCargar desplazamiento={14} delay={0.05}>
					<Eyebrow>Para talleres de serigrafía, bordado y sublimación</Eyebrow>
				</Entrada>

				<Entrada alCargar desplazamiento={18} delay={0.12}>
					<h1 className="font-display text-[34px] font-semibold leading-[41px] tracking-[-0.032em] text-tinta md:max-w-[1120px] md:text-[58px] md:leading-[70px]">
						Recibe pedidos ya diseñados y pagados, listos para máquina.
					</h1>
				</Entrada>

				<Entrada
					alCargar
					desplazamiento={20}
					delay={0.2}
					className="flex flex-col gap-[22px] md:flex-row md:items-end md:justify-between md:gap-16 md:pb-2"
				>
					<p className="text-base leading-[27px] text-tinta/75 md:max-w-[620px] md:text-[19px] md:leading-8">
						Tú pones la producción; nosotros ponemos al cliente y el archivo.
						Publicas lo que ya sabes producir y cada pedido te llega con el
						diseño colocado, el lado, el color y las tallas.
					</p>
					<Link
						href="/proveedores/registro"
						className="flex h-14 shrink-0 items-center justify-center gap-2.5 rounded-lg bg-tinta text-[17px] font-semibold text-lima motion-safe:transition-[transform,box-shadow] motion-safe:duration-300 motion-safe:ease-out motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-lg md:h-[62px] md:px-8 md:text-lg"
					>
						Regístrate como proveedor
						<Chevron className="md:h-4 md:w-4" />
					</Link>
				</Entrada>
			</div>

			<div className="relative flex justify-center px-5 pt-10 md:px-8 md:pt-[68px]">
				<Entrada
					desplazamiento={30}
					escala={0.985}
					className="w-full md:w-[1040px]"
				>
					<PanelMockup />
				</Entrada>
			</div>

			<div className="h-14 md:h-24" />
		</section>
	);
}
