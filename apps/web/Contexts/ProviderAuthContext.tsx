"use client";

import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { miPerfil, type Proveedor } from "@/lib/api/proveedores";
import { borrarSesion, leerSesion } from "@/lib/auth/cognito";

/**
 * La sesión del proveedor.
 *
 * Antes la mandaba la API de Nest con una cookie; ahora la manda Cognito y
 * el token vive en el navegador. El contexto no lo toca: sólo pregunta por
 * el perfil, y si la API contesta 401 es que no hay sesión.
 */

type Ctx = {
	provider: Proveedor | null;
	loading: boolean;
	refresh: () => Promise<void>;
	salir: () => void;
};

const ProviderAuthContext = createContext<Ctx | null>(null);

export function ProviderAuthProvider({ children }: { children: ReactNode }) {
	const [provider, setProvider] = useState<Proveedor | null>(null);
	const [loading, setLoading] = useState(true);

	const load = useCallback(async () => {
		// Sin token guardado no hay nada que preguntar: se ahorra una llamada
		// que sabemos que va a dar 401 en cada carga de página anónima.
		if (!leerSesion()) {
			setProvider(null);
			setLoading(false);
			return;
		}

		try {
			setProvider(await miPerfil());
		} catch {
			setProvider(null);
		} finally {
			setLoading(false);
		}
	}, []);

	const salir = useCallback(() => {
		borrarSesion();
		setProvider(null);
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	return (
		<ProviderAuthContext.Provider value={{ provider, loading, refresh: load, salir }}>
			{children}
		</ProviderAuthContext.Provider>
	);
}

export function useProviderAuth() {
	const ctx = useContext(ProviderAuthContext);
	if (!ctx)
		throw new Error(
			"useProviderAuth debe usarse dentro de ProviderAuthProvider",
		);
	return ctx;
}
