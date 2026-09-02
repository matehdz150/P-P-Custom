import { notFound } from "next/navigation";
import { idsDeProductos } from "@/lib/build/parametros";
import ProductoVista from "@/components/Producto/ProductoVista";
import {
	aProductoViejo,
	aTarjetasViejas,
	getCatalogo,
	getFichaDeProducto,
} from "@/lib/api/catalogo";

/** Cuántas piezas asoman en "También se personalizan". */
const RECOMENDADOS = 4;

export default async function ProductPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	// Un id que ya no existe es un 404, no una página rota: pasa cada vez que
	// se archiva un producto, y también cuando uno vuelve a revisión — deja de
	// estar publicado y el catálogo no debe seguir enseñándolo.
	const ficha = await getFichaDeProducto(id).catch(() => null);
	if (!ficha) notFound();

	// El catálogo es para las recomendaciones: si falla, la sección no se pinta
	// pero la ficha sigue en pie.
	const catalogo = await getCatalogo().catch(() => []);

	const recomendados = aTarjetasViejas(
		catalogo.filter((p) => p.id !== ficha.id).slice(0, RECOMENDADOS),
	);

	return (
		<ProductoVista
			product={aProductoViejo(ficha)}
			recomendados={recomendados}
		/>
	);
}

/**
 * Las URLs de esta ruta, resueltas al construir. Ver lib/build/parametros.ts:
 * un producto aprobado no aparece hasta el siguiente despliegue.
 */
export async function generateStaticParams() {
	return (await idsDeProductos()).map((id) => ({ id }));
}
