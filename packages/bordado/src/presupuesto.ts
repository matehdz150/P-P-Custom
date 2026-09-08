import type { EmbroideryIssue } from "./types";

/**
 * Rendirse a tiempo cuando preparar un diseño cuesta demasiado.
 *
 * POR QUÉ NO BASTA UN RELOJ. La preparación es un bucle síncrono; mientras
 * corre, el navegador no ejecuta nada más, ni siquiera el temporizador que
 * comprobaría si hay que parar. Un `setTimeout` no puede interrumpir esto y en
 * un Worker tampoco: lo único que funciona es que el propio algoritmo cuente lo
 * que lleva hecho y se rinda solo. Por eso los límites son de OPERACIONES y no
 * de milisegundos.
 *
 * NO ES LO MISMO QUE NO SER BORDABLE, y mezclarlos sería mentirle al comprador.
 * Una foto posterizada se puede bordar —mal, pero se puede—; lo que no se puede
 * es prepararla automáticamente en el navegador de alguien en un tiempo
 * razonable. Un diseño que se pasa de presupuesto va a revisión humana, no a la
 * basura, y por eso lleva su propio código.
 */

export const COMPLEJIDAD_EXCEDIDA = "COMPLEJIDAD_AUTOMATICA_EXCEDIDA";
export const NO_BORDABLE = "DISENO_NO_BORDABLE";

/** Qué recurso se agotó. Va al metadata, nunca a la pantalla del comprador. */
export type RecursoAgotado =
	| "pixelesPrimerPlano"
	| "componentes"
	| "pixelesEsqueleto"
	| "ramas"
	| "comparacionesFusion";

export class PresupuestoExcedido extends Error {
	readonly recurso: RecursoAgotado;
	readonly medido: number;
	readonly tope: number;

	constructor(recurso: RecursoAgotado, medido: number, tope: number) {
		super(`presupuesto agotado en ${recurso}: ${medido} > ${tope}`);
		this.name = "PresupuestoExcedido";
		this.recurso = recurso;
		this.medido = medido;
		this.tope = tope;
	}
}

export function esPresupuestoExcedido(
	error: unknown,
): error is PresupuestoExcedido {
	return error instanceof PresupuestoExcedido;
}

/** Lanza si el valor se pasa del tope. Se llama en los sitios baratos. */
export function exigir(recurso: RecursoAgotado, medido: number, tope: number) {
	if (medido > tope) throw new PresupuestoExcedido(recurso, medido, tope);
}

/**
 * Lo que se le enseña al comprador cuando se agota el presupuesto.
 *
 * Ni esqueleto, ni ramas, ni CPU, ni umbrales: eso va al metadata para que
 * alguien del taller pueda mirarlo. Aquí sólo qué hacer al respecto.
 */
export function incidenciaDeComplejidad(): EmbroideryIssue {
	return {
		code: COMPLEJIDAD_EXCEDIDA,
		message:
			"Este diseño es demasiado complejo para prepararlo automáticamente. Prueba simplificando algunos detalles o usando una imagen más sencilla.",
		severity: "review",
	};
}
