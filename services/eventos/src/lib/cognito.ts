import { createPublicKey, createVerify } from "node:crypto";

/**
 * Validar el token de Cognito a mano.
 *
 * POR QUÉ AQUÍ Y NO EN LA PLATAFORMA. La API HTTP tiene autorizador JWT de
 * fábrica; las APIs WebSocket no: sólo admiten autorizador Lambda, y sólo en
 * `$connect`. Así que la verificación la hacemos nosotros.
 *
 * POR QUÉ EL TOKEN VIENE EN LA QUERY STRING. La API de WebSocket del navegador
 * no deja poner cabeceras —`new WebSocket(url)` y nada más—, así que no hay
 * `Authorization` que valga. Es la forma estándar de resolverlo y tiene un
 * costo que conviene tener presente: la URL con el token puede acabar en los
 * registros de acceso. Se compensa con lo que ya hace Cognito: son tokens de
 * una hora, y aquí sólo abren una conexión de lectura de los pedidos propios.
 *
 * SIN LIBRERÍAS. `crypto` de Node sabe importar una JWK desde la v16 y
 * verificar RS256. Meter `jsonwebtoken` y `jwks-rsa` en una Lambda son cientos
 * de kilobytes y dos dependencias más que auditar para hacer justo esto.
 */

const REGION = process.env.AWS_REGION ?? "us-east-1";
const POOL = process.env.KUSTTO_POOL_ID ?? "";
const CLIENTE = process.env.KUSTTO_POOL_CLIENTE ?? "";

const EMISOR = `https://cognito-idp.${REGION}.amazonaws.com/${POOL}`;

type JWK = { kid: string; kty: string; n: string; e: string; alg?: string };

/**
 * Las llaves públicas del pool, cacheadas mientras viva el contenedor.
 *
 * Cognito las rota muy de vez en cuando y publica las nuevas antes de usarlas,
 * así que un contenedor caliente no tiene por qué volver a pedirlas. Si llega
 * un `kid` desconocido se vuelven a bajar una vez, que es el caso de la
 * rotación.
 */
let llaves: Map<string, JWK> | null = null;

async function traerLlaves(): Promise<Map<string, JWK>> {
	const res = await fetch(`${EMISOR}/.well-known/jwks.json`);
	if (!res.ok) throw new Error(`No pudimos leer las llaves (${res.status})`);

	const cuerpo = (await res.json()) as { keys: JWK[] };
	return new Map(cuerpo.keys.map((k) => [k.kid, k]));
}

async function llavePara(kid: string): Promise<JWK> {
	if (!llaves) llaves = await traerLlaves();

	let llave = llaves.get(kid);
	if (!llave) {
		// Puede ser una rotación: se pregunta una vez más antes de rendirse.
		llaves = await traerLlaves();
		llave = llaves.get(kid);
	}

	if (!llave)
		throw new Error("El token viene firmado con una llave que no es del pool");
	return llave;
}

function deBase64Url(texto: string): Buffer {
	return Buffer.from(texto.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

/**
 * Devuelve el `sub` —que en este proyecto ES el id del proveedor— o lanza.
 *
 * Se comprueba todo lo que importa: la firma, que sea de nuestro pool, que sea
 * para nuestro cliente, que no haya caducado y que sea un token de
 * identidad. Saltarse cualquiera de esas convierte la comprobación en teatro.
 */
export async function proveedorDelToken(token: string): Promise<string> {
	const partes = token.split(".");
	if (partes.length !== 3) throw new Error("El token no tiene forma de JWT");

	const [cabeceraB64, cuerpoB64, firmaB64] = partes;

	const cabecera = JSON.parse(deBase64Url(cabeceraB64).toString("utf8"));
	if (cabecera.alg !== "RS256")
		throw new Error("Algoritmo de firma inesperado");

	const jwk = await llavePara(cabecera.kid);

	const verificador = createVerify("RSA-SHA256");
	verificador.update(`${cabeceraB64}.${cuerpoB64}`);

	const valida = verificador.verify(
		createPublicKey({ key: jwk as never, format: "jwk" }),
		deBase64Url(firmaB64),
	);

	if (!valida) throw new Error("La firma del token no cuadra");

	const cuerpo = JSON.parse(deBase64Url(cuerpoB64).toString("utf8"));

	if (cuerpo.iss !== EMISOR) throw new Error("El token no es de nuestro pool");
	if (cuerpo.token_use !== "id")
		throw new Error("Hace falta el token de identidad");
	if (CLIENTE && cuerpo.aud !== CLIENTE) {
		throw new Error("El token no es para esta aplicación");
	}

	// En segundos, como manda el estándar.
	if (typeof cuerpo.exp !== "number" || cuerpo.exp * 1000 <= Date.now()) {
		throw new Error("El token ya caducó");
	}

	if (!cuerpo.sub) throw new Error("El token no dice de quién es");

	return String(cuerpo.sub);
}
