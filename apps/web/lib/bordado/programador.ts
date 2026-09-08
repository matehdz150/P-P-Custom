/**
 * Cuándo se prepara el bordado, ahora que no lo pide nadie.
 *
 * Al quitar el panel, la preparación dejó de ser una respuesta a un clic y pasó
 * a dispararse sola. Eso mueve el problema: ya no hay que decidir qué enseñar,
 * hay que decidir CUÁNTAS VECES correr el motor sin que lo pida nadie.
 *
 * Vive fuera del componente porque es lo único de este cambio que cuesta
 * dinero, y dentro de un `useEffect` no se puede probar: haría falta montar
 * React, Fabric y el lienzo para comprobar una resta de milisegundos.
 */

export type Programador = {
	/** Reinicia la espera. Sin contenido no programa nada. */
	programar(hayContenido: boolean): void;
	/** Cuenta un diseño mandado al motor. Es lo que aprieta el freno. */
	contar(): void;
	cancelar(): void;
};

export type OpcionesDeProgramador = {
	espera: number;
	esperaLarga: number;
	antesDeFrenar: number;
};

export function crearProgramador(
	ejecutar: () => void,
	opciones: OpcionesDeProgramador,
	/* Inyectables para poder probar con esperas de milisegundos en vez de
	   segundos; en el navegador son los de `window`. */
	poner: (fn: () => void, ms: number) => number = (fn, ms) =>
		setTimeout(fn, ms) as unknown as number,
	quitar: (id: number) => void = (id) => clearTimeout(id),
): Programador {
	let temporizador: number | null = null;
	let trabajos = 0;

	const cancelar = () => {
		if (temporizador !== null) quitar(temporizador);
		temporizador = null;
	};

	return {
		programar(hayContenido) {
			/* Se cancela SIEMPRE, incluso si no hay contenido. Si alguien borra lo
			   último que quedaba, lo que estuviera programado ya no vale: prepararlo
			   daría el error de «agrega texto o un logo» sin que haya tocado nada
			   desde entonces. */
			cancelar();
			if (!hayContenido) return;

			/* El freno no corta, alarga. Sin panel no hay botón que pulsar, así que
			   dejar de preparar dejaría a quien iteró mucho sin poder comprar y sin
			   nada que hacer. Esperar más sigue llegando al final. */
			const espera =
				trabajos >= opciones.antesDeFrenar
					? opciones.esperaLarga
					: opciones.espera;

			temporizador = poner(() => {
				temporizador = null;
				ejecutar();
			}, espera);
		},
		contar() {
			trabajos++;
		},
		cancelar,
	};
}
