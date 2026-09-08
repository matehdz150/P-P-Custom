"use client";

import {
	analizarInput,
	type ClaseImagen,
	clasificar,
	confianzaFinal,
	evaluarSvg,
	generarCandidatos,
	NODOS_MAXIMOS_ADAPTATIVO,
	preparar,
	validarSvg,
} from "./adaptativo";

/** Resultado que entra a Fabric y que, por tanto, coincide con lo fabricable. */
export type Vectorizado = {
	svg: string;
	nodos: number;
	paths: number;
	perfil: ClaseImagen;
	confianza: number;
	sugerirMejorOriginal: boolean;
};

export type Perfil = ClaseImagen;
export const NODOS_MAXIMOS = NODOS_MAXIMOS_ADAPTATIVO;

export class ErrorDeVectorizado extends Error {
	readonly clase: "complejo" | "vacio" | "roto";

	constructor(clase: "complejo" | "vacio" | "roto", mensaje: string) {
		super(mensaje);
		this.clase = clase;
	}
}

type Motor = {
	init: (opciones: { module_or_path: string }) => Promise<unknown>;
	to_svg: (
		pixeles: Uint8Array,
		ancho: number,
		alto: number,
		config: unknown,
	) => string;
};

declare global {
	interface Window {
		__vtracer?: Motor;
	}
}

let motor: Promise<Motor | null> | null = null;

/** Carga una sola vez el mismo WASM servido junto al export estático. */
function cargarMotor() {
	motor ??= new Promise<Motor | null>((listo) => {
		const script = document.createElement("script");
		script.type = "module";
		script.src = "/vendor/vtracer/arranque.js";
		script.onload = async () => {
			for (let i = 0; i < 200; i++) {
				if (window.__vtracer) {
					try {
						await window.__vtracer.init({
							module_or_path: "/vendor/vtracer/vtracer.wasm",
						});
						return listo(window.__vtracer);
					} catch {
						return listo(null);
					}
				}
				await new Promise((sigue) => setTimeout(sigue, 25));
			}
			listo(null);
		};
		script.onerror = () => listo(null);
		document.head.appendChild(script);
	});
	return motor;
}

type ResultadoCandidato = {
	svg: string;
	nombre: string;
	nodos: number;
	paths: number;
	score: number;
	valido: boolean;
	errores: string[];
};

/**
 * Vectoriza adaptándose al contenido, sin un preset universal.
 *
 * Analiza el RGBA intacto, genera tres candidatos, vuelve a rasterizarlos y
 * elige el que conserva mejor foreground, bordes, huecos y componentes sin
 * disparar nodos ni paths.
 */
export async function vectorizar(
	imagen: HTMLImageElement,
): Promise<Vectorizado> {
	if (!(imagen.naturalWidth > 0 && imagen.naturalHeight > 0)) {
		throw new ErrorDeVectorizado("roto", "No pudimos leer la imagen.");
	}

	const vtracer = await cargarMotor();
	if (!vtracer) {
		throw new ErrorDeVectorizado(
			"roto",
			"No pudimos preparar el convertidor. Revisa tu conexión y vuelve a intentarlo.",
		);
	}

	let analisis: ReturnType<typeof analizarInput>;
	let clasificacion: ReturnType<typeof clasificar>;
	let preparado: ReturnType<typeof preparar>;
	try {
		analisis = analizarInput(imagen);
		clasificacion = clasificar(analisis);
		preparado = preparar(imagen, clasificacion.clase, analisis);
	} catch {
		throw new ErrorDeVectorizado("roto", "No pudimos leer la imagen.");
	}

	const candidatos = generarCandidatos(preparado, clasificacion.clase);
	const resultados: ResultadoCandidato[] = [];
	for (const candidato of candidatos) {
		try {
			const directo = vtracer.to_svg(
				candidato.pixeles,
				preparado.ancho,
				preparado.alto,
				candidato.config,
			);
			const svg = candidato.transformar
				? candidato.transformar(directo)
				: directo;
			const validacion = validarSvg(svg, preparado.ancho, preparado.alto);
			const evaluacion = await evaluarSvg(
				svg,
				preparado.referencia,
				preparado.ancho,
				preparado.alto,
				validacion,
			);
			resultados.push({
				svg,
				nombre: candidato.nombre,
				nodos: validacion.nodos,
				paths: validacion.paths,
				score: evaluacion.score,
				valido: validacion.valida,
				errores: validacion.errores,
			});
		} catch {
			resultados.push({
				svg: "",
				nombre: candidato.nombre,
				nodos: 0,
				paths: 0,
				score: 0,
				valido: false,
				errores: ["motor"],
			});
		}
	}

	resultados.sort((a, b) => b.score - a.score);
	const mejor = resultados.find((resultado) => resultado.valido);
	if (!mejor) {
		const complejo = resultados.some((resultado) =>
			resultado.errores.includes("complejidad"),
		);
		const vacio = resultados.every((resultado) =>
			resultado.errores.includes("sin-geometria"),
		);
		if (complejo) {
			throw new ErrorDeVectorizado(
				"complejo",
				"Esta imagen tiene demasiado detalle para un grabado limpio. Prueba con un diseño más simple.",
			);
		}
		if (vacio) {
			throw new ErrorDeVectorizado(
				"vacio",
				"No encontramos formas que grabar en esa imagen.",
			);
		}
		throw new ErrorDeVectorizado("roto", "No pudimos convertir esa imagen.");
	}

	const segundo = resultados.find(
		(resultado) => resultado !== mejor && resultado.valido,
	);
	return {
		svg: mejor.svg,
		nodos: mejor.nodos,
		paths: mejor.paths,
		perfil: clasificacion.clase,
		confianza: confianzaFinal(
			mejor.score,
			segundo?.score ?? 0,
			clasificacion.confianza,
		),
		sugerirMejorOriginal:
			clasificacion.clase !== "fotografia" && preparado.escala > 2,
	};
}
