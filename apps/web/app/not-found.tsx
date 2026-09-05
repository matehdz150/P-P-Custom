"use client";

import { ArrowRight, PackageX, SearchX } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import Footer from "@/components/Kustto/Footer";
import Header from "@/components/Kustto/Header";
import { getFichaDeProducto } from "@/lib/api/catalogo";

/**
 * La página que sale cuando una URL no existe.
 *
 * DICE ALGO DISTINTO SI LA URL ERA DE UN PRODUCTO, y ése es todo el motivo de
 * que exista: la de Next decía "This page could not be found" en inglés, y a
 * quien llega ahí desde SU diseño guardado eso no le explica nada.
 *
 * Y llegar ahí es normal, no excepcional. Pasa en dos casos que se ven igual
 * desde el navegador:
 *
 *   - **El taller quitó el producto.** Un diseño guardado, un favorito o una
 *     plantilla siguen apuntándolo: son cosas que duran años y el catálogo
 *     cambia. No es un fallo de nadie.
 *   - **El producto es más nuevo que el sitio.** Las páginas de producto se
 *     hornean al construir (`lib/build/parametros.ts`) y el catálogo se pide
 *     en vivo, así que entre una publicación y la siguiente hay productos que
 *     se ven y no se pueden abrir. Eso sí es un fallo nuestro.
 *
 * AHORA SÍ SE DISTINGUEN, PREGUNTÁNDOLE A LA API. Antes no se intentaba —el
 * comentario decía que la respuesta era la misma en los dos casos— y era falso:
 * si el producto SIGUE VIVO, la respuesta correcta no es "vuelve al catálogo",
 * es enseñárselo. Así que aquí se pide la ficha y, si contesta, se manda a la
 * ruta de red (`/product/?id=` o `/design/?id=`), que no tiene segmento
 * dinámico y por lo tanto existe siempre. El mensaje de abajo queda para lo que
 * de verdad ya no está.
 *
 * SE PIERDE LA URL BONITA mientras tanto, y se acepta: `/product/<id>` vuelve a
 * funcionar en el siguiente despliegue, y un producto de hace diez minutos no
 * lo ha indexado nadie. Entre una URL fea y una pantalla de error, la fea.
 *
 * LA RUTA SE LEE DE `window` tras montar, no con `useSearchParams` ni con
 * `usePathname` en el render: esta página se pre-renderiza en el build, donde
 * no hay URL, y el texto tiene que decidirse en el navegador.
 */

/** `/product/<id>` y `/design/<id>`, con su ruta de red y el id en el medio. */
const REDES = [
	{ prefijo: "/product/", destino: "/product/" },
	{ prefijo: "/producto/", destino: "/product/" },
	{ prefijo: "/design/", destino: "/design/" },
];

export default function NoEncontrada() {
	const [esDeProducto, setEsDeProducto] = useState(false);

	useEffect(() => {
		const ruta = window.location.pathname;
		const red = REDES.find((r) => ruta.startsWith(r.prefijo));
		if (!red) return;

		setEsDeProducto(true);

		/* El id es lo que queda entre el prefijo y la barra final: el sitio se
		   exporta con `trailingSlash`, así que la ruta llega como
		   `/product/<id>/` y quedarse con el segmento crudo metería una barra
		   dentro del id. */
		const id = ruta.slice(red.prefijo.length).replace(/\/+$/, "");
		if (!id) return;

		let vivo = true;

		getFichaDeProducto(id)
			.then(() => {
				// `replace` y no `push`: esta página no debería quedarse en el
				// historial, o el botón de atrás devuelve al error.
				if (vivo) {
					window.location.replace(
						`${red.destino}?id=${encodeURIComponent(id)}`,
					);
				}
			})
			/* Si la API dice que no existe —o no contesta— nos quedamos con el
			   mensaje de siempre. Es el caso del producto retirado, que es normal
			   y no un fallo. */
			.catch(() => {});

		return () => {
			vivo = false;
		};
	}, []);

	return (
		<div className="flex min-h-screen flex-col bg-hueso">
			<Header />

			<main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col items-center px-5 py-20 text-center">
				<span
					className="inline-flex size-14 items-center justify-center rounded-full bg-gris text-tinta/55"
					aria-hidden
				>
					{esDeProducto ? (
						<PackageX className="size-7" />
					) : (
						<SearchX className="size-7" />
					)}
				</span>

				<h1 className="pt-5 font-display text-[28px] font-semibold leading-[1.15] tracking-[-0.03em] text-tinta">
					{esDeProducto
						? "Este producto ya no está disponible"
						: "No encontramos esta página"}
				</h1>

				<p className="max-w-[42ch] pt-2.5 text-[15px] leading-[25px] text-tinta/65">
					{esDeProducto
						? "Puede que el taller lo haya quitado del catálogo. Si lo tenías guardado en tus diseños o en una plantilla, esa copia sigue ahí — lo que ya no se puede es pedirlo."
						: "La dirección no existe o cambió de sitio."}
				</p>

				<div className="flex flex-wrap justify-center gap-3 pt-8">
					<Link
						href="/catalogo"
						className="inline-flex h-12 items-center gap-2 rounded-full bg-tinta px-6 text-[15px] font-semibold text-lima"
					>
						Ver el catálogo
						<ArrowRight className="size-4" aria-hidden />
					</Link>

					{esDeProducto && (
						<Link
							href="/cuenta?s=disenos"
							className="inline-flex h-12 items-center rounded-full border-[1.5px] border-tinta px-6 text-[15px] font-semibold text-tinta transition-colors hover:bg-tinta hover:text-lima"
						>
							Mis diseños
						</Link>
					)}
				</div>
			</main>

			<Footer />
		</div>
	);
}
