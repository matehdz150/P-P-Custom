/**
 * Lo mínimo para hablar HTTP desde una Lambda detrás de API Gateway.
 *
 * Sin framework a propósito: son cuatro recursos y un router de treinta
 * líneas. Meter Nest aquí costaría uno a tres segundos de arranque en frío
 * a cambio de decoradores que no necesitamos.
 */

export type Peticion = {
	metodo: string;
	ruta: string;
	/** Los segmentos capturados por el patrón de la ruta. */
	params: Record<string, string>;
	query: Record<string, string | undefined>;
	cuerpo: unknown;
	headers: Record<string, string | undefined>;
};

export type Respuesta = {
	statusCode: number;
	headers: Record<string, string>;
	body: string;
};

/** Error con código HTTP, para no tener que devolver objetos a mano. */
export class ErrorHttp extends Error {
	constructor(
		readonly status: number,
		mensaje: string,
	) {
		super(mensaje);
	}
}

export const noEncontrado = (m = "No encontrado") => new ErrorHttp(404, m);
export const malaPeticion = (m: string) => new ErrorHttp(400, m);
export const conflicto = (m: string) => new ErrorHttp(409, m);
export const noAutorizado = (m = "No autorizado") => new ErrorHttp(401, m);

const CORS = {
	"access-control-allow-origin": process.env.KUSTTO_ORIGEN ?? "*",
	"access-control-allow-headers": "content-type,authorization",
	"access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
};

export function json(status: number, dato: unknown): Respuesta {
	return {
		statusCode: status,
		headers: { "content-type": "application/json; charset=utf-8", ...CORS },
		body: JSON.stringify(dato),
	};
}

export function respuestaDeError(error: unknown): Respuesta {
	if (error instanceof ErrorHttp) {
		return json(error.status, { message: error.message });
	}

	// Nada de detalles internos hacia afuera; al log sí, completo.
	console.error("error no manejado:", error);
	return json(500, { message: "Error interno" });
}

/* ─── Router ────────────────────────────────────────────────────────────── */

type Manejador = (p: Peticion) => Promise<unknown>;
type Ruta = { metodo: string; patron: string[]; manejador: Manejador };

export function crearRouter() {
	const rutas: Ruta[] = [];

	const registrar =
		(metodo: string) => (patron: string, manejador: Manejador) => {
			rutas.push({
				metodo,
				patron: patron.split("/").filter(Boolean),
				manejador,
			});
		};

	return {
		get: registrar("GET"),
		post: registrar("POST"),
		patch: registrar("PATCH"),
		delete: registrar("DELETE"),

		async resolver(p: Omit<Peticion, "params">): Promise<Respuesta> {
			const partes = p.ruta.split("/").filter(Boolean);

			for (const ruta of rutas) {
				if (ruta.metodo !== p.metodo) continue;

				// `*` al final captura el resto de la ruta en params.resto.
				const comodin = ruta.patron.at(-1) === "*";
				if (!comodin && ruta.patron.length !== partes.length) continue;
				if (comodin && partes.length < ruta.patron.length - 1) continue;

				const params: Record<string, string> = {};
				let calza = true;

				for (let i = 0; i < ruta.patron.length; i++) {
					const esperado = ruta.patron[i];
					if (esperado === "*") {
						params.resto = partes.slice(i).join("/");
						break;
					}
					if (esperado.startsWith(":")) {
						params[esperado.slice(1)] = decodeURIComponent(partes[i]);
						continue;
					}
					if (esperado !== partes[i]) {
						calza = false;
						break;
					}
				}

				if (!calza) continue;

				try {
					const dato = await ruta.manejador({ ...p, params });
					return json(p.metodo === "POST" ? 201 : 200, dato);
				} catch (error) {
					return respuestaDeError(error);
				}
			}

			return json(404, { message: `Sin ruta para ${p.metodo} ${p.ruta}` });
		},
	};
}
