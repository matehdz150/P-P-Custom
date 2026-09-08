import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Entrada } from "@/components/Animaciones/Entrada";

/**
 * El editor, enseñado en vez de contado.
 *
 * QUÉ HACE AQUÍ. La landing dice tres veces que se puede diseñar en el
 * navegador y no lo enseña ni una. Esto es la prueba, y son capturas del
 * editor de verdad —no una maqueta dibujada—: al fondo la pantalla de
 * trabajo y encima, en pequeño, el mismo diseño ya en 3D.
 *
 * LA VENTANA SE CORTA POR LA DERECHA a propósito. Encajada entera parecería
 * una captura pegada en una tarjeta; cortada por el borde se lee como una
 * ventana a algo que sigue, que es lo que es. Por eso no hay borde ni radio
 * en ese lado.
 *
 * LA CAPTURA NO SE ESCALA PARA CABER, SE RECORRE. Metida entera en el hueco
 * quedaría a un tercio de su tamaño y la interfaz sería un borrón. Va a su
 * altura completa (`h-full w-auto`) y en móvil se desplaza con `-ml` hasta
 * dejar a la vista el lienzo con el producto, que es lo único que importa
 * ahí; en escritorio cabe casi entera y lo que se pierde es el panel de
 * opciones de la derecha.
 *
 * EL FONDO ES TINTA y no el hueso del resto: un producto blanco sobre oscuro
 * se lee como escaparate, y separa esta sección de `Casos`, que viene justo
 * debajo en claro.
 */

export default function Motor() {
	return (
		<section className="overflow-hidden bg-tinta px-5 py-14 text-hueso md:px-11 md:py-24">
			<div className="mx-auto flex max-w-[1400px] flex-col gap-10 md:flex-row md:items-center md:gap-4">
				{/* ---- La promesa ---- */}
				<Entrada desplazamiento={18} className="md:w-[420px] md:shrink-0">
					<h2 className="font-display text-[30px] font-extrabold leading-[37px] tracking-[-0.021em] md:text-[40px] md:leading-[48px]">
						Míralo terminado antes de pagar
					</h2>
					<p className="mt-4 max-w-[46ch] text-[15px] leading-[26px] text-hueso/70 md:mt-5 md:text-base md:leading-[28px]">
						Sube tu logo, acomódalo dentro del área que el taller puede imprimir
						y gíralo en 3D sobre el producto real. Sin instalar nada y sin
						cuenta.
					</p>

					<Link
						href="/catalogo"
						className="mt-7 inline-flex items-center gap-2 rounded-full bg-lima px-6 py-3.5 text-sm font-semibold text-tinta transition-colors hover:bg-hueso md:mt-8"
					>
						Abrir el editor
						<ArrowRight className="size-4" aria-hidden="true" />
					</Link>

					<p className="mt-5 text-[13px] leading-[22px] text-hueso/45 md:text-sm">
						Lo que ves es lo que el taller produce.
					</p>
				</Entrada>

				{/* ---- La ventana del editor ----
				    `-mr-5 md:-mr-11` la saca por el borde de la página anulando el
				    padding de la sección, que es lo que produce el corte. */}
				<Entrada
					desplazamiento={26}
					delay={0.1}
					className="-mr-5 min-w-0 flex-1 md:-mr-11"
				>
					<div className="relative h-[440px] overflow-hidden rounded-l-[18px] border border-r-0 border-hueso/15 bg-white md:h-[600px]">
						<Image
							src="/motor/editor.jpg"
							alt="El editor de Kustto con el panel de fuentes abierto y un logo colocado sobre la envoltura de una taza"
							width={1900}
							height={1042}
							sizes="(max-width: 768px) 802px, 1094px"
							className="-ml-[236px] h-full w-auto max-w-none md:ml-0"
						/>

						{/* El resultado, encima de la propia pantalla de trabajo: es el
						    remate de la frase —diseñas aquí, lo ves ahí—. */}
						<div className="absolute bottom-4 left-4 w-[124px] overflow-hidden rounded-[14px] border border-tinta/10 bg-white shadow-[0_12px_34px_rgba(43,40,18,0.22)] md:bottom-6 md:left-6 md:w-[208px]">
							<Image
								src="/motor/probar.jpg"
								alt="La misma taza vista en 3D dentro del editor"
								width={700}
								height={622}
								sizes="208px"
								className="w-full"
							/>
							<p className="px-3 py-2 text-[11px] font-semibold text-tinta md:text-xs">
								Probar en 3D
							</p>
						</div>
					</div>
				</Entrada>
			</div>
		</section>
	);
}
