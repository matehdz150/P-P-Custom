"use client";

import {
	canonicalJson,
	EMBROIDERY_PROFILE_HYBRID_V4,
	sha256,
} from "@kustto/bordado";
import type { Canvas, FabricObject, FabricText } from "fabric";
import svgpath from "svgpath";
import { esTexto, textoATrazos } from "@/lib/impresion/curvas";
import { normalizarHex } from "./color";
import type { FuenteCapturada, SolicitudDePreparacion } from "./protocolo";
import { lienzoEnMm } from "./rejilla";

/**
 * Lo que sí tiene que pasar en el hilo principal.
 *
 * ES LA MITAD BARATA Y LA ÚNICA QUE NO SE PUEDE MOVER. Fabric vive en el
 * documento y las fuentes se cargan con `<script>` y `document`, así que
 * convertir un texto a curvas y pintar una imagen sobre la rejilla se hacen
 * aquí. Todo lo demás —analizar, segmentar, cuantizar, adelgazar, generar
 * geometría— sale hacia el worker.
 *
 * SE PINTA AQUÍ Y SE MANDAN PÍXELES. Podría mandarse el archivo original y que
 * el worker lo decodificara, pero entonces habría que reproducir allí la
 * transformación del objeto en el lienzo —escala, rotación, recorte del área— y
 * una discrepancia de medio milímetro entre lo que el comprador ve y lo que se
 * borda es exactamente el fallo que nadie encuentra. Se pinta con la misma
 * transformación que usa el editor y se manda el resultado.
 */

function esImagen(objeto: FabricObject) {
	return (
		typeof (objeto as { isType?: (tipo: string) => boolean }).isType ===
			"function" &&
		(objeto as { isType: (tipo: string) => boolean }).isType("image")
	);
}

function numero(elemento: Element, nombre: string, porDefecto = 0) {
	const valor = Number(elemento.getAttribute(nombre));
	return Number.isFinite(valor) ? valor : porDefecto;
}

function trazadoDe(elemento: Element): string | null {
	if (elemento.tagName === "path") return elemento.getAttribute("d");
	if (elemento.tagName === "rect") {
		const x = numero(elemento, "x"),
			y = numero(elemento, "y"),
			w = numero(elemento, "width"),
			h = numero(elemento, "height");
		return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
	}
	if (elemento.tagName === "circle") {
		const cx = numero(elemento, "cx"),
			cy = numero(elemento, "cy"),
			r = numero(elemento, "r");
		return `M${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}Z`;
	}
	if (elemento.tagName === "ellipse") {
		const cx = numero(elemento, "cx"),
			cy = numero(elemento, "cy"),
			rx = numero(elemento, "rx"),
			ry = numero(elemento, "ry");
		return `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;
	}
	if (elemento.tagName === "polygon" || elemento.tagName === "polyline") {
		const puntos = elemento.getAttribute("points")?.trim();
		return puntos
			? `M${puntos}${elemento.tagName === "polygon" ? "Z" : ""}`
			: null;
	}
	if (elemento.tagName === "line")
		return `M${numero(elemento, "x1")} ${numero(elemento, "y1")}L${numero(elemento, "x2")} ${numero(elemento, "y2")}`;
	return null;
}

function transformaciones(elemento: Element): string[] {
	const valores: string[] = [];
	let actual: Element | null = elemento;
	while (actual) {
		const valor = actual.getAttribute("transform");
		if (valor) valores.unshift(valor);
		actual = actual.parentElement;
	}
	return valores;
}

export async function capturar(input: {
	canvas: Canvas;
	areas: FabricObject[];
	productId: string;
	sideId: string;
	widthMm: number;
	heightMm: number;
	revision: number;
}): Promise<{
	solicitud: SolicitudDePreparacion;
	/** Los búferes que se transfieren en vez de copiarse. */
	transferibles: ArrayBuffer[];
}> {
	const area = input.areas[0];
	if (!area) throw new Error("Este lado no tiene un área de bordado");

	const rect = area.getBoundingRect();
	if (!(rect.width > 0 && rect.height > 0))
		throw new Error("El área de bordado no tiene medidas válidas");

	const fuentes = input.canvas
		.getObjects()
		.filter((objeto) => !input.areas.includes(objeto));
	if (!fuentes.length)
		throw new Error("Agrega texto o un logo antes de preparar el bordado");

	const escalaX = input.widthMm / rect.width;
	const escalaY = input.heightMm / rect.height;

	const capturadas: FuenteCapturada[] = [];
	const transferibles: ArrayBuffer[] = [];

	for (let i = 0; i < fuentes.length; i++) {
		const fuente = fuentes[i];
		const sourceObjectId = String((fuente as { id?: string }).id ?? i);

		if (esTexto(fuente)) {
			const markup = await textoATrazos(fuente as FabricText);
			if (markup === null)
				throw new Error("No pudimos convertir una fuente a curvas");

			const documento = new DOMParser().parseFromString(
				`<svg xmlns="http://www.w3.org/2000/svg">${markup}</svg>`,
				"image/svg+xml",
			);
			if (documento.querySelector("parsererror"))
				throw new Error("No pudimos leer el texto convertido a curvas");

			const grupo = documento.querySelector("g");
			const d = documento.querySelector("path")?.getAttribute("d");
			if (!d) throw new Error("El texto quedó vacío al convertirlo a curvas");

			let camino = svgpath(d);
			const matriz = grupo?.getAttribute("transform");
			if (matriz) camino = camino.transform(matriz);

			capturadas.push({
				tipo: "texto",
				sourceObjectId,
				d: camino
					.translate(-rect.left, -rect.top)
					.scale(escalaX, escalaY)
					.toString(),
				colorHex: normalizarHex(
					typeof (fuente as FabricText).fill === "string"
						? ((fuente as FabricText).fill as string)
						: "#111111",
				),
			});
			continue;
		}

		if (esImagen(fuente)) {
			const lienzo = lienzoEnMm(input.widthMm, input.heightMm);
			// El objeto se pinta con SU propia transformación encima de la del área,
			// así que lo que se mide es exactamente lo que el comprador ve colocado.
			lienzo.ctx.scale(escalaX, escalaY);
			lienzo.ctx.translate(-rect.left, -rect.top);
			fuente.render(lienzo.ctx as unknown as CanvasRenderingContext2D);
			lienzo.ctx.setTransform(1, 0, 0, 1, 0, 0);

			const imagen = lienzo.ctx.getImageData(0, 0, lienzo.ancho, lienzo.alto);
			capturadas.push({
				tipo: "raster",
				sourceObjectId,
				datos: imagen.data,
				ancho: lienzo.ancho,
				alto: lienzo.alto,
				mmPorPx: lienzo.mmPorPx,
				desplazamientoMm: lienzo.desplazamientoMm,
			});
			transferibles.push(imagen.data.buffer as ArrayBuffer);
			continue;
		}

		const documento = new DOMParser().parseFromString(
			`<svg xmlns="http://www.w3.org/2000/svg">${fuente.toSVG()}</svg>`,
			"image/svg+xml",
		);
		if (documento.querySelector("parsererror,image,text,script,use"))
			throw new Error(
				"El diseño contiene una geometría que aún no es compatible con bordado",
			);

		// Se agrupa POR COLOR: dos formas del mismo hilo que se tocan son una sola
		// región para la máquina, y separarlas metería un corte de hilo entre ellas.
		const porColor = new Map<string, string[]>();
		for (const elemento of documento.querySelectorAll(
			"path,rect,circle,ellipse,polygon,polyline,line",
		)) {
			const d = trazadoDe(elemento);
			if (!d) continue;
			let camino = svgpath(d);
			for (const transformacion of transformaciones(elemento))
				camino = camino.transform(transformacion);
			const hex = normalizarHex(
				elemento.getAttribute("fill") ??
					elemento.parentElement?.getAttribute("fill") ??
					elemento.getAttribute("stroke"),
			);
			porColor.set(hex, [
				...(porColor.get(hex) ?? []),
				camino
					.translate(-rect.left, -rect.top)
					.scale(escalaX, escalaY)
					.toString(),
			]);
		}

		if (porColor.size)
			capturadas.push({
				tipo: "vector",
				sourceObjectId,
				porColor: [...porColor.entries()].map(([hex, caminos]) => ({
					hex,
					caminos,
				})),
			});
	}

	const sourceSnapshotHash = await sha256(
		canonicalJson({
			productId: input.productId,
			sideId: input.sideId,
			canvas: input.canvas.toJSON(),
			widthMm: input.widthMm,
			heightMm: input.heightMm,
			// El perfil entra en el hash: las MISMAS formas con otras reglas son otro
			// bordado, y sin esto se serviría el resultado viejo desde caché.
			profileVersion: EMBROIDERY_PROFILE_HYBRID_V4.version,
		}),
	);

	return {
		solicitud: {
			revision: input.revision,
			productId: input.productId,
			sideId: input.sideId,
			widthMm: input.widthMm,
			heightMm: input.heightMm,
			sourceSnapshotHash,
			fuentes: capturadas,
		},
		transferibles,
	};
}
