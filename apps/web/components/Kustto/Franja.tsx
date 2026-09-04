import { Entrada } from "@/components/Animaciones/Entrada";

/**
 * La promesa, en una franja.
 *
 * AQUÍ DECÍA "MÁS DE 50 PRODUCTOS, PUBLICADOS POR PROVEEDORES DE TODO MÉXICO",
 * y el catálogo publicado devolvía TRES, de dos talleres, los dos en Jalisco.
 * Estuvo así en producción. El segundo párrafo decía además que el mismo
 * producto lo publican varios talleres, y hoy no ocurre con ninguno.
 *
 * Lo que hay ahora es la parte del trato que sí es cierta y que además no
 * caduca con el catálogo: pedir desde una pieza. **No pongas aquí un número
 * hasta que sea verdad** — un taller que entre a registrarse lo comprueba en
 * un clic, y es lo primero que va a dejar de creerse.
 */
export default function Franja() {
	return (
		<section className="bg-tinta px-5 py-12 md:px-11 md:py-[72px]">
			<div className="mx-auto flex max-w-[1200px] flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-16">
				<Entrada desplazamiento={18} className="md:max-w-[680px]">
					<h2 className="font-display text-[28px] font-extrabold leading-[34px] tracking-[-0.021em] text-hueso md:text-[40px] md:leading-[48px]">
						Pide desde una pieza. Sin mínimos, sin anticipos.
					</h2>
				</Entrada>
				<Entrada delay={0.08} desplazamiento={18} className="md:max-w-[420px]">
					<p className="text-[15px] leading-[26px] text-hueso/65 md:text-[17px] md:leading-[29px]">
						Cada producto lo publica un taller mexicano con su precio, su
						técnica y su tiempo de entrega. Ves las tres cosas antes de decidir.
					</p>
				</Entrada>
			</div>
		</section>
	);
}
