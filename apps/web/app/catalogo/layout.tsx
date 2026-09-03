"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SearchProvider } from "@/Contexts/SearchContext";
import BuscadorCatalogo from "@/components/Catalogo/BuscadorCatalogo";
import Footer from "@/components/Kustto/Footer";
import Header from "@/components/Kustto/Header";
import { rutaLimpia } from "@/lib/rutas";

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
	// Sin la barra final: en producción `usePathname()` devuelve `/catalogo/` y
	// esto montaba un segundo buscador encima del hero. Ver `lib/rutas.ts`.
	const ruta = rutaLimpia(pathname);

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
