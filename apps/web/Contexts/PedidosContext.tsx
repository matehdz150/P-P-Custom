"use client";

import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import { contarNuevos, getMisPedidos, type Pedido } from "@/lib/api/pedidos";
import { abrirCanal, type EstadoCanal } from "@/lib/eventos/canal";

/**
 * Los pedidos del taller, al día solos.
 *
 * Se cargan una vez arriba del panel: la barra lateral necesita el conteo y la
 * pantalla necesita la lista, y sería tonto pedir lo mismo dos veces.
 *
 * CÓMO SE ENTERA DE UN PEDIDO NUEVO. Por WebSocket (`lib/eventos/canal.ts`).
 * La Lambda de admin avisa al crear el pedido y aquí se recarga la lista. El
 * aviso NO trae el pedido, sólo la noticia: los datos siguen saliendo de la
 * API de siempre, que es el único sitio donde se decide qué ve cada taller.
 * Un segundo camino con las mismas reglas es como acaban divergiendo.
 *
 * Al reconectar también se recarga: mientras el canal estuvo caído pudo
 * entrar algo, y el WebSocket no guarda lo que no pudo entregar.
 */

type Ctx = {
	pedidos: Pedido[];
	/** Los que todavía no abre. Es el número de la insignia del menú. */
	nuevos: number;
	cargando: boolean;
	/** Por qué no hay lista. Distingue "no tienes pedidos" de "no cargó". */
	fallo: string | null;
	/** Ids que llegaron con el panel ya abierto. */
	recienLlegados: string[];
	/** Los da por vistos: apaga el aviso y el resaltado. */
	marcarVistos: () => void;
	/** Para poder decir si el panel está al día o quedó descolgado. */
	canal: EstadoCanal;
	refresh: () => Promise<void>;
};

const PedidosContext = createContext<Ctx | null>(null);

export function PedidosProvider({ children }: { children: ReactNode }) {
	const [pedidos, setPedidos] = useState<Pedido[]>([]);
	const [cargando, setCargando] = useState(true);
	const [fallo, setFallo] = useState<string | null>(null);
	const [recienLlegados, setRecienLlegados] = useState<string[]>([]);
	const [canal, setCanal] = useState<EstadoCanal>("conectando");

	/** Los ids ya conocidos. En una ref para no reabrir el canal al cambiar. */
	const conocidos = useRef<Set<string> | null>(null);

	/**
	 * `silencioso` es para las recargas que dispara el canal: si una falla —un
	 * túnel, el wifi del taller— se deja la última lista buena en pantalla en
	 * vez de cambiarla por un error. Un fallo pasajero no puede borrarle a
	 * nadie el trabajo de la vista.
	 */
	const cargar = useCallback(async (silencioso = false) => {
		try {
			const lista = await getMisPedidos();

			// La primera carga no "descubre" nada: todo es nuevo para el panel,
			// pero no es nuevo para el taller.
			if (conocidos.current === null) {
				conocidos.current = new Set(lista.map((p) => p.id));
			} else {
				const aparecidos = lista
					.filter((p) => !conocidos.current?.has(p.id))
					.map((p) => p.id);

				if (aparecidos.length > 0) {
					setRecienLlegados((previos) => [...aparecidos, ...previos]);
					for (const id of aparecidos) conocidos.current.add(id);
				}
			}

			setPedidos(lista);
			setFallo(null);
		} catch (error) {
			if (!silencioso) {
				setFallo(
					error instanceof Error
						? error.message
						: "No pudimos cargar tus pedidos",
				);
			}
		} finally {
			setCargando(false);
		}
	}, []);

	const refresh = useCallback(() => cargar(false), [cargar]);

	useEffect(() => {
		cargar(false);
	}, [cargar]);

	useEffect(() => {
		const canal = abrirCanal(
			() => {
				// Cualquier aviso significa lo mismo: hay algo distinto, recarga.
				// Distinguir tipos aquí sería adivinar qué cambió en vez de
				// preguntarlo, y son decenas de pedidos.
				void cargar(true);
			},
			(estado) => {
				setCanal(estado);
				// Al recuperar la conexión hay que ponerse al día: lo que pasó
				// mientras estuvo caída no se reenvía.
				if (estado === "conectado") void cargar(true);
			},
		);

		return () => canal.cerrar();
	}, [cargar]);

	/* El contador en el título: es lo único que se ve con la pestaña detrás, y
	   es la diferencia entre enterarse de un pedido ahora o en dos horas. */
	useEffect(() => {
		const limpio = document.title.replace(/^\(\d+\)\s*/, "");

		document.title =
			recienLlegados.length > 0
				? `(${recienLlegados.length}) ${limpio}`
				: limpio;

		return () => {
			document.title = document.title.replace(/^\(\d+\)\s*/, "");
		};
	}, [recienLlegados.length]);

	const marcarVistos = useCallback(() => setRecienLlegados([]), []);

	return (
		<PedidosContext.Provider
			value={{
				pedidos,
				nuevos: contarNuevos(pedidos),
				cargando,
				fallo,
				recienLlegados,
				marcarVistos,
				canal,
				refresh,
			}}
		>
			{children}
		</PedidosContext.Provider>
	);
}

export function usePedidos() {
	const ctx = useContext(PedidosContext);
	if (!ctx) throw new Error("usePedidos debe usarse dentro de PedidosProvider");
	return ctx;
}
