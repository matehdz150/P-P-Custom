"use client";

import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import {
	type Comprador,
	leerComprador,
	salir as salirDeCognito,
} from "@/lib/auth/comprador";

type Valor = {
	comprador: Comprador | null;
	/**
	 * Cierto hasta que se leyó el navegador.
	 *
	 * Importa por el front estático: el HTML se pre-renderiza SIN sesión, así
	 * que pintar al comprador antes de montar sería una discrepancia de
	 * hidratación. Quien consume esto no debe enseñar nada mientras sea cierto.
	 */
	cargando: boolean;
	refrescar: () => void;
	salir: () => void;
};

const Contexto = createContext<Valor | null>(null);

export function CompradorProvider({ children }: { children: ReactNode }) {
	const [comprador, setComprador] = useState<Comprador | null>(null);
	const [cargando, setCargando] = useState(true);

	const refrescar = useCallback(() => {
		setComprador(leerComprador());
		setCargando(false);
	}, []);

	useEffect(() => {
		refrescar();

		// Si cierras sesión en otra pestaña, esta se entera. Sin esto una
		// pestaña vieja sigue enseñando tu nombre después de salir.
		const alCambiar = (e: StorageEvent) => {
			if (e.key === null || e.key.startsWith("kustto.comprador.")) refrescar();
		};

		window.addEventListener("storage", alCambiar);
		return () => window.removeEventListener("storage", alCambiar);
	}, [refrescar]);

	return (
		<Contexto.Provider
			value={{ comprador, cargando, refrescar, salir: salirDeCognito }}
		>
			{children}
		</Contexto.Provider>
	);
}

export function useComprador() {
	const ctx = useContext(Contexto);
	if (!ctx) {
		throw new Error("useComprador necesita estar dentro de CompradorProvider");
	}
	return ctx;
}
