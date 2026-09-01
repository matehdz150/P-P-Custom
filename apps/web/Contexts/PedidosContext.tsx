"use client";

import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";
import { contarNuevos, getMisPedidos, type Pedido } from "@/lib/api/pedidos";

type Ctx = {
	pedidos: Pedido[];
	/** Los que todavía no abre. Es el número de la insignia del menú. */
	nuevos: number;
	cargando: boolean;
	refresh: () => Promise<void>;
};

const PedidosContext = createContext<Ctx | null>(null);

/**
 * Los pedidos se cargan una vez arriba del panel: la barra lateral necesita
 * el conteo y la pantalla de pedidos necesita la lista, y sería tonto pedir
 * lo mismo dos veces.
 */
export function PedidosProvider({ children }: { children: ReactNode }) {
	const [pedidos, setPedidos] = useState<Pedido[]>([]);
	const [cargando, setCargando] = useState(true);

	const cargar = async () => {
		setPedidos(await getMisPedidos());
		setCargando(false);
	};

	useEffect(() => {
		cargar();
	}, []);

	return (
		<PedidosContext.Provider
			value={{
				pedidos,
				nuevos: contarNuevos(pedidos),
				cargando,
				refresh: cargar,
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
