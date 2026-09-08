import type { FabricObject } from "fabric";
import { PLATA } from "@/lib/prenda/laser";

/**
 * El plateado del grabado DENTRO DEL EDITOR.
 *
 * PLATA SÓLIDA, NO UN DEGRADADO, y es una decisión con dos motivos.
 *
 * El primero es que se rompía: se probó con un `Gradient` de fabric para que
 * brillara como en la previsualización, y al poner uno en `fill` ese campo
 * deja de ser un color. Todo lo que lo lee como texto se cae —el selector de
 * color reventaba con `value.replace is not a function` en cuanto se insertaba
 * un texto—, y son varios sitios: el selector, el panel de capas, la
 * exportación. Un color sigue siendo un color.
 *
 * El segundo es que en el editor tampoco conviene: ahí se está componiendo
 * encima —moviendo, escribiendo, comparando— y un cromado con bandas compite
 * con el diseño en vez de informar. El brillo metálico vive en "Probar", que
 * es donde la pregunta es «cómo va a quedar».
 *
 * El tono se importa de `lib/prenda/laser` para que el editor y la
 * previsualización no acaben con dos platas distintas.
 */

const hex = (v: number) => v.toString(16).padStart(2, "0");

/** El mismo plateado que usa la previsualización, como color CSS. */
export const PLATA_HEX = `#${hex(PLATA.r)}${hex(PLATA.g)}${hex(PLATA.b)}`;

/**
 * Deja un objeto —y lo que lleve dentro— en plateado.
 *
 * Recorre los grupos porque un SVG vectorizado llega como grupo de trazos: si
 * sólo se tocara el grupo no pasaría nada, los grupos de fabric no se pintan.
 *
 * El trazo se tiñe además del relleno: un vectorizado puede traer contornos, y
 * dejarlos negros delataría el color original justo en el borde.
 */
export function platearObjeto(objeto: FabricObject) {
	const hijos = (objeto as unknown as { _objects?: FabricObject[] })._objects;
	if (hijos?.length) {
		for (const hijo of hijos) platearObjeto(hijo);
		return;
	}
	objeto.set({ fill: PLATA_HEX });
	if (objeto.stroke) objeto.set({ stroke: PLATA_HEX });
}
