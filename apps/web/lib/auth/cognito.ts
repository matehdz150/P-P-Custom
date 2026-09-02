/**
 * Login de proveedores contra Cognito, sin SDK.
 *
 * Cognito habla JSON plano por HTTP: una llamada es un POST con el header
 * `x-amz-target`. El SDK de amplify pesa cientos de kilobytes para hacer
 * exactamente esto, así que va a mano.
 *
 * DÓNDE VIVEN LOS TOKENS — y por qué importa
 *
 *   Quedan en localStorage. La alternativa buena es una cookie httpOnly, que
 *   el JavaScript de la página no puede leer y por tanto un XSS no puede
 *   robar. Pero una cookie httpOnly la pone un servidor, y el plan es que el
 *   front sea estático en S3 + CloudFront: no hay servidor que la ponga.
 *
 *   Así que el trato es explícito: si alguien logra ejecutar JavaScript en
 *   nuestro dominio, se lleva la sesión del proveedor. Se acota con tokens
 *   cortos (1 hora) y con que la Lambda sólo deja tocar el perfil propio.
 *   Si más adelante montamos una ruta de Next del lado servidor para el
 *   panel, esto se cambia por cookie httpOnly y este archivo se encoge.
 */

const REGION = process.env.NEXT_PUBLIC_COGNITO_REGION ?? "us-east-1";
const CLIENTE = process.env.NEXT_PUBLIC_COGNITO_CLIENTE ?? "";
const ENDPOINT = `https://cognito-idp.${REGION}.amazonaws.com/`;

const LLAVE = "kustto.proveedor.sesion";

export type Sesion = {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  /** Epoch en ms. Se calcula al guardar, no viene de Cognito. */
  expira: number;
};

/** Cognito pidió cambiar la contraseña antes de dejar entrar. */
export class CambioDeContrasena {
  constructor(
    readonly sesion: string,
    readonly usuario: string,
  ) {}
}

export class ErrorCognito extends Error {
  constructor(
    readonly tipo: string,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = "ErrorCognito";
  }

  /** El correo o la contraseña están mal. Lo único que se le puede decir al usuario. */
  get sonCredenciales() {
    return (
      this.tipo === "NotAuthorizedException" ||
      this.tipo === "UserNotFoundException"
    );
  }

  /**
   * El fallo es nuestro, no de quien intenta entrar: el id de cliente, la
   * región o el flujo de autenticación están mal.
   *
   * Se distingue porque si no, cae en el cajón de "no pudimos conectar" y
   * manda a buscar el problema al internet del taller. Ya pasó: un
   * `NEXT_PUBLIC_COGNITO_CLIENTE` cortado a diez caracteres devolvía
   * `ResourceNotFoundException` y la pantalla decía "revisa tu internet".
   */
  get esConfiguracion() {
    return (
      this.tipo === "Config" ||
      this.tipo === "ResourceNotFoundException" ||
      this.tipo === "InvalidParameterException"
    );
  }
}

async function llamar(accion: string, cuerpo: unknown) {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
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
    throw new ErrorCognito("Red", "No pudimos conectar con el servidor");
  }

  const dato = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Cognito manda el tipo en __type, a veces con prefijo de namespace.
    const tipo = String(dato.__type ?? "Desconocido").split("#").pop()!;
    throw new ErrorCognito(tipo, dato.message ?? `Cognito respondió ${res.status}`);
  }

  return dato;
}

function guardar(resultado: {
  IdToken: string;
  AccessToken: string;
  RefreshToken?: string;
  ExpiresIn: number;
}): Sesion {
  // REFRESH_TOKEN_AUTH no devuelve refresh token nuevo: se conserva el que ya
  // teníamos, o de lo contrario la sesión moriría al primer renovado.
  const previa = leerSesion();

  const sesion: Sesion = {
    idToken: resultado.IdToken,
    accessToken: resultado.AccessToken,
    refreshToken: resultado.RefreshToken ?? previa?.refreshToken ?? "",
    // Medio minuto de colchón: evita mandar un token que caduca en vuelo.
    expira: Date.now() + (resultado.ExpiresIn - 30) * 1000,
  };

  localStorage.setItem(LLAVE, JSON.stringify(sesion));
  return sesion;
}

export function leerSesion(): Sesion | null {
  if (typeof window === "undefined") return null;
  try {
    const crudo = localStorage.getItem(LLAVE);
    return crudo ? (JSON.parse(crudo) as Sesion) : null;
  } catch {
    return null;
  }
}

export function borrarSesion() {
  if (typeof window !== "undefined") localStorage.removeItem(LLAVE);
}

/**
 * Entra con correo y contraseña.
 *
 * Si el proveedor todavía trae la contraseña temporal que le dio el admin,
 * Cognito no devuelve tokens: devuelve un reto. Se propaga como
 * `CambioDeContrasena` para que la pantalla pida la nueva y llame a
 * `establecerContrasena` con la misma sesión.
 */
export async function entrar(email: string, password: string) {
  if (!CLIENTE) throw new ErrorCognito("Config", "Falta NEXT_PUBLIC_COGNITO_CLIENTE");

  const r = await llamar("InitiateAuth", {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: CLIENTE,
    AuthParameters: { USERNAME: email, PASSWORD: password },
  });

  if (r.ChallengeName === "NEW_PASSWORD_REQUIRED") {
    // Cognito exige responder con el usuario que ÉL resolvió, no con el
    // correo tal cual se escribió: en un pool con alias no son el mismo.
    throw new CambioDeContrasena(
      r.Session,
      r.ChallengeParameters?.USER_ID_FOR_SRP ?? email,
    );
  }

  if (!r.AuthenticationResult) {
    throw new ErrorCognito(
      r.ChallengeName ?? "Desconocido",
      `Cognito pidió un paso que no sabemos resolver: ${r.ChallengeName}`,
    );
  }

  return guardar(r.AuthenticationResult);
}

/** Cierra el reto NEW_PASSWORD_REQUIRED y deja la sesión abierta. */
export async function establecerContrasena(
  reto: CambioDeContrasena,
  nueva: string,
) {
  const r = await llamar("RespondToAuthChallenge", {
    ClientId: CLIENTE,
    ChallengeName: "NEW_PASSWORD_REQUIRED",
    Session: reto.sesion,
    ChallengeResponses: { USERNAME: reto.usuario, NEW_PASSWORD: nueva },
  });

  if (!r.AuthenticationResult) {
    throw new ErrorCognito("Desconocido", "Cognito no devolvió la sesión");
  }

  return guardar(r.AuthenticationResult);
}

/**
 * Devuelve un id token vigente, renovándolo si hace falta.
 *
 * Todas las llamadas concurrentes comparten la misma promesa de renovado:
 * sin esto, cinco peticiones al cargar el panel dispararían cinco refresh y
 * se pisarían al guardar.
 */
let renovando: Promise<Sesion | null> | null = null;

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
      const r = await llamar("InitiateAuth", {
        AuthFlow: "REFRESH_TOKEN_AUTH",
        ClientId: CLIENTE,
        AuthParameters: { REFRESH_TOKEN: sesion.refreshToken },
      });
      return guardar(r.AuthenticationResult);
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
