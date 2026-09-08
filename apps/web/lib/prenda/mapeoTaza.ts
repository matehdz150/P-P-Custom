/** El raster incluye TODO el área editable y sus márgenes, no sólo la tinta.
 * Como componerCilindro, u=0..1 representa una vuelta completa, sin «contain».
 * Con foto calibrada manda su proyección; sin ella, la proporción del raster.
 * La foto no describe el contorno total ni el asa: éstos siguen siendo genéricos. */
export type ReferenciaCilindrica = {
	anchoFoto: number;
	altoFoto: number;
	banda: {
		izquierda: number;
		derecha: number;
		arriba: number;
		abajo: number;
		bombeo: number;
	};
};

export function mapeoTaza({
	proporcion,
	centro = 0.5,
	referencia,
}: {
	proporcion: number;
	centro?: number;
	referencia?: ReferenciaCilindrica;
}) {
	const radio = 0.041;
	const ratio =
		Number.isFinite(proporcion) && proporcion > 0 ? proporcion : 21 / 8;
	let altoBanda = (2 * Math.PI * radio) / ratio;
	let elevacion = Math.atan2(0.065, 0.29);
	let calibrado = false;
	if (referencia) {
		const { banda, anchoFoto, altoFoto } = referencia;
		const ancho = (banda.derecha - banda.izquierda) * anchoFoto;
		const alto = (banda.abajo - banda.arriba) * altoFoto;
		const seno = (2 * banda.bombeo * alto) / ancho;
		// La proyección fotográfica usa x=r·sin(θ), y=v·alto+bombeo·cos(θ).
		// Con cámara ortográfica: bombeo=r·sin(elevación) y alto=H·cos(elevación).
		// No inventar una calibración para bandas degeneradas o imposibles.
		if (
			Number.isFinite(ancho + alto + seno) &&
			ancho > 0 &&
			alto > 0 &&
			Math.abs(seno) < 0.95
		) {
			elevacion = Math.asin(seno);
			altoBanda = (2 * radio * alto) / (ancho * Math.cos(elevacion));
			calibrado = true;
		}
	}
	const frente = Number.isFinite(centro) ? ((centro % 1) + 1) % 1 : 0.5;
	return {
		radio,
		altoBanda,
		elevacion,
		calibrado,
		escalaVertical: altoBanda / 0.077,
		// CylinderGeometry: x=r·sin(2πu), z=r·cos(2πu).
		// Así u=centro queda en +Z y u>centro queda a la derecha de cámara.
		giro: -2 * Math.PI * frente,
	};
}
