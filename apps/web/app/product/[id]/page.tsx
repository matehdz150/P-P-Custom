import { notFound } from "next/navigation";
import ProductoVista from "@/components/Producto/ProductoVista";
import { ApiError } from "@/lib/api/api";
import { getCatalogProducts, getProduct } from "@/lib/api/products";

/** Cuántas piezas asoman en "También se personalizan". */
const RECOMENDADOS = 4;

export default async function ProductPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	// Un id que ya no existe es un 404, no una página rota: pasa cada vez que
	// se archiva un producto o se vuelve a poblar la base.
	const product = await getProduct(id).catch((error) => {
		if (error instanceof ApiError && error.status === 404) notFound();
		throw error;
	});

	// El catálogo es para las recomendaciones: si falla, la sección no se pinta
	// pero la ficha sigue en pie.
	const catalogo = await getCatalogProducts().catch(() => []);

	const recomendados = catalogo
		.filter((p) => p.id !== product.id)
		.slice(0, RECOMENDADOS);

	return <ProductoVista product={product} recomendados={recomendados} />;
}
