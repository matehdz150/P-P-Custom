"use client";

import type { MezclaDeTinta } from "./componer";

/**
 * El diseño enrollado sobre una taza o un termo, rasterizado en un PNG.
 *
 * POR QUÉ NO SIRVE `componerPrenda`. Aquél invierte una HOMOGRAFÍA: cuatro
 * esquinas definen un PLANO, y sobre una playera eso es correcto. Una taza es
 * un CILINDRO. Con la homografía el arte queda como una calcomanía pegada
 * plana: las letras de los extremos no se comprimen y el diseño no se va
 * curvando hacia el borde. Falla justo donde se mira.
 *
 * LA MITAD DE LA ENVOLTURA ES LO QUE SE VE. De frente, un cilindro enseña 180°
 * de sus 360°, así que sólo la mitad del arte entra en la imagen — y NO la
 * mitad recortada a tijera, sino comprimida hacia los bordes: dos columnas
 * separadas un milímetro en el centro se ven separadas un milímetro, y en el
 * borde casi se tocan.
 *
 * LA MATEMÁTICA, que es toda la diferencia. Para un píxel a la fracción
 * horizontal `u` del cuerpo visible:
 *
 *     θ = asin(2u − 1)              el ángulo sobre el cilindro, de −90° a 90°
 *     x  = centro + θ / 2π          la columna del arte, en fracción de 0 a 1
 *
 * `asin` es lo que produce la compresión: reparte los 180° visibles sobre el
 * ancho de la foto tal como los reparte el propio cilindro.
 *
 * EL FILO SE COMBA. Una taza fotografiada de frente enseña el borde de arriba
 * como una elipse, no como una recta, y la banda impresa la sigue. `bombeo`
 * dice cuánto baja el centro respecto de los extremos, en fracción del alto de
 * la banda; se aplica arriba y abajo con `cos θ`, que vale 1 en el centro y 0
 * en los bordes.
 *
 * SE RECORRE EL DESTINO, NO EL ORIGEN, igual que en la prenda: recorrer el
 * origen dejaría huecos entre píxeles justo donde el arte se estira.
 */

/** El tope de ancho del PNG. Una foto de estudio llega a 4000 px y no hace falta. */
const ANCHO_MAXIMO = 1600;

/**
 * Cuántas columnas del arte se promedian por columna de la foto.
 *
 * POR QUÉ NO BASTA CON UNA. Cerca del borde el cilindro se ve casi de canto:
 * una columna de la foto cubre CINCO o más columnas del arte, y quedarse con
 * la del centro es tirar las otras cuatro. Eso es lo que dentaba las letras
 * que se van hacia el borde y les ponía moiré — y no se arregla con más
 * resolución, porque cuanto más fino es el arte, más se tira.
 *
 * EL NÚMERO SALE DE LA DERIVADA, píxel a píxel: en el centro de la taza el
 * reparto es casi 1:1 y basta una muestra, así que el coste se paga sólo en la
 * franja de los bordes, que es donde hay algo que ganar. El tope está para que
 * una foto grande contra un arte grande no dispare el bucle.
 */
const MUESTRAS_MAXIMAS = 6;

export type BandaCilindrica = {
	/** Los bordes visibles del cuerpo, en fracciones de 0 a 1 de la foto. */
	izquierda: number;
	derecha: number;
	/** El alto de la banda imprimible, también en fracciones. */
	arriba: number;
	abajo: number;
	/**
	 * Cuánto se comba el filo, en fracción del alto de la banda. Positivo
	 * hunde el centro, que es lo que se ve cuando la foto está tomada un poco
	 * por encima. Cero deja la banda recta.
	 */
	bombeo: number;
	/**
	 * Qué punto de la envoltura mira a la cámara, en fracción de 0 a 1.
	 *
	 * 0.5 es "el centro del arte va al frente", que es lo normal cuando el asa
	 * queda detrás. Con el asa a un lado, el taller lo corre para que lo que se
	 * ve sea lo que el cliente puso enfrente y no la costura.
	 */
	centro: number;
};

export async function componerCilindro({
	fotoUrl,
	arteUrl,
	banda,
	mezcla,
}: {
	fotoUrl: string;
	/** El arte de la envoltura ENTERA, 360°, tal como se imprime. */
	arteUrl: string;
	banda: BandaCilindrica;
	mezcla: MezclaDeTinta;
}): Promise<Blob | null> {
	const [foto, arte] = await Promise.all([cargar(fotoUrl), cargar(arteUrl)]);
	if (!foto || !arte) return null;

	const escala = Math.min(1, ANCHO_MAXIMO / foto.naturalWidth);
	const ancho = Math.max(1, Math.round(foto.naturalWidth * escala));
	const alto = Math.max(1, Math.round(foto.naturalHeight * escala));

	const salida = lienzo(ancho, alto);
	const ctx = salida.getContext("2d", { willReadFrequently: true });
	if (!ctx) return null;

	ctx.drawImage(foto, 0, 0, ancho, alto);

	const x0 = banda.izquierda * ancho;
	const x1 = banda.derecha * ancho;

	// Banda degenerada: se devuelve la taza sola antes que una mancha.
	if (!(x1 > x0)) return aBlob(salida);

	/* El arte se lee UNA vez a su resolución nativa. Redibujarlo por píxel
	   serían millones de `drawImage`; lo que se necesita es su tabla de
	   colores. */
	const fuente = lienzo(arte.naturalWidth, arte.naturalHeight);
	const ctxArte = fuente.getContext("2d", { willReadFrequently: true });
	if (!ctxArte) return aBlob(salida);
	ctxArte.drawImage(arte, 0, 0);

	let pixelesArte: ImageData;
	let destino: ImageData;
	try {
		pixelesArte = ctxArte.getImageData(0, 0, fuente.width, fuente.height);
		destino = ctx.getImageData(0, 0, ancho, alto);
	} catch {
		// Lienzo contaminado por una imagen de otro origen. No debería pasar —las
		// fotos son nuestras y el arte es un data URL— pero si pasa, sin diseño
		// encima antes que reventar.
		return aBlob(salida);
	}

	pintar(destino, pixelesArte, banda, ancho, alto, mezcla);

	ctx.putImageData(destino, 0, 0);
	return aBlob(salida);
}

/**
 * Recorre el rectángulo de la banda y pinta lo que cae dentro del cilindro.
 *
 * Sólo ese rectángulo y no la foto entera: la banda ocupa una fracción de la
 * taza, y recorrer los cuatro millones de píxeles para tocar doscientos mil
 * sería tirar el noventa por ciento del trabajo.
 */
function pintar(
	destino: ImageData,
	arte: ImageData,
	banda: BandaCilindrica,
	ancho: number,
	alto: number,
	mezcla: MezclaDeTinta,
) {
	const izq = banda.izquierda * ancho;
	const der = banda.derecha * ancho;
	const arribaBase = banda.arriba * alto;
	const abajoBase = banda.abajo * alto;
	const altoBanda = abajoBase - arribaBase;

	if (!(altoBanda > 0)) return;

	const bombeoPx = banda.bombeo * altoBanda;

	const x0 = Math.max(0, Math.floor(izq));
	const x1 = Math.min(ancho - 1, Math.ceil(der));
	/* El recorrido vertical se abre por el bombeo: la banda combada baja del
	   rectángulo recto, y sin este margen se recortaría por el centro. */
	const y0 = Math.max(0, Math.floor(arribaBase - Math.abs(bombeoPx) - 1));
	const y1 = Math.min(alto - 1, Math.ceil(abajoBase + Math.abs(bombeoPx) + 1));

	const d = destino.data;
	const anchoVisible = der - izq;

	/* Reutilizados en todo el recorrido. Son millones de píxeles por varias
	   muestras cada uno: pedir un arreglo nuevo en cada muestra tenía al
	   recolector de basura trabajando más que el propio bucle. */
	const tinta = [0, 0, 0, 0];
	const columnas: number[] = [];

	for (let x = x0; x <= x1; x++) {
		// El centro del píxel, no su esquina: con la esquina el estampado entero
		// queda medio píxel corrido hacia arriba y a la izquierda.
		const px = x + 0.5;

		const u = (px - izq) / anchoVisible;
		if (u < 0 || u > 1) continue;

		/* El ángulo sobre el cilindro. `2u − 1` va de −1 a 1 y `asin` lo
		   convierte en el ángulo que de verdad ocupa esa columna: cerca del
		   borde, un píxel de foto cubre muchos grados de taza. */
		const seno = Math.min(1, Math.max(-1, 2 * u - 1));
		const theta = Math.asin(seno);
		const coseno = Math.cos(theta);

		const arribaCol = arribaBase + bombeoPx * coseno;
		const abajoCol = abajoBase + bombeoPx * coseno;
		const altoCol = abajoCol - arribaCol;
		if (!(altoCol > 0)) continue;

		/* CUÁNTO ARTE CABE EN ESTA COLUMNA. La derivada de `θ = asin(2u−1)` es
		   `2/√(1−(2u−1)²)`, que en el centro vale 2 y en el borde se dispara;
		   pasada a columnas del arte dice cuántas aplasta este píxel. El suelo
		   de la raíz evita el infinito exacto del borde. */
		const derivada = 2 / Math.sqrt(Math.max(1e-6, 1 - seno * seno));
		const aplastadas = (derivada / (2 * Math.PI)) * (arte.width / anchoVisible);
		const muestras = Math.min(
			MUESTRAS_MAXIMAS,
			Math.max(1, Math.round(aplastadas)),
		);

		/* Las columnas del arte que caen dentro de ESTE píxel, repartidas por su
		   ancho. No dependen de la altura, así que se calculan una vez por
		   columna y no una vez por píxel.

		   Los 180° visibles son la MITAD de la envoltura, así que `θ/2π` recorre
		   un cuarto a cada lado del centro. Se envuelve con módulo porque el
		   centro puede estar cerca de la costura. */
		columnas.length = 0;
		for (let j = 0; j < muestras; j++) {
			const uj = (px - izq + (j + 0.5) / muestras - 0.5) / anchoVisible;
			const senoJ = Math.min(1, Math.max(-1, 2 * uj - 1));
			const sxJ = envolver(banda.centro + Math.asin(senoJ) / (2 * Math.PI));
			columnas.push(sxJ * arte.width - 0.5);
		}

		for (let y = y0; y <= y1; y++) {
			const py = y + 0.5;

			const v = (py - arribaCol) / altoCol;
			if (v < 0 || v > 1) continue;

			const yArte = v * arte.height - 0.5;

			let r = 0;
			let g = 0;
			let b = 0;
			let a = 0;

			/* Se acumula PREMULTIPLICADO: el color de un píxel transparente no
			   significa nada —al rasterizar suele quedar negro— y promediarlo a
			   secas con el de la letra ensucia el borde con una orla oscura. Es
			   el halo que se veía alrededor del texto. Pesando cada color por su
			   propia opacidad, los transparentes no aportan color, sólo vacío. */
			for (let j = 0; j < muestras; j++) {
				muestrear(arte, columnas[j], yArte, tinta);
				const aJ = tinta[3];
				r += tinta[0] * aJ;
				g += tinta[1] * aJ;
				b += tinta[2] * aJ;
				a += aJ;
			}

			const alfa = a / muestras / 255;
			if (alfa <= 0) continue;

			const i = (y * ancho + x) * 4;

			for (let canal = 0; canal < 3; canal++) {
				const fondo = d[i + canal];
				// De vuelta a color normal: la suma va premultiplicada por alfa.
				const color = (canal === 0 ? r : canal === 1 ? g : b) / a;
				/* `multiply` deja pasar el brillo y la sombra del cilindro, que es
				   justo lo que hace que parezca impreso y no pegado; `normal` lo
				   tapa, y hace falta sobre una taza oscura. */
				const puesto = mezcla === "multiply" ? (fondo * color) / 255 : color;
				d[i + canal] = fondo + (puesto - fondo) * alfa;
			}
		}
	}
}

/** El arte es un anillo: pasado el 1 se vuelve al 0 por la costura. */
function envolver(x: number) {
	return x - Math.floor(x);
}

/**
 * Muestreo bilineal, EN ESPACIO PREMULTIPLICADO. Escribe en `salida` en vez de
 * devolver un arreglo: se le llama millones de veces.
 *
 * Con el vecino más cercano, el borde de una letra sale dentado justo donde el
 * cilindro más lo estira. Y con el bilineal de libro —el que interpola los
 * cuatro canales por separado— sale con orla: el píxel de al lado de la letra
 * es transparente, pero su color guardado sigue siendo negro, y mezclarlo al
 * 50 % oscurece el borde aunque su alfa fuera cero. `ImageData` no viene
 * premultiplicado, así que hay que hacerlo aquí: se pesa cada color por su
 * alfa, se interpola, y al final se deshace.
 */
function muestrear(
	img: ImageData,
	x: number,
	y: number,
	salida: number[],
): void {
	const x0 = Math.floor(x);
	const y0 = Math.floor(y);
	const fx = x - x0;
	const fy = y - y0;

	const p00 = (1 - fx) * (1 - fy);
	const p10 = fx * (1 - fy);
	const p01 = (1 - fx) * fy;
	const p11 = fx * fy;

	const i00 = indice(img, x0, y0);
	const i10 = indice(img, x0 + 1, y0);
	const i01 = indice(img, x0, y0 + 1);
	const i11 = indice(img, x0 + 1, y0 + 1);

	const d = img.data;

	const a00 = d[i00 + 3];
	const a10 = d[i10 + 3];
	const a01 = d[i01 + 3];
	const a11 = d[i11 + 3];

	const alfa = a00 * p00 + a10 * p10 + a01 * p01 + a11 * p11;
	salida[3] = alfa;

	if (alfa <= 0) {
		salida[0] = 0;
		salida[1] = 0;
		salida[2] = 0;
		return;
	}

	for (let canal = 0; canal < 3; canal++) {
		salida[canal] =
			(d[i00 + canal] * a00 * p00 +
				d[i10 + canal] * a10 * p10 +
				d[i01 + canal] * a01 * p01 +
				d[i11 + canal] * a11 * p11) /
			alfa;
	}
}

/** Dónde empieza ese píxel en `data`. */
function indice(img: ImageData, x: number, y: number) {
	/* En horizontal se ENVUELVE y en vertical se recorta. No es simetría rota:
	   el arte da la vuelta al cilindro, así que su borde derecho continúa en el
	   izquierdo; arriba y abajo, en cambio, se acaba la taza. */
	const cx = ((x % img.width) + img.width) % img.width;
	const cy = Math.min(img.height - 1, Math.max(0, y));

	return (cy * img.width + cx) * 4;
}

function lienzo(ancho: number, alto: number) {
	const el = document.createElement("canvas");
	el.width = ancho;
	el.height = alto;
	return el;
}

function cargar(url: string) {
	return new Promise<HTMLImageElement | null>((listo) => {
		const img = new Image();
		// Sin esto, una foto servida por CloudFront contamina el lienzo y
		// `getImageData` lanza `SecurityError`.
		img.crossOrigin = "anonymous";
		img.onload = () => listo(img);
		img.onerror = () => listo(null);
		img.src = url;
	});
}

function aBlob(el: HTMLCanvasElement): Promise<Blob | null> {
	return new Promise((listo) => el.toBlob((b) => listo(b), "image/png"));
}
