/**
 * Las dos mitades del carrito que hablan con AWS.
 *
 * 1. Subir el arte al agregar (público, sin sesión).
 * 2. Guardar la lista en la cuenta (sólo con sesión).
 *
 * Son cosas distintas a propósito: el arte se sube SIEMPRE —también sin
 * cuenta— porque si no, no cabría en el navegador. La lista sólo viaja a la
 * tabla cuando hay con quién asociarla, y eso vive en `cuenta.ts`, que ya
 * tiene el cliente con sesión.
 */

const API = process.env.NEXT_PUBLIC_KUSTTO_API ?? "";

type Archivo = {
	tipo: "arte" | "colocacion" | "prenda" | "diseno";
	lado?: string;
	cuerpo: Blob;
};

type Firma = {
	tipo: string;
	lado: string | null;
	ruta: string;
	uploadUrl: string;
};

/**
 * Sube el arte de un artículo y devuelve dónde quedó.
 *
 * El tamaño se manda y entra en la firma: S3 rechaza la subida si el archivo
 * no pesa exactamente eso, así que el tope no es una promesa nuestra. Por lo
 * mismo hay que mandar el `Content-Type` firmado tal cual.
 *
 * Lo que se sube aquí **caduca a los 30 días** si nadie compra. Al pedir, la
 * API lo copia fuera de ese prefijo.
 */
export async function subirAlCarrito(
	archivos: Archivo[],
): Promise<{ carritoId: string }> {
	const res = await fetch(`${API}/publico/carrito/subidas`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			archivos: archivos.map((a) => ({
				tipo: a.tipo,
				lado: a.lado,
				bytes: a.cuerpo.size,
			})),
		}),
	});

	if (!res.ok) {
		const cuerpo = await res.json().catch(() => null);
		throw new Error(cuerpo?.message ?? "No pudimos preparar la subida");
	}

	const { itemId, subidas } = (await res.json()) as {
		itemId: string;
		subidas: Firma[];
	};

	for (const archivo of archivos) {
		const destino = subidas.find(
			(s) =>
				s.tipo === archivo.tipo && (s.lado ?? undefined) === archivo.lado,
		);

		if (!destino) continue;

		const subida = await fetch(destino.uploadUrl, {
			method: "PUT",
			headers: { "Content-Type": archivo.cuerpo.type },
			body: archivo.cuerpo,
		});

		/* El arte sí bloquea: sin él no se puede producir y el artículo no
		   debería entrar al carrito. La colocación y el diseño son referencias:
		   si fallan, se sigue. */
		if (!subida.ok && archivo.tipo === "arte") {
			throw new Error("No pudimos subir tu diseño. Inténtalo otra vez.");
		}
	}

	return { carritoId: itemId };
}
