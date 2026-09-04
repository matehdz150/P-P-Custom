/**
 * Cliente de la API de admin (la Lambda en AWS).
 *
 * VA DIRECTO A API GATEWAY, con el token del pool de admins en la cabecera.
 * Antes pasaba por `/api/admin/*`, un route handler de Next que agregaba una
 * llave compartida del lado del servidor. Eso se quitó al publicar el
 * backoffice: el sitio se exporta estático, no hay servidor donde guardar un
 * secreto, y una llave permanente que abre toda la API no puede viajar al
 * navegador.
 *
 * TODAS LAS RUTAS CUELGAN DE `/admin/`. El prefijo lo exige la API Gateway,
 * que ahí valida el token; fuera de él la Lambda sólo atiende `/publico/*`.
 * Se pone aquí, en un sitio, y no en cada llamada.
 */
import { borrarSesion, tokenVigente } from "@/lib/auth/admin";

const API = process.env.NEXT_PUBLIC_KUSTTO_API ?? "";

export class ErrorAdmin extends Error {
	constructor(
		readonly status: number,
		mensaje: string,
	) {
		super(mensaje);
		this.name = "ErrorAdmin";
	}

	/** La sesión caducó o no existe. La pantalla manda a entrar otra vez. */
	get hayQueEntrar() {
		return this.status === 401;
	}
}

export async function adminFetch<T>(
	ruta: string,
	opciones?: RequestInit,
): Promise<T> {
	const token = await tokenVigente();

	// Sin token no se llama: el 401 llegaría igual, pero después de un viaje a
	// AWS y con el mismo final. Así la pantalla reacciona de inmediato.
	if (!token) {
		throw new ErrorAdmin(401, "Tu sesión caducó. Vuelve a entrar.");
	}

	const res = await fetch(`${API}/admin${ruta}`, {
		...opciones,
		headers: {
			"content-type": "application/json",
			authorization: `Bearer ${token}`,
			...opciones?.headers,
		},
	});

	if (!res.ok) {
		/* Un 401 del gateway significa que el token ya no vale: se tira la
		   sesión aquí mismo. Dejarla puesta haría que cada pantalla siguiente
		   volviera a fallar igual, y la persona vería cuatro errores en vez de
		   una pantalla de entrar. */
		if (res.status === 401) borrarSesion();

		// La Lambda contesta { message }: se respeta para que el admin pueda
		// enseñar "Ya existe una plantilla con id tshirt" y no un genérico.
		const cuerpo = await res.json().catch(() => null);
		throw new ErrorAdmin(
			res.status,
			cuerpo?.message ?? `La API respondió ${res.status}`,
		);
	}

	return res.json();
}
