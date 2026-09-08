"use client";

/**
 * Cuánto tarda cada etapa de la preparación.
 *
 * ESTO NO ES TELEMETRÍA DE ADORNO. Todo el pipeline corre en el hilo principal
 * del navegador del comprador, así que un total de dos segundos no es "un poco
 * lento": son dos segundos con la página congelada, sin scroll y sin poder
 * cancelar. Saber QUÉ etapa se los come es lo único que permite decidir si hace
 * falta un worker o basta con acotar un bucle — y ya pasó una vez que el
 * adelgazamiento recorría la rejilla entera por componente y el banco se
 * quedaba clavado diez minutos.
 *
 * Es opcional en todas las firmas: si no se pasa cronómetro, no se mide y no
 * cuesta nada.
 */

export type Cronometro = {
	/** Suma milisegundos a una etapa; se puede llamar varias veces. */
	sumar(etapa: string, ms: number): void;
	/** Ejecuta y contabiliza. Devuelve lo que devuelva la función. */
	medir<T>(etapa: string, fn: () => T): T;
	etapas: Record<string, number>;
};

const ahora = () =>
	typeof performance !== "undefined" ? performance.now() : Date.now();

export function crearCronometro(): Cronometro {
	const etapas: Record<string, number> = {};
	return {
		etapas,
		sumar(etapa, ms) {
			etapas[etapa] = (etapas[etapa] ?? 0) + ms;
		},
		medir(etapa, fn) {
			const desde = ahora();
			const salida = fn();
			etapas[etapa] = (etapas[etapa] ?? 0) + (ahora() - desde);
			return salida;
		},
	};
}
