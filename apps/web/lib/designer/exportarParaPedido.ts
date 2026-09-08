"use client";

import type { Canvas, FabricObject } from "fabric";
import type { PrendaColor } from "@/Contexts/DesignerContext";
import type { DesignerProductTemplate } from "@/lib/api/products";
import { conDpi } from "@/lib/designer/dpi";
import { exportarSvgDeLado } from "@/lib/impresion/svg";
import { salidaDelLado } from "@/lib/impresion/tecnicas";
import type { ArchivoDeLado } from "@/lib/pedido/borrador";
import { componerCilindro } from "@/lib/prenda/cilindro";
import { componerPrenda, type MezclaDeTinta } from "@/lib/prenda/componer";
import { mezclaParaColor } from "@/lib/prenda/perspectiva";
import {
	exportarArteDeLado,
	exportarColocacion,
	exportarMiniaturaDelArte,
} from "./exportarArte";

/**
 * Saca del lienzo todo lo que hace falta para pedir.
 *
 * Vive aquí y no dentro de una pantalla porque lo usan DOS caminos —pedir
 * ahora y agregar al carrito— y es la parte más delicada del editor: quitar el
 * mockup sin dejar rastro, respetar los DPI del taller y escribirle la
 * resolución al PNG. Duplicarla sería tener dos versiones de eso.
 *
 * Es SÍNCRONA por dentro y pesada: bloquea el hilo mientras rinde. Quien la
 * llame debería haber pintado ya un aviso.
 */
export type LadosExportados = {
	archivos: ArchivoDeLado[];
	/** Sólo los objetos del cliente: las guías las repone el editor. */
	diseno: Record<string, object[]>;
};

type EstadoDeLado = { canvas: Canvas | null; editableAreas: FabricObject[] };

/**
 * Que lo que va a la máquina de grabado sea grabable, o parar el pedido.
 *
 * QUÉ SE COMPRUEBA Y POR QUÉ. `exportarSvgDeLado` cuenta dos cosas que no
 * pudo convertir: imágenes que siguen siendo ráster —un diseño guardado antes
 * de que el editor vectorizara al subir— y textos cuya tipografía no se pudo
 * leer. Las dos producen un archivo que se ve bien en pantalla y que el láser
 * no puede seguir.
 *
 * EL MENSAJE DICE QUÉ HACER, no que algo falló. "Revisa tu diseño" obliga a
 * adivinar cuál de los cuatro objetos es el que estorba; nombrar el lado y la
 * acción concreta se puede seguir sin preguntar.
 */
function revisarElVector(
	vectorial: { imagenesSinTrazar: number; textosSinConvertir: number } | null,
	lado: string,
) {
	if (!vectorial) {
		throw new Error(
			`No pudimos preparar los trazos de ${lado}. Quita lo que tengas puesto y vuelve a ponerlo.`,
		);
	}

	const { imagenesSinTrazar: imagenes, textosSinConvertir: textos } = vectorial;
	if (imagenes === 0 && textos === 0) return;

	const problemas: string[] = [];

	if (imagenes > 0) {
		problemas.push(
			imagenes === 1
				? "hay 1 imagen que no está convertida a trazos: bórrala y vuelve a subirla"
				: `hay ${imagenes} imágenes que no están convertidas a trazos: bórralas y vuelve a subirlas`,
		);
	}

	if (textos > 0) {
		problemas.push(
			textos === 1
				? "hay 1 texto cuya tipografía no pudimos convertir: cámbiale la fuente"
				: `hay ${textos} textos cuya tipografía no pudimos convertir: cámbiales la fuente`,
		);
	}

	throw new Error(
		`En ${lado}, ${problemas.join(" y ")}. Este producto se graba con láser y la máquina sólo puede seguir trazos.`,
	);
}

export async function exportarParaPedido(
	sides: Record<string, EstadoDeLado>,
	producto: DesignerProductTemplate,
	/**
	 * El color elegido. Decide QUÉ foto real toca y cómo se mezcla la tinta:
	 * hay una foto por lado Y por color, así que sin esto no se puede componer.
	 */
	colorPrenda?: PrendaColor | null,
): Promise<LadosExportados> {
	const conDiseno = Object.entries(sides).flatMap(([lado, estado]) => {
		const canvas = estado.canvas;
		if (!canvas) return [];

		const hayDiseno = canvas
			.getObjects()
			.some((o) => !estado.editableAreas.includes(o));

		return hayDiseno ? [{ lado, canvas, areas: estado.editableAreas }] : [];
	});

	if (conDiseno.length === 0) {
		throw new Error("Todavía no has puesto nada en la prenda.");
	}

	const archivos: ArchivoDeLado[] = [];

	for (const { lado, canvas, areas } of conDiseno) {
		const medidas = producto.printSides?.find((s) => s.sideKey === lado);

		const arte = exportarArteDeLado(lado, canvas, areas, {
			widthCm: medidas?.widthCm ?? 28,
			heightCm: medidas?.heightCm ?? 35,
			dpi: medidas?.dpi,
		});

		if (!arte) continue;

		/* EL VECTOR SÓLO DONDE LO PIDEN. Recorre los objetos, lee las fuentes y
		   las descomprime: es caro, y en una playera no lo mira nadie porque una
		   DTF se manda en PNG. Lo decide la técnica declarada del lado. */
		const vectorial =
			salidaDelLado(medidas) === "vector"
				? await exportarSvgDeLado(canvas, areas, {
						widthCm: medidas?.widthCm ?? 28,
					})
				: null;

		/* SI EL VECTOR NO SALIÓ LIMPIO, NO SE PIDE. No es un aviso que se pueda
		   ignorar: en un lado de grabado el PNG no se puede producir —la máquina
		   recorre trazos, no imprime medias tintas—, así que un archivo con una
		   imagen ráster o un texto sin convertir es un pedido que el taller no
		   puede fabricar y que nadie descubre hasta tener la pieza delante.
		   Vale más no dejar confirmar. */
		if (salidaDelLado(medidas) === "vector") {
			revisarElVector(vectorial, producto.sideLabels?.[lado] ?? lado);
		}

		const colocacion = exportarColocacion(canvas, areas);

		archivos.push({
			lado,
			/* Con su resolución escrita dentro. `toDataURL` no la pone, y sin ella
			   el archivo se abre a 72 dpi: 116 cm en vez de 28. */
			arte: await conDpi(arte.blob, arte.dpi),
			colocacion: colocacion?.blob ?? null,
			prenda: await sobreLaPrendaReal(producto, lado, colorPrenda, arte.blob),
			vector: vectorial?.blob ?? null,
			miniaturaArte: exportarMiniaturaDelArte(canvas, areas),
			miniaturaPrenda: colocacion?.dataUrl ?? null,
			sangradoCm: arte.sangradoCm,
			anchoPx: arte.anchoPx,
			altoPx: arte.altoPx,
			dpi: arte.dpi,
		});
	}

	if (archivos.length === 0) {
		throw new Error("No encontramos nada dibujado que mandar.");
	}

	return {
		archivos,
		diseno: Object.fromEntries(
			conDiseno.map(({ lado, canvas, areas }) => [
				lado,
				canvas
					.getObjects()
					.filter((o) => !areas.includes(o))
					/* La marca distingue las capas base bloqueadas de lo que añadió el
					   invitado. Fabric no serializa propiedades propias a menos que se
					   pidan explícitamente; perderla permitiría editar la base al volver. */
					.map((o) => o.toObject(["esBaseDeEvento"])),
			]),
		),
	};
}

/**
 * El diseño proyectado sobre la FOTO REAL de la prenda, si el taller la subió.
 *
 * ES OTRA COSA QUE `colocacion`, y por eso viaja aparte en vez de sustituirla.
 * `colocacion` es el mockup —el dibujo de línea— y sirve para comprobar DÓNDE
 * cae el estampado con geometría limpia; ésta es la prenda de verdad, con sus
 * pliegues y su caída, y sirve para ver lo que el cliente vio. El taller
 * necesita las dos: una para cuadrar y otra para saber qué esperaba quien pidió.
 *
 * DEVUELVE NULO SIN DRAMA cuando no hay foto de ese lado en ese color. Es lo
 * normal hoy —el paso del alta es opcional y casi ningún producto las tiene— y
 * un pedido no se puede caer porque falte una imagen de referencia.
 *
 * TAMPOCO SE CAE SI FALLA. Componer recorre píxeles y puede quedarse sin
 * memoria con una foto enorme; si eso pasa, se pide igual y el taller se queda
 * con el mockup, que es lo que tenía antes de que esto existiera.
 */
async function sobreLaPrendaReal(
	producto: DesignerProductTemplate,
	lado: string,
	colorPrenda: PrendaColor | null | undefined,
	arte: Blob,
): Promise<Blob | null> {
	const foto = (producto.fotosReales ?? []).find(
		(f) => f.lado === lado && f.color === colorPrenda?.name,
	);

	if (!foto) return null;

	/* QUÉ RASTERIZADOR TOCA LO DICE LA FOTO, no la forma de la plantilla.
	
	   Podría leerse de `producto.forma`, pero la foto es el dato más cercano: es
	   la que trae la geometría con la que se marcó, y una foto con banda sólo se
	   puede componer como cilindro aunque alguien cambiara la plantilla después.
	   Sin ninguna de las dos no hay nada que proyectar. */
	const arteUrl = URL.createObjectURL(arte);

	try {
		const mezcla = mezclaParaColor(colorPrenda?.hex) as MezclaDeTinta;

		if (foto.banda) {
			return await componerCilindro({
				fotoUrl: foto.url,
				arteUrl,
				banda: foto.banda,
				mezcla,
			});
		}

		if (foto.esquinas?.length === 4) {
			return await componerPrenda({
				fotoUrl: foto.url,
				arteUrl,
				esquinas: foto.esquinas,
				mezcla,
			});
		}

		return null;
	} catch {
		return null;
	} finally {
		URL.revokeObjectURL(arteUrl);
	}
}
