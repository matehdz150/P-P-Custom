import { idsDeCategorias } from "@/lib/build/parametros";
import VistaPorCategoria from "./Vista";

/**
 * Envoltorio de servidor.
 *
 * La pantalla es de cliente —lee la categoría con `useParams` y pide los
 * productos al montar— y una página `"use client"` no puede exportar
 * `generateStaticParams`. Por eso la vista vive en `Vista.tsx` y aquí sólo
 * queda lo que el build necesita para saber qué URLs generar.
 */
export async function generateStaticParams() {
	return (await idsDeCategorias()).map((id) => ({ id }));
}

export default function Pagina() {
	return <VistaPorCategoria />;
}
