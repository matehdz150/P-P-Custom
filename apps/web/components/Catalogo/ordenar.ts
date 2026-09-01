import type { ProductFromCategory } from "@/lib/api/search";

export type Orden = "relevancia" | "precio-asc" | "precio-desc" | "nombre";

export const ORDENES: { valor: Orden; label: string }[] = [
	{ valor: "relevancia", label: "Más relevantes" },
	{ valor: "precio-asc", label: "Precio: menor a mayor" },
	{ valor: "precio-desc", label: "Precio: mayor a menor" },
	{ valor: "nombre", label: "Nombre A–Z" },
];

export function ordenar(
	productos: ProductFromCategory[],
	orden: Orden,
): ProductFromCategory[] {
	const lista = [...productos];

	switch (orden) {
		case "precio-asc":
			return lista.sort(
				(a, b) =>
					(a.basePrice ?? Number.POSITIVE_INFINITY) -
					(b.basePrice ?? Number.POSITIVE_INFINITY),
			);
		case "precio-desc":
			return lista.sort(
				(a, b) =>
					(b.basePrice ?? Number.NEGATIVE_INFINITY) -
					(a.basePrice ?? Number.NEGATIVE_INFINITY),
			);
		case "nombre":
			return lista.sort((a, b) => a.name.localeCompare(b.name, "es"));
		default:
			return lista;
	}
}
