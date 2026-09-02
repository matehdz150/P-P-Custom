/**
 * Cliente de la API de admin (la Lambda en AWS).
 *
 * No pega directo contra API Gateway: pasa por `/api/admin/*`, el puente de
 * Next que agrega la llave del lado del servidor. Por eso aquí no hay
 * ningún secreto ni hace falta configurar nada en el navegador.
 */
export class ErrorAdmin extends Error {
	constructor(
		readonly status: number,
		mensaje: string,
	) {
		super(mensaje);
		this.name = "ErrorAdmin";
	}
}

export async function adminFetch<T>(
	ruta: string,
	opciones?: RequestInit,
): Promise<T> {
	const res = await fetch(`/api/admin${ruta}`, {
		headers: { "content-type": "application/json" },
		...opciones,
	});

	if (!res.ok) {
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
