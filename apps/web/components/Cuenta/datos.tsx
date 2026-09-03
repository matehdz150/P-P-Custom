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
	type DisenoGuardado,
	ErrorCuenta,
	getMisDisenos,
	getMisPedidos,
	type PedidoDelComprador,
} from "@/lib/api/cuenta";

/**
 * Lo que el panel entero comparte.
 *
 * POR QUÉ NO LO PIDE CADA SECCIÓN. Los pedidos los necesitan tres sitios a la
 * vez —la lista, las pastillas del menú y la rejilla de diseños—, y pedirlos
 * por separado son tres viajes idénticos en el mismo segundo. Peor: cambiar de
 * sección desmonta el componente, así que volver atrás los pedía otra vez y la
 * pantalla parpadeaba en blanco cada vez.
 *
 * NO ES UNA CACHÉ. No caduca ni revalida: vive mientras el panel esté abierto.
 * Cuando algo cambia de verdad —se guarda un diseño, se renombra— quien lo
 * cambió llama a `recargar` o sustituye el elemento en la lista.
 */

type Datos = {
	pedidos: PedidoDelComprador[] | null;
	disenos: DisenoGuardado[] | null;
	/** El mismo mensaje para las dos listas: si falla, falla el token. */
	fallo: string | null;
	recargar: () => void;
	/** Sustituye un diseño ya cargado sin volver a pedir la lista entera. */
	reemplazarDiseno: (d: DisenoGuardado) => void;
	quitarDiseno: (id: string) => void;
};

const Contexto = createContext<Datos | null>(null);

export function DatosDelPanel({ children }: { children: ReactNode }) {
	const [pedidos, setPedidos] = useState<PedidoDelComprador[] | null>(null);
	const [disenos, setDisenos] = useState<DisenoGuardado[] | null>(null);
	const [fallo, setFallo] = useState<string | null>(null);

	const traer = useCallback(() => {
		setFallo(null);

		const explicar = (error: unknown) =>
			setFallo(
				error instanceof ErrorCuenta && error.hayQueEntrar
					? "Tu sesión caducó. Vuelve a entrar."
					: "No pudimos traer tus datos.",
			);

		getMisPedidos().then(setPedidos).catch(explicar);

		/* Los diseños guardados no tumban el panel si fallan: son el añadido, y
		   los pedidos son la razón por la que alguien entra aquí. Una lista
		   vacía enseña el estado vacío, que dice qué hacer. */
		getMisDisenos()
			.then(setDisenos)
			.catch(() => setDisenos([]));
	}, []);

	useEffect(traer, [traer]);

	return (
		<Contexto.Provider
			value={{
				pedidos,
				disenos,
				fallo,
				recargar: traer,
				reemplazarDiseno: (d) =>
					setDisenos((antes) =>
						(antes ?? []).map((x) => (x.id === d.id ? d : x)),
					),
				quitarDiseno: (id) =>
					setDisenos((antes) => (antes ?? []).filter((x) => x.id !== id)),
			}}
		>
			{children}
		</Contexto.Provider>
	);
}

export function useDatosDelPanel() {
	const datos = useContext(Contexto);
	if (!datos) {
		throw new Error("useDatosDelPanel va dentro de <DatosDelPanel>");
	}
	return datos;
}
