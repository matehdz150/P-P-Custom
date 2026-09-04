/**
 * La sesión del BACKOFFICE.
 *
 * Es un pool aparte —`kustto-admins`— y no una comprobación dentro del panel:
 * el autorizador JWT de la API Gateway valida emisor y audiencia, así que un
 * token de comprador o de taller no abre `/admin/*` por mucho que alguien
 * cambie el front. Ver `infra/cognito-admin.sh`.
 *
 * SU PROPIA LLAVE EN EL NAVEGADOR. Con la del taller compartida, entrar al
 * backoffice cerraría la sesión del panel de proveedor en la misma máquina.
 */
import { crearAuth } from "./pool";

export { CambioDeContrasena, ErrorCognito, type Sesion } from "./pool";

const auth = crearAuth({
	cliente: process.env.NEXT_PUBLIC_ADMIN_CLIENTE ?? "",
	llave: "kustto.admin.sesion",
});

export const {
	leerSesion,
	borrarSesion,
	entrar,
	establecerContrasena,
	tokenVigente,
} = auth;
