import { Entrada } from "@/components/Animaciones/Entrada";

export default function Franja() {
	return (
		<section className="bg-tinta px-5 py-12 md:px-11 md:py-[72px]">
			<div className="mx-auto flex max-w-[1200px] flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-16">
				<Entrada desplazamiento={18} className="md:max-w-[680px]">
					<h2 className="font-display text-[28px] font-extrabold leading-[34px] tracking-[-0.021em] text-hueso md:text-[40px] md:leading-[48px]">
						<span className="md:hidden">
							Más de 50 productos, de proveedores de todo México
						</span>
						<span className="hidden md:inline">
							Más de 50 productos, publicados por proveedores de todo México
						</span>
					</h2>
				</Entrada>
				<Entrada delay={0.08} desplazamiento={18} className="md:max-w-[420px]">
					<p className="text-[15px] leading-[26px] text-hueso/65 md:text-[17px] md:leading-[29px]">
						El mismo producto lo publican varios talleres, cada uno con su precio,
						su técnica y su tiempo de entrega. Tú decides con quién lo mandas a
						hacer.
					</p>
				</Entrada>
			</div>
		</section>
	);
}
