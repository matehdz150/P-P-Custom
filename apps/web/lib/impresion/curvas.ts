"use client";

import type { FabricObject, FabricText } from "fabric";

/**
 * El texto del lienzo, convertido a curvas.
 *
 * POR QUÉ HACE FALTA. Un láser no imprime, sigue un recorrido, así que el
 * archivo lleva trazos. `canvas.toSVG()` saca el texto como `<text>` con un
 * `font-family` dentro: el taller abre el archivo, no tiene esa fuente
 * instalada y la máquina corta otra cosa — o nada. Convertir el texto a curvas
 * es el paso que en cualquier imprenta se pide antes de mandar un archivo, y
 * aquí hay que hacerlo nosotros porque nadie más va a abrir el diseño.
 *
 * NO SE REIMPLEMENTA LA MAQUETACIÓN DE FABRIC, SE LE PREGUNTA. Este módulo
 * renderiza el texto en un lienzo de mentira con `fillText` interceptado y se
 * queda con las coordenadas que Fabric pasó. Es la decisión importante del
 * archivo: reproducir a mano dónde cae cada línea significa copiar el salto de
 * línea, la alineación, el interletraje y la línea base, y equivocarse en
 * cualquiera de esas cosas no da un error — corta el diseño en el sitio
 * equivocado y se descubre con la pieza quemada delante.
 *
 * Se probó primero por el otro camino. La línea base de Fabric no es
 * `arriba + alto de la línea` como parecía: resta `getHeightOfLineImpl(i) ×
 * 0.222`, una constante privada. El texto salía 13.5 px bajo a tamaño 54, y
 * ese error habría escalado con la fuente. Interceptando, el desfase medido
 * contra el propio render de Fabric es de 0 y 1 px sobre un bloque de 290 ×
 * 176 —o sea, antialiasing— y sigue siéndolo con rotación, escala, dos líneas
 * y centrado.
 *
 * LAS FUENTES SON NUESTRAS, y por eso esto es posible: `next/font/google` las
 * auto-hospeda, así que el `.woff2` se puede pedir con `fetch` desde el mismo
 * origen. Vienen en WOFF2 —134 archivos, ningún TTF— y opentype.js no
 * descomprime Brotli; de ahí wawoff2, que es lo que su propia documentación
 * recomienda.
 *
 * WAWOFF2 SE CARGA CON UN `<script>` Y NO CON UN `import`. Es un binario de
 * emscripten y trae un `require("fs")` dentro de su rama de Node: Turbopack no
 * lo resuelve y el build entero se cae con "Can't resolve 'fs'". Servido desde
 * `public/vendor/` es del mismo origen, se pide sólo cuando hace falta y el
 * empaquetador ni se entera.
 */

/** Lo que Fabric le pidió pintar al lienzo: un trozo de texto y dónde va. */
type Trazada = { texto: string; x: number; y: number; fuente: string };

/**
 * Las fuentes ya leídas, por familia.
 *
 * Se guardan las PROMESAS y no las fuentes: dos textos con la misma familia se
 * exportan casi a la vez y sin esto se descargaría y descomprimiría dos veces
 * el mismo archivo de medio mega.
 */
const cache = new Map<string, Promise<opentype.Font | null>>();

/** Sólo para tipar sin arrastrar el módulo entero al bundle inicial. */
declare namespace opentype {
	type Font = import("opentype.js").Font;
}

/**
 * Dónde vive el archivo de esa familia, según el CSS que inyectó Next.
 *
 * Se lee de las hojas de estilo y no de una tabla escrita a mano porque el
 * nombre del archivo lo decide el build: `next/font` le pone un hash y cambia
 * cada vez que se toca la lista de fuentes. Una tabla se quedaría vieja en
 * silencio y el texto saldría sin convertir.
 */
function urlDeLaFuente(familia: string, peso: string, estilo: string) {
	const buscada = familia.replace(/["']/g, "").trim().toLowerCase();
	let suplente: string | null = null;

	/**
	 * LA URL DEL `src` ES RELATIVA A LA HOJA, NO A LA PÁGINA.
	 *
	 * `next/font` escribe `url(../media/abc-s.123.woff2)` dentro de un CSS que
	 * vive en `/_next/static/css/`, así que apunta a
	 * `/_next/static/media/abc-s.123.woff2`. Devolverla tal cual y pedirla desde
	 * `/design` la resolvía contra la página: `/media/abc-s.123.woff2`, que es
	 * un 404. El 404 no llegaba como error —Next devuelve la página de «no
	 * encontrado» con estado 404 y `fetch` no lanza—, así que se descomprimían
	 * 27 KB de HTML, wawoff2 devolvía `false` y el texto acababa contado como
	 * «tipografía que no pudimos convertir». Fallaban TODAS las fuentes, no una.
	 */
	const absoluta = (url: string, hoja: CSSStyleSheet) =>
		new URL(url, hoja.href || document.baseURI).href;

	for (const hoja of Array.from(document.styleSheets)) {
		let reglas: CSSRuleList;
		try {
			reglas = hoja.cssRules;
		} catch {
			// Hoja de otro origen: el navegador no deja mirarla. No son nuestras.
			continue;
		}

		for (const regla of Array.from(reglas)) {
			if (!(regla instanceof CSSFontFaceRule)) continue;

			const suya = regla.style
				.getPropertyValue("font-family")
				.replace(/["']/g, "")
				.trim()
				.toLowerCase();
			if (suya !== buscada) continue;

			const url = regla.style
				.getPropertyValue("src")
				.match(/url\(["']?([^"')]+)["']?\)/)?.[1];
			if (!url) continue;

			/* La familia puede traer varios pesos e itálicas. Se prefiere la que
			   coincide, pero si no está se usa cualquiera de la familia: mejor las
			   curvas del peso equivocado que un `<text>` que el taller no puede
			   abrir. */
			const suPeso = regla.style.getPropertyValue("font-weight").trim();
			const suEstilo = regla.style.getPropertyValue("font-style").trim();
			if (
				(!suPeso || suPeso === peso || suPeso === "normal") &&
				(!suEstilo || suEstilo === estilo)
			) {
				return absoluta(url, hoja);
			}
			suplente ??= absoluta(url, hoja);
		}
	}

	return suplente;
}

/** Lo que el binario de emscripten cuelga del `window` al arrancar. */
type Descompresor = (datos: Uint8Array) => Uint8Array | false;

declare global {
	interface Window {
		Module?: { decompress?: Descompresor };
	}
}

let descompresor: Promise<Descompresor | null> | null = null;

/**
 * Trae el descompresor de WOFF2, una sola vez.
 *
 * SE SONDEA EN VEZ DE ESCUCHAR `onRuntimeInitialized`. Ese callback sólo se
 * dispara si se engancha ANTES de que el runtime arranque, y con el script ya
 * en caché arranca primero: la promesa se quedaba colgada para siempre y la
 * exportación no terminaba nunca. Sondear funciona en los dos casos.
 */
function cargarDescompresor() {
	descompresor ??= new Promise<Descompresor | null>((listo) => {
		const script = document.createElement("script");
		script.src = "/vendor/wawoff2-decompress.js";

		script.onload = async () => {
			for (let i = 0; i < 200; i++) {
				const fn = window.Module?.decompress;
				if (typeof fn === "function") return listo(fn);
				await new Promise((sigue) => setTimeout(sigue, 25));
			}
			listo(null);
		};
		script.onerror = () => listo(null);

		document.head.appendChild(script);
	});

	return descompresor;
}

async function cargarFuente(familia: string, peso: string, estilo: string) {
	const llave = `${familia}|${peso}|${estilo}`;
	const guardada = cache.get(llave);
	if (guardada) return guardada;

	const promesa = (async () => {
		const url = urlDeLaFuente(familia, peso, estilo);
		if (!url) return null;

		const bytes = await (await fetch(url)).arrayBuffer();

		/* Se pide aquí y no arriba: entre opentype y el descompresor son casi
		   ochocientos kilos, y sólo hacen falta al pedir un producto de láser.
		   Quien diseña una playera no los descarga nunca. */
		const opentype = await import("opentype.js");

		if (!/\.woff2(\?|$)/i.test(url)) {
			return opentype.parse(bytes);
		}

		const descomprimir = await cargarDescompresor();
		if (!descomprimir) return null;

		const ttf = descomprimir(new Uint8Array(bytes));
		if (ttf === false) return null;

		// `parse` quiere un ArrayBuffer, y el de wawoff2 puede venir con desfase.
		return opentype.parse(
			ttf.buffer.slice(ttf.byteOffset, ttf.byteOffset + ttf.byteLength),
		);
	})().catch(() => null);

	cache.set(llave, promesa);
	return promesa;
}

/**
 * Qué dibuja Fabric y en qué coordenadas, sin dibujarlo.
 *
 * Se parchea el PROTOTIPO y no un contexto concreto porque `_render` crea el
 * suyo por dentro. Va con `try/finally`: si esto se quedara puesto, el editor
 * dejaría de pintar texto y no habría manera de relacionarlo con exportar.
 */
function trazadasDe(texto: FabricText): Trazada[] {
	const proto = CanvasRenderingContext2D.prototype;
	const fillOriginal = proto.fillText;
	const strokeOriginal = proto.strokeText;

	const trazadas: Trazada[] = [];

	proto.fillText = function (t: string, x: number, y: number) {
		trazadas.push({ texto: t, x, y, fuente: this.font });
	};
	// El contorno pinta las mismas letras en el mismo sitio: contarlo duplicaría
	// cada trazo.
	proto.strokeText = () => {};

	try {
		const lienzo = document.createElement("canvas").getContext("2d");
		if (lienzo) {
			// `_render` dibuja en el espacio LOCAL del objeto —centrado en su
			// origen—, que es justo el espacio en el que va la matriz de abajo.
			(
				texto as unknown as { _render(c: CanvasRenderingContext2D): void }
			)._render(lienzo);
		}
	} finally {
		proto.fillText = fillOriginal;
		proto.strokeText = strokeOriginal;
	}

	return trazadas;
}

/** De `"italic 700 54px Bebas Neue"` a sus partes. */
function leerFuente(css: string) {
	const tam = Number(css.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? 0);
	const familia = css.split(/\d+(?:\.\d+)?px\s+/)[1]?.trim() ?? "";
	const peso = css.match(/\b(bold|[1-9]00)\b/)?.[1] ?? "normal";
	const estilo = /\bitalic\b/.test(css) ? "italic" : "normal";

	return { tam, familia: familia.replace(/["']/g, ""), peso, estilo };
}

export function esTexto(objeto: FabricObject): objeto is FabricText {
	return (
		typeof (objeto as { isType?: (...t: string[]) => boolean }).isType ===
			"function" &&
		(objeto as { isType: (...t: string[]) => boolean }).isType(
			"text",
			"i-text",
			"textbox",
		)
	);
}

/**
 * Un objeto de texto, como `<g><path/></g>` listo para el SVG.
 *
 * Devuelve `null` si la fuente no se pudo leer, y quien llama TIENE que
 * enterarse: dejar caer un texto sin avisar manda a producir un diseño al que
 * le falta la mitad.
 */
export async function textoATrazos(texto: FabricText): Promise<string | null> {
	const trazadas = trazadasDe(texto).filter((t) => t.texto);
	if (trazadas.length === 0) return "";

	const partes: string[] = [];

	for (const trazada of trazadas) {
		const { tam, familia, peso, estilo } = leerFuente(trazada.fuente);
		if (!(tam > 0) || !familia) return null;

		const fuente = await cargarFuente(familia, peso, estilo);
		if (!fuente) return null;

		partes.push(
			fuente.getPath(trazada.texto, trazada.x, trazada.y, tam).toPathData(3),
		);
	}

	const matriz = texto.calcTransformMatrix();
	const relleno = typeof texto.fill === "string" ? texto.fill : "#000000";

	return `<g transform="matrix(${matriz.join(",")})"><path d="${partes.join(" ")}" fill="${relleno}"/></g>`;
}
