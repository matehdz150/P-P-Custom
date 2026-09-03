"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SearchProvider } from "@/Contexts/SearchContext";
import BuscadorCatalogo from "@/components/Catalogo/BuscadorCatalogo";
import Footer from "@/components/Kustto/Footer";
import Header from "@/components/Kustto/Header";

export default function Layout({ children }: { children: React.ReactNode }) {
	return (
		<SearchProvider>
			<div className="font-brand min-h-screen bg-hueso text-tinta">
				<Header />
				<CatalogLayoutContent>{children}</CatalogLayoutContent>
				<Footer />
			</div>
		</SearchProvider>
	);
}

function CatalogLayoutContent({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();

	// La portada y el listado traen su propio encabezado, con título y
	// buscador incluidos. Las demás subrutas reciben aquí el mismo buscador.
	/* SE COMPARA SIN LA BARRA FINAL, y no es cosmético: `trailingSlash` se
	   enciende **sólo al exportar** (ver `next.config.ts`), así que en el sitio
	   publicado `usePathname()` devuelve `/catalogo/` y la comparación fallaba.
	   El layout creía que estaba en una subruta y le montaba su migaja y su
	   buscador ENCIMA del hero, que ya trae el suyo: dos buscadores en la misma
	   pantalla. En desarrollo no salía, porque ahí no hay barra final. */
	const ruta = pathname.replace(/\/+$/, "") || "/";

	const traeSuChrome = ruta === "/catalogo" || ruta === "/catalogo/productos";

	if (traeSuChrome) {
		return <main>{children}</main>;
	}

	const segmento = pathname.split("/").filter(Boolean)[1];

	return (
		<>
			<section className="px-5 pt-7 md:px-14 md:pt-13">
				<nav className="flex items-center gap-2.5 pb-5 text-[13px] text-tinta/45">
					<Link href="/">Inicio</Link>
					<span aria-hidden="true">/</span>
					<Link href="/catalogo">Catálogo</Link>
					{segmento && (
						<>
							<span aria-hidden="true">/</span>
							<span className="text-tinta capitalize">{segmento}</span>
						</>
					)}
				</nav>

				<BuscadorCatalogo />
			</section>

			<main className="px-5 pt-8 pb-16 md:px-14 md:pt-10 md:pb-22">
				{children}
			</main>
		</>
	);
}
