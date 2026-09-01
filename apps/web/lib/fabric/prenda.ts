/**
 * Teñido de la prenda del mockup.
 *
 * Los mockups son PNG opacos: la prenda dibujada sobre un fondo blanco, sin
 * canal alfa. Para poder pintarla de otro color hay que separarla del fondo
 * primero, y eso se hace aquí en el navegador — así funciona con los mockups
 * que ya están subidos y con los que suba cualquier proveedor mañana, sin
 * pedirle un archivo por color ni migrar nada.
 *
 * El recorte va por relleno desde los bordes, no por umbral global: si se
 * borrara todo lo claro de la imagen, la tela blanca del interior de la
 * prenda se volvería transparente y quedaría un agujero.
 */

/** Luminancia a partir de la cual un pixel del borde cuenta como fondo. */
const UMBRAL_FONDO = 236;

/** Ancho al que se procesa. El canvas dibuja el mockup a 700px de ancho. */
const ANCHO_PROCESO = 900;

function lienzo(w: number, h: number) {
	const c = document.createElement("canvas");
	c.width = w;
	c.height = h;
	return c;
}

/**
 * Separa la prenda del fondo y la deja en gris sobre transparencia. El gris
 * es el sombreado: es lo que después se multiplica sobre el color plano para
 * que se conserven pliegues y costuras.
 */
export function recortarPrenda(
	img: HTMLImageElement,
): HTMLCanvasElement | null {
	const escala = Math.min(1, ANCHO_PROCESO / img.naturalWidth);
	const w = Math.max(1, Math.round(img.naturalWidth * escala));
	const h = Math.max(1, Math.round(img.naturalHeight * escala));

	const c = lienzo(w, h);
	const ctx = c.getContext("2d", { willReadFrequently: true });
	if (!ctx) return null;

	ctx.drawImage(img, 0, 0, w, h);

	let datos: ImageData;
	try {
		datos = ctx.getImageData(0, 0, w, h);
	} catch {
		// canvas contaminado por una imagen de otro origen: sin teñido
		return null;
	}

	const px = datos.data;
	const total = w * h;
	const visto = new Uint8Array(total);
	const pila: number[] = [];

	const esClaro = (i: number) => {
		const p = i * 4;
		return (
			px[p] * 0.299 + px[p + 1] * 0.587 + px[p + 2] * 0.114 >= UMBRAL_FONDO
		);
	};

	for (let x = 0; x < w; x++) {
		pila.push(x, (h - 1) * w + x);
	}
	for (let y = 0; y < h; y++) {
		pila.push(y * w, y * w + w - 1);
	}

	while (pila.length) {
		const i = pila.pop() as number;
		if (visto[i] || !esClaro(i)) continue;
		visto[i] = 1;

		const x = i % w;
		const y = (i / w) | 0;
		if (x > 0) pila.push(i - 1);
		if (x < w - 1) pila.push(i + 1);
		if (y > 0) pila.push(i - w);
		if (y < h - 1) pila.push(i + w);
	}

	let recortados = 0;
	for (let i = 0; i < total; i++) {
		const p = i * 4;
		if (visto[i]) {
			px[p + 3] = 0;
			recortados++;
			continue;
		}
		const gris = px[p] * 0.299 + px[p + 1] * 0.587 + px[p + 2] * 0.114;
		px[p] = gris;
		px[p + 1] = gris;
		px[p + 2] = gris;
	}

	// Si no se recortó casi nada, el mockup no tenía fondo plano y el teñido
	// pintaría toda la imagen. Mejor dejarlo como está.
	if (recortados < total * 0.05) return null;

	ctx.putImageData(datos, 0, 0);
	return c;
}

/**
 * Pinta la prenda recortada sobre un color plano. El `multiply` deja pasar el
 * sombreado del gris, y el `destination-in` vuelve a recortar la silueta —
 * sin él, el color plano llenaría también lo que estaba transparente.
 */
export function tenirPrenda(
	prenda: HTMLCanvasElement,
	hex: string,
): HTMLCanvasElement {
	const c = lienzo(prenda.width, prenda.height);
	const ctx = c.getContext("2d");
	if (!ctx) return prenda;

	ctx.fillStyle = hex;
	ctx.fillRect(0, 0, c.width, c.height);

	ctx.globalCompositeOperation = "multiply";
	ctx.drawImage(prenda, 0, 0);

	ctx.globalCompositeOperation = "destination-in";
	ctx.drawImage(prenda, 0, 0);

	ctx.globalCompositeOperation = "source-over";
	return c;
}
