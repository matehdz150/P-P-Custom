"use client";

import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { borrarSesion, leerSesion, tokenVigente } from "@/lib/auth/admin";

/**
 * La sesión del backoffice.
 *
 * NO PREGUNTA POR UN PERFIL, al revés que la del proveedor. Ahí el contexto
 * llama a `miPerfil()` porque el panel necesita los datos del taller; aquí no
 * hay perfil de administrador que traer, así que preguntar por uno sería una
 * llamada de ida y vuelta para saber algo que el token ya dice.
 *
 * QUIÉN ERES SALE DEL ID TOKEN, que es un JWT y trae el correo dentro. Se lee
 * sin verificar la firma **a propósito**: es sólo para escribir un nombre en
 * la cabecera. Lo que decide si puedes hacer algo lo verifica la API Gateway
 * con la firma de verdad, no esta pantalla. Si alguien se falsifica un token
 * en su navegador, se pinta su nombre y no abre una sola ruta.
 *
 * ESTO NO ES LA PUERTA. La puerta es el autorizador JWT de `/admin/*`. Este
 * contexto sólo evita enseñar una pantalla vacía a quien no ha entrado.
 */

type Admin = { email: string; nombre: string };

type Ctx = {
	admin: Admin | null;
	cargando: boolean;
	refrescar: () => Promise<void>;
	salir: () => void;
};

const AdminAuthContext = createContext<Ctx | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
	const [admin, setAdmin] = useState<Admin | null>(null);
	const [cargando, setCargando] = useState(true);

	const cargar = useCallback(async () => {
		if (!leerSesion()) {
			setAdmin(null);
			setCargando(false);
			return;
		}

		// `tokenVigente` renueva si hace falta y devuelve null si el refresco ya
		// caducó: es lo que distingue "tengo tokens viejos guardados" de "tengo
		// sesión".
		const token = await tokenVigente();
		setAdmin(token ? deElToken(token) : null);
		setCargando(false);
	}, []);

	const salir = useCallback(() => {
		borrarSesion();
		setAdmin(null);
	}, []);

	useEffect(() => {
		cargar();
	}, [cargar]);

	return (
		<AdminAuthContext.Provider
			value={{ admin, cargando, refrescar: cargar, salir }}
		>
			{children}
		</AdminAuthContext.Provider>
	);
}

export function useAdminAuth() {
	const ctx = useContext(AdminAuthContext);
	if (!ctx) {
		throw new Error("useAdminAuth debe usarse dentro de AdminAuthProvider");
	}
	return ctx;
}

/**
 * El correo y el nombre que trae el id token.
 *
 * Un JWT son tres partes en base64url separadas por puntos; la de en medio son
 * las claims. Se decodifica a mano porque meter una librería para leer un
 * objeto que ya viene en el propio token no compensa.
 */
function deElToken(token: string): Admin | null {
	try {
		const carga = token.split(".")[1];
		if (!carga) return null;

		// base64url -> base64: `atob` no entiende `-` ni `_`, y sin el relleno
		// falla en uno de cada tres tokens. Es el clásico "a veces no entra".
		const base64 = carga.replace(/-/g, "+").replace(/_/g, "/");
		const claims = JSON.parse(
			atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")),
		);

		return {
			email: String(claims.email ?? ""),
			nombre: String(claims.name ?? claims.email ?? ""),
		};
	} catch {
		return null;
	}
}
