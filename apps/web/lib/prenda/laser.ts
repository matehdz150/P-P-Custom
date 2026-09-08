/**
 * El grabado láser: cómo se ve un trazo quemado.
 *
 * ES LA ÚNICA FUENTE DEL PLATEADO. La previsualización tiñe píxeles y el
 * editor pinta un degradado de fabric —dos técnicas distintas— pero las dos
 * salen de la misma rampa y el mismo tono de aquí. Duplicar los números daría
 * un metal en el editor y otro al pulsar "Probar".
 *
 * UN LÁSER NO IMPRIME COLOR: quema. Lo que queda es el material de debajo al
 * descubierto —en la chapa y el metalizado, plateado— con el mismo tono en
 * todo el trazo, venga el diseño en rojo, en azul o a cuatro tintas. Enseñar
 * el arte con sus colores prometía algo que la máquina no hace.
 *
 * SÓLO AFECTA A LO QUE SE VE. El archivo que va al taller sale por
 * `exportarParaPedido` y no pasa por aquí: para un lado de láser es un vector
 * de trazos, y el color nunca formó parte de él.
 *
 * QUÉ SE CONSERVA. La forma, y sólo la forma: se toma la cobertura de cada
 * píxel —su alfa— y se pinta en plateado. Un degradado de rojo a azul queda
 * como una mancha plateada uniforme, que es exactamente lo que saldría de la
 * máquina.
 */

/**
 * El plateado base. Lleva algo más de azul que de rojo a propósito: un metal
 * pulido refleja el cielo, y un gris exactamente neutro se lee como plástico.
 */
export const PLATA = { r: 0xb6, g: 0xbb, b: 0xc4 };

/**
 * El barrido especular, que es lo que hace que parezca METAL y no gris.
 *
 * Un gris plano no se lee como metal por muy claro que sea: lo que distingue a
 * una superficie pulida es que devuelve la luz DESIGUAL —una banda brillante
 * donde refleja la fuente y zonas apagadas donde refleja el entorno—. Sin esto
 * el grabado parecía cartulina gris.
 *
 * Son paradas de una rampa a lo largo de una diagonal, en fracción del ancho
 * recorrido y factor sobre la plata base. Pasa de 1 —hasta casi blanco en el
 * filo del brillo— porque un reflejo especular satura; el clamp lo corta.
 */
const BRILLO: [number, number][] = [
	[0.0, 0.62],
	[0.18, 0.86],
	[0.3, 1.5],
	[0.4, 1.0],
	[0.56, 0.68],
	[0.74, 1.32],
	[0.86, 0.92],
	[1.0, 0.62],
];

/**
 * Cuántas veces se repite el barrido a lo largo del arte.
 *
 * NO UNA SOLA. Con una, el reflejo se estira por todo el diseño y en un
 * estampado grande visto de cerca —el de un termo ocupa 28 cm— sólo se ve un
 * trozo del degradado: sale un gris casi uniforme y vuelve a parecer plástico.
 * Repitiéndolo, cualquier recorte enseña brillos y sombras, que es lo que pasa
 * al mover un objeto metálico bajo una luz.
 */
const CICLOS = 3;

/** Interpola la rampa en `t` (0 a 1), sin repetirla. */
function interpolarBrillo(t: number) {
	for (let i = 1; i < BRILLO.length; i++) {
		const [t1, f1] = BRILLO[i];
		if (t <= t1) {
			const [t0, f0] = BRILLO[i - 1];
			const k = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
			return f0 + (f1 - f0) * k;
		}
	}
	return BRILLO[BRILLO.length - 1][1];
}

/** La rampa repetida `CICLOS` veces a lo largo del arte, para el teñido. */
function factorDeBrillo(bruto: number) {
	return interpolarBrillo((((bruto * CICLOS) % 1) + 1) % 1);
}

/**
 * Inclinación del barrido, en radianes desde la horizontal.
 *
 * Diagonal y no vertical: en horizontal las letras de un logo quedarían todas
 * con el mismo brillo y el efecto se perdería.
 */
const INCLINACION = -0.42;

/**
 * Cuánto se oscurece la plata donde el diseño era oscuro.
 *
 * Cero daría una silueta plana, y un grabado real no lo es: el fondo del surco
 * devuelve menos luz que sus bordes. Se usa la luminancia del arte sólo como
 * relieve —no como color—, y MUY flojo: estuvo en 0.22 y las tintas salían
 * entre 159 y 197, un abanico de grises que volvía a sugerir que el láser
 * distingue tonos. Que es justo lo que no hace.
 */
const RELIEVE = 0.1;

/**
 * Devuelve el mismo arte con todo el trazo en plateado.
 *
 * Es asíncrono porque hay que decodificar el PNG para tocar sus píxeles. Ante
 * cualquier fallo —imagen que no carga, lienzo sin contexto, memoria— devuelve
 * el original: es una previsualización, y verla con sus colores es mucho mejor
 * que no verla.
 */
export function platearArte(dataUrl: string): Promise<string> {
	return new Promise((resolver) => {
		const imagen = new Image();
		imagen.onload = () => {
			try {
				const lienzo = document.createElement("canvas");
				lienzo.width = imagen.naturalWidth;
				lienzo.height = imagen.naturalHeight;
				const ctx = lienzo.getContext("2d", { willReadFrequently: true });
				if (!ctx) return resolver(dataUrl);
				ctx.drawImage(imagen, 0, 0);
				const datos = ctx.getImageData(0, 0, lienzo.width, lienzo.height);
				const p = datos.data;
				const an = lienzo.width;
				const al = lienzo.height;
				/* El barrido se proyecta sobre la diagonal y se normaliza al tamaño
				   del arte, para que un logo ancho y uno alto reciban el mismo
				   reflejo y no dependa de los píxeles que tenga. */
				const dx = Math.cos(INCLINACION);
				const dy = Math.sin(INCLINACION);
				const span = Math.abs(an * dx) + Math.abs(al * dy) || 1;
				const base = Math.min(0, an * dx) + Math.min(0, al * dy);
				const tope = (v: number) => (v > 255 ? 255 : v);
				for (let y = 0; y < al; y++) {
					for (let x = 0; x < an; x++) {
						const i = (y * an + x) * 4;
						// Fuera del trazo no hay nada que teñir.
						if (p[i + 3] === 0) continue;
						/* Luminancia perceptual, no la media de los tres canales: con
						   la media, un amarillo y un azul del mismo "valor" darían el
						   mismo gris y el relieve se inventaría diferencias que no se
						   ven. */
						const l =
							(0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2]) / 255;
						const f =
							(1 - RELIEVE * (1 - l)) *
							factorDeBrillo((x * dx + y * dy - base) / span);
						p[i] = tope(PLATA.r * f);
						p[i + 1] = tope(PLATA.g * f);
						p[i + 2] = tope(PLATA.b * f);
					}
				}
				ctx.putImageData(datos, 0, 0);
				resolver(lienzo.toDataURL("image/png"));
			} catch {
				resolver(dataUrl);
			}
		};
		imagen.onerror = () => resolver(dataUrl);
		imagen.src = dataUrl;
	});
}

/** Si ese lado se graba con láser. */
export function esLaser(tecnica: string | undefined) {
	return tecnica === "laser";
}
