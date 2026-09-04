"use client";

import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

/**
 * Una vista se adueña de la cabecera del panel.
 *
 * POR QUÉ. El panel pone arriba el nombre de la sección —"Plantillas"— y para
 * una lista está bien. Pero armar una plantilla no es mirar tus plantillas, y
 * ese título encima decía algo que ya no era cierto mientras ocupaba lo que
 * mide media pantalla en un teléfono.
 *
 * NO ES UNA CABECERA NUEVA, es LA del panel: la misma tipografía y la misma
 * flecha de volver que ya usan el detalle de un pedido y "volver a pedir". Una
 * pantalla que se inventa su propio encabezado se nota, y se nota mal.
 *
 * LA VUELTA VA POR REFERENCIA porque quien la pasa la crea en cada render;
 * meterla en las dependencias del efecto sería un bucle.
 *
 * SE SUELTA AL DESMONTAR, siempre. Si una vista se va sin devolverla, el panel
 * se queda con el título de otra cosa hasta que alguien recargue.
 */
type Cabecera = { titulo: string; volver: () => void } | null;

const Contexto = createContext<{
	cabecera: Cabecera;
	poner: (c: Cabecera) => void;
}>({ cabecera: null, poner: () => {} });

export function ProveedorDePantalla({ children }: { children: ReactNode }) {
	const [cabecera, poner] = useState<Cabecera>(null);
	const valor = useMemo(() => ({ cabecera, poner }), [cabecera]);

	return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/** Lo lee el marco del panel. */
export function useCabecera() {
	return useContext(Contexto).cabecera;
}

/** Lo llama la vista que manda. `titulo` nulo la deja como estaba. */
export function useCabeceraDelPanel(
	titulo: string | null,
	onVolver: () => void,
) {
	const { poner } = useContext(Contexto);
	const volver = useRef(onVolver);
	volver.current = onVolver;

	useEffect(() => {
		if (!titulo) return;

		poner({ titulo, volver: () => volver.current() });
		return () => poner(null);
	}, [titulo, poner]);
}
