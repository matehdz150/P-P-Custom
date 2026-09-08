import { FabricImage, type FabricObject, Group, Path } from "fabric";

/** Los SVG conservan sus trazos; la selección múltiple tiene otra interacción. */
export function esObjetoGrafico(
	objeto: FabricObject | null | undefined,
): objeto is FabricImage | Group | Path {
	return (
		objeto instanceof FabricImage ||
		objeto instanceof Path ||
		(objeto instanceof Group && objeto.type === "group")
	);
}
