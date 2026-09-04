/**
 * La sesión del TALLER.
 *
 * El flujo vive en `lib/auth/pool`, compartido con el backoffice: aquí sólo se
 * ata a este pool. Se conservan los nombres que ya importaban las pantallas
 * del proveedor, así que para ellas no cambió nada.
 */
import { crearAuth } from "./pool";

export { CambioDeContrasena, ErrorCognito, type Sesion } from "./pool";

const auth = crearAuth({
	cliente: process.env.NEXT_PUBLIC_COGNITO_CLIENTE ?? "",
	llave: "kustto.proveedor.sesion",
});

export const {
	leerSesion,
	borrarSesion,
	entrar,
	establecerContrasena,
	tokenVigente,
} = auth;
