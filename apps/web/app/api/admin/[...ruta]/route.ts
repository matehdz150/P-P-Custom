/**
 * Puente entre el admin del navegador y la Lambda de admin.
 *
 * Existe por una razón concreta: la llave del admin NO puede viajar al
 * navegador. Cualquier variable `NEXT_PUBLIC_*` queda incrustada en el
 * bundle y se lee abriendo las herramientas de desarrollo, así que meterla
 * ahí dejaría la autenticación de adorno. Aquí el servidor la guarda y la
 * agrega al reenviar.
 *
 * ⚠️ MIENTRAS NO HAYA LOGIN, ESTE PROXY ES UNA PUERTA ABIERTA.
 * Reenvía cualquier petición con la llave puesta, así que quien alcance
 * este servidor alcanza la API de admin. Sirve para trabajar en local; NO
 * debe desplegarse público sin una sesión de por medio. Cuando el sitio
 * pase a estático esto deja de existir y el admin necesita autenticación
 * de verdad (Cognito o equivalente): una página estática no puede guardar
 * un secreto.
 */

const API = process.env.KUSTTO_ADMIN_API;
const CLAVE = process.env.KUSTTO_CLAVE_ADMIN;

async function reenviar(req: Request, ruta: string[]) {
	if (!API || !CLAVE) {
		return Response.json(
			{
				message:
					"Falta KUSTTO_ADMIN_API o KUSTTO_CLAVE_ADMIN en el entorno del servidor.",
			},
			{ status: 500 },
		);
	}

	const url = new URL(req.url);
	const destino = `${API}/${ruta.join("/")}${url.search}`;

	const cuerpo =
		req.method === "GET" || req.method === "DELETE"
			? undefined
			: await req.text();

	const res = await fetch(destino, {
		method: req.method,
		headers: {
			"content-type": "application/json",
			"x-clave-admin": CLAVE,
		},
		body: cuerpo,
		cache: "no-store",
	});

	// Se devuelve tal cual para no perder los códigos que la Lambda usa con
	// intención: 409 en duplicados, 404 en inexistentes, 400 en validación.
	return new Response(await res.text(), {
		status: res.status,
		headers: { "content-type": "application/json; charset=utf-8" },
	});
}

type Contexto = { params: Promise<{ ruta: string[] }> };

export async function GET(req: Request, ctx: Contexto) {
	return reenviar(req, (await ctx.params).ruta);
}

export async function POST(req: Request, ctx: Contexto) {
	return reenviar(req, (await ctx.params).ruta);
}

export async function PATCH(req: Request, ctx: Contexto) {
	return reenviar(req, (await ctx.params).ruta);
}

export async function DELETE(req: Request, ctx: Contexto) {
	return reenviar(req, (await ctx.params).ruta);
}
