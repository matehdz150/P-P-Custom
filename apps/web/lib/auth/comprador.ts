/**
 * La sesión del comprador. Contra OTRO pool que el del taller.
 *
 * SON DOS CAMINOS Y SE VEN DISTINTOS DESDE AQUÍ:
 *
 *   Google va por redirección con PKCE (`entrar`). No hay forma de evitarlo:
 *   su pantalla de consentimiento vive en accounts.google.com. Lo que sí se
 *   evita es la interfaz alojada de Cognito en medio, pasando
 *   `identity_provider=Google` — es genérica y nadie debería verla.
 *
 *   El correo va por la API JSON de Cognito (`entrarConCorreo`, `registrar`),
 *   desde nuestra propia pantalla en /cuenta/entrar. Es el mismo trato que el
 *   login del taller: la contraseña pasa por nuestro JavaScript camino a
 *   Cognito, y a cambio la primera impresión de la tienda es nuestra.
 *
 * DÓNDE VIVEN LOS TOKENS. Igual que el del taller: en localStorage, con el
 * mismo trato explícito. La cookie httpOnly la tiene que poner un servidor, y
 * el front va a ser estático en S3 + CloudFront. Se acota con tokens de una
 * hora. Cuando CloudFront esté delante de los dos orígenes, esto se cambia por
 * cookie y el archivo se encoge.
 *
 * POR QUÉ PKCE. El cliente es público —no tiene secreto, porque un secreto en
 * el navegador no es un secreto—, así que un código de autorización robado en
 * el camino de vuelta sería canjeable por cualquiera. Con PKCE el código sólo
 * sirve acompañado del verificador que se quedó en esta pestaña.
 */

const CLIENTE = process.env.NEXT_PUBLIC_COGNITO_COMPRADORES_CLIENTE ?? "";
const DOMINIO = process.env.NEXT_PUBLIC_COGNITO_COMPRADORES_DOMINIO ?? "";

const LLAVE_SESION = "kustto.comprador.sesion";
const LLAVE_VERIFICADOR = "kustto.comprador.pkce";
const LLAVE_ESTADO = "kustto.comprador.estado";
/** A dónde volver después de entrar. Se pierde en el viaje a Cognito si no. */
const LLAVE_DESTINO = "kustto.comprador.destino";

export type SesionComprador = {
	idToken: string;
	accessToken: string;
	refreshToken: string;
	/** Epoch en ms. Se calcula al guardar, no viene de Cognito. */
	expira: number;
};

export type Comprador = {
	/** El `sub` de Cognito. Es el id, igual que con los talleres. */
	id: string;
	email: string;
	nombre: string | null;
	/** Falso sólo si alguien entró por un camino que no verifica el correo. */
	correoVerificado: boolean;
};

export class ErrorEntrada extends Error {
	constructor(
		readonly tipo: string,
		mensaje: string,
	) {
		super(mensaje);
		this.name = "ErrorEntrada";
	}
}

/* ─── Utilidades ──────────────────────────────────────────────────────────── */

function base64url(bytes: Uint8Array) {
	let binario = "";
	for (const b of bytes) binario += String.fromCharCode(b);
	return btoa(binario)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

function aleatorio(bytes = 32) {
	return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

async function reto(verificador: string) {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(verificador),
	);
	return base64url(new Uint8Array(digest));
}

/**
 * Lee lo que dice el id token, SÓLO para pintarlo.
 *
 * Esto no verifica nada: la firma no se comprueba aquí y no puede. Quien
 * decide si un token vale es el autorizador de API Gateway, antes de que
 * corra código nuestro. Si alguien se inventa un token en su navegador, verá
 * su propio nombre en el header y nada más — la API no le contestará.
 */
function cargaDelToken(idToken: string): Record<string, unknown> | null {
	try {
		const carga = idToken.split(".")[1];
		if (!carga) return null;

		const b64 = carga.replace(/-/g, "+").replace(/_/g, "/");
		const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

		// TextDecoder y no atob a secas: el nombre viene en UTF-8 y "José"
		// sale "JosÃ©" si se leen los bytes como latin1.
		return JSON.parse(new TextDecoder().decode(bytes));
	} catch {
		return null;
	}
}

/**
 * La misma URI que se registró en el cliente de Cognito y en Google.
 *
 * Sale de `location.origin` en vez de una variable para que localhost y el
 * dominio real funcionen sin configurar nada. Las dos están dadas de alta; una
 * que no lo esté se rechaza con `redirect_mismatch`.
 */
function volverA() {
	return `${window.location.origin}/cuenta/callback`;
}

/* ─── Entrar ──────────────────────────────────────────────────────────────── */

/**
 * Manda a Cognito. `proveedor: "Google"` salta la pantalla de Cognito y va
 * directo a Google; sin él se enseña la de Cognito con las dos opciones.
 */
export async function entrar(opciones?: {
	proveedor?: "Google";
	destino?: string;
}) {
	if (!CLIENTE || !DOMINIO) {
		throw new ErrorEntrada(
			"Config",
			"Falta NEXT_PUBLIC_COGNITO_COMPRADORES_CLIENTE o _DOMINIO",
		);
	}

	const verificador = aleatorio();
	const estado = aleatorio(16);

	// sessionStorage y no localStorage: son de este intento y de esta pestaña.
	// Si sobrevivieran a la pestaña, un intento viejo podría validar uno nuevo.
	sessionStorage.setItem(LLAVE_VERIFICADOR, verificador);
	sessionStorage.setItem(LLAVE_ESTADO, estado);
	sessionStorage.setItem(
		LLAVE_DESTINO,
		opciones?.destino ?? window.location.pathname + window.location.search,
	);

	const params = new URLSearchParams({
		client_id: CLIENTE,
		response_type: "code",
		scope: "openid email profile",
		redirect_uri: volverA(),
		state: estado,
		code_challenge: await reto(verificador),
		code_challenge_method: "S256",
	});

	if (opciones?.proveedor) params.set("identity_provider", opciones.proveedor);

	window.location.assign(`${DOMINIO}/oauth2/authorize?${params}`);
}

/**
 * Cierra el viaje: cambia el código por los tokens.
 *
 * Devuelve a dónde había que volver, para que la pantalla de callback lleve
 * al comprador donde estaba y no siempre a la portada.
 */
export async function completarEntrada(code: string, estado: string | null) {
	const verificador = sessionStorage.getItem(LLAVE_VERIFICADOR);
	const esperado = sessionStorage.getItem(LLAVE_ESTADO);
	const destino = sessionStorage.getItem(LLAVE_DESTINO) ?? "/";

	sessionStorage.removeItem(LLAVE_VERIFICADOR);
	sessionStorage.removeItem(LLAVE_ESTADO);
	sessionStorage.removeItem(LLAVE_DESTINO);

	if (!verificador) {
		throw new ErrorEntrada(
			"SinVerificador",
			"Este enlace ya se usó o se abrió en otra pestaña. Vuelve a entrar.",
		);
	}

	// El `state` es lo único que impide que alguien te haga llegar a esta
	// pantalla con SU código y te deje dentro de la sesión de otro.
	if (!estado || estado !== esperado) {
		throw new ErrorEntrada("Estado", "La vuelta no coincide con la salida");
	}

	const r = await fetch(`${DOMINIO}/oauth2/token`, {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "authorization_code",
			client_id: CLIENTE,
			code,
			redirect_uri: volverA(),
			code_verifier: verificador,
		}),
	}).catch(() => null);

	if (!r) throw new ErrorEntrada("Red", "No pudimos conectar con el servidor");

	const dato = await r.json().catch(() => ({}));

	if (!r.ok) {
		throw new ErrorEntrada(
			String(dato.error ?? "Desconocido"),
			dato.error_description ?? "Cognito rechazó el código",
		);
	}

	guardar(dato);
	return destino;
}

function guardar(dato: {
	id_token: string;
	access_token: string;
	refresh_token?: string;
	expires_in: number;
}): SesionComprador {
	// Renovar no devuelve refresh token nuevo: se conserva el que había, o la
	// sesión moriría al primer renovado.
	const previa = leerSesion();

	const sesion: SesionComprador = {
		idToken: dato.id_token,
		accessToken: dato.access_token,
		refreshToken: dato.refresh_token ?? previa?.refreshToken ?? "",
		// Medio minuto de colchón: evita mandar un token que caduca en vuelo.
		expira: Date.now() + (dato.expires_in - 30) * 1000,
	};

	localStorage.setItem(LLAVE_SESION, JSON.stringify(sesion));
	return sesion;
}

/* ─── Correo y contraseña, en pantalla nuestra ────────────────────────────── */

/**
 * Cognito habla JSON plano por HTTP: un POST con el header `x-amz-target`.
 * Es lo mismo que hace `lib/auth/cognito.ts` para el taller — el SDK de
 * amplify pesa cientos de kilobytes para exactamente esto.
 */
const REGION = process.env.NEXT_PUBLIC_COGNITO_REGION ?? "us-east-1";
const IDP = `https://cognito-idp.${REGION}.amazonaws.com/`;

async function llamarIdp(accion: string, cuerpo: unknown) {
	let res: Response;
	try {
		res = await fetch(IDP, {
			method: "POST",
			headers: {
				"content-type": "application/x-amz-json-1.1",
				"x-amz-target": `AWSCognitoIdentityProviderService.${accion}`,
			},
			body: JSON.stringify(cuerpo),
		});
	} catch {
		// Sin red no hubo respuesta: no es un problema de credenciales y no se
		// debe presentar como tal.
		throw new ErrorEntrada("Red", "No pudimos conectar con el servidor");
	}

	const dato = await res.json().catch(() => ({}));

	if (!res.ok) {
		// El tipo viene en __type, a veces con prefijo de namespace.
		const tipo = String(dato.__type ?? "Desconocido")
			.split("#")
			.pop() as string;
		throw new ErrorEntrada(
			tipo,
			dato.message ?? `Cognito respondió ${res.status}`,
		);
	}

	return dato;
}

/** El resultado del IDP viene en PascalCase; el del endpoint OAuth en snake. */
function guardarDeIdp(r: {
	IdToken: string;
	AccessToken: string;
	RefreshToken?: string;
	ExpiresIn: number;
}) {
	return guardar({
		id_token: r.IdToken,
		access_token: r.AccessToken,
		refresh_token: r.RefreshToken,
		expires_in: r.ExpiresIn,
	});
}

export async function entrarConCorreo(email: string, password: string) {
	if (!CLIENTE) {
		throw new ErrorEntrada(
			"Config",
			"Falta NEXT_PUBLIC_COGNITO_COMPRADORES_CLIENTE",
		);
	}

	const r = await llamarIdp("InitiateAuth", {
		AuthFlow: "USER_PASSWORD_AUTH",
		ClientId: CLIENTE,
		AuthParameters: { USERNAME: email, PASSWORD: password },
	});

	if (!r.AuthenticationResult) {
		throw new ErrorEntrada(
			r.ChallengeName ?? "Desconocido",
			`Cognito pidió un paso que no sabemos resolver: ${r.ChallengeName}`,
		);
	}

	return guardarDeIdp(r.AuthenticationResult);
}

/**
 * Crea la cuenta. Devuelve si hace falta confirmar con el código del correo.
 *
 * `name` va porque es obligatorio en el pool: sin él Cognito rechaza el alta
 * con `InvalidParameterException`, que parece un fallo de configuración.
 */
export async function registrar(
	nombre: string,
	email: string,
	password: string,
) {
	if (!CLIENTE) {
		throw new ErrorEntrada(
			"Config",
			"Falta NEXT_PUBLIC_COGNITO_COMPRADORES_CLIENTE",
		);
	}

	const r = await llamarIdp("SignUp", {
		ClientId: CLIENTE,
		Username: email,
		Password: password,
		UserAttributes: [
			{ Name: "email", Value: email },
			{ Name: "name", Value: nombre },
		],
	});

	return { confirmado: r.UserConfirmed === true };
}

/** Cierra el alta con el código de seis dígitos que llegó por correo. */
export async function confirmarRegistro(email: string, codigo: string) {
	await llamarIdp("ConfirmSignUp", {
		ClientId: CLIENTE,
		Username: email,
		ConfirmationCode: codigo,
	});
}

export async function reenviarCodigo(email: string) {
	await llamarIdp("ResendConfirmationCode", {
		ClientId: CLIENTE,
		Username: email,
	});
}

/* ─── Leer y salir ────────────────────────────────────────────────────────── */

export function leerSesion(): SesionComprador | null {
	if (typeof window === "undefined") return null;
	try {
		const crudo = localStorage.getItem(LLAVE_SESION);
		return crudo ? (JSON.parse(crudo) as SesionComprador) : null;
	} catch {
		return null;
	}
}

export function leerComprador(): Comprador | null {
	const sesion = leerSesion();
	if (!sesion) return null;

	const carga = cargaDelToken(sesion.idToken);
	if (!carga) return null;

	const email = String(carga.email ?? "");
	if (!email) return null;

	const nombre = carga.name ? String(carga.name) : null;

	return {
		id: String(carga.sub ?? ""),
		email,
		nombre,
		// Cognito lo manda como booleano o como la cadena "true", según venga
		// de Google o de un alta con correo.
		correoVerificado:
			carga.email_verified === true || carga.email_verified === "true",
	};
}

export function borrarSesion() {
	if (typeof window !== "undefined") localStorage.removeItem(LLAVE_SESION);
}

/**
 * Cierra la sesión también del lado de Cognito.
 *
 * Borrar el localStorage a secas dejaría la sesión de la interfaz alojada
 * viva: al volver a "entrar", Cognito te deja pasar sin preguntar nada y
 * parece que el botón de salir no funcionó.
 */
export function salir() {
	borrarSesion();

	if (!DOMINIO || !CLIENTE) {
		window.location.assign("/");
		return;
	}

	const params = new URLSearchParams({
		client_id: CLIENTE,
		logout_uri: `${window.location.origin}/`,
	});

	window.location.assign(`${DOMINIO}/logout?${params}`);
}

/**
 * Un id token vigente, renovándolo si hace falta.
 *
 * Las llamadas concurrentes comparten la misma promesa: sin esto, varias
 * peticiones a la vez dispararían varios renovados que se pisan al guardar.
 */
let renovando: Promise<SesionComprador | null> | null = null;

export async function tokenVigente(): Promise<string | null> {
	const sesion = leerSesion();
	if (!sesion) return null;
	if (Date.now() < sesion.expira) return sesion.idToken;
	if (!sesion.refreshToken) {
		borrarSesion();
		return null;
	}

	renovando ??= (async () => {
		try {
			const r = await fetch(`${DOMINIO}/oauth2/token`, {
				method: "POST",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					grant_type: "refresh_token",
					client_id: CLIENTE,
					refresh_token: sesion.refreshToken,
				}),
			});

			if (!r.ok) throw new Error(String(r.status));
			return guardar(await r.json());
		} catch {
			// El refresh caducó o fue revocado: la sesión se acabó de verdad.
			borrarSesion();
			return null;
		} finally {
			renovando = null;
		}
	})();

	return (await renovando)?.idToken ?? null;
}
