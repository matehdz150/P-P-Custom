"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * El movimiento del panel.
 *
 * NO ES EL DE LAS LANDINGS. `components/Animaciones/Entrada` dura 0.68 s y
 * entra desde 22 px: está bien para una página que se recorre despacio y se
 * mira una vez. Aquí se cambia de sección quince veces en una sesión, y a esa
 * frecuencia lo mismo se siente como que la aplicación va lenta. Estos números
 * son de panel: se notan y no se esperan.
 *
 * LA SALIDA ES MÁS RÁPIDA QUE LA ENTRADA, y no es un capricho: lo que se va ya
 * no interesa a nadie, y con `mode="wait"` cada milisegundo de salida es un
 * milisegundo antes de ver lo que se pidió.
 *
 * SÓLO OPACIDAD Y `transform`. Animar alto o ancho obliga al navegador a
 * recalcular la maquetación en cada fotograma; con una rejilla de treinta
 * tarjetas eso se ve.
 *
 * EL RESPETO A "REDUCIR MOVIMIENTO" NO SE COMPRUEBA AQUÍ: lo pone
 * `<MotionConfig reducedMotion="user">` en la raíz del panel, de una vez para
 * todo lo de dentro. Repetir `useReducedMotion` en cada pieza sería garantizar
 * que alguna se quede sin él.
 */

/** La misma curva que usan las landings: el sitio se mueve igual en todas partes. */
export const CURVA = [0.22, 1, 0.36, 1] as const;

const ENTRADA = 0.26;
const SALIDA = 0.14;

/**
 * Una sección del panel entrando y saliendo.
 *
 * No se llama `Seccion` porque ese nombre ya es el TIPO de una entrada del menú
 * en `Sidebar`, y tener los dos en la misma pantalla obliga a renombrar uno al
 * importarlo — que es como se acaba leyendo `Seccion as OtraCosa`.
 *
 * Va dentro de un `<AnimatePresence mode="wait">` y con `key` en la sección: sin
 * la llave, React reusa el nodo y no hay ni entrada ni salida — sólo cambia el
 * contenido de golpe.
 */
export function Transicion({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<motion.div
			className={className}
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			/* La salida lleva su propia duración. Puesta en `transition` a secas,
			   framer la usa para las dos y la sección tardaría lo mismo en irse que
			   en llegar — que es justo lo que este archivo dice que no hace. */
			exit={{
				opacity: 0,
				y: -6,
				transition: { duration: SALIDA, ease: CURVA },
			}}
			transition={{ duration: ENTRADA, ease: CURVA }}
		>
			{children}
		</motion.div>
	);
}

/**
 * Un elemento de una lista o rejilla, que entra escalonado.
 *
 * EL ESCALONADO SE CORTA AL OCTAVO. Con `staggerChildren` el retraso crece sin
 * fin: treinta pedidos a 35 ms son más de un segundo hasta que aparece el
 * último, y quien va a por el de abajo lo ve llegar tarde. Los primeros ocho
 * bastan para que se lea como una lista que entra; a partir de ahí, todos a la
 * vez.
 *
 * LLEVA SALIDA para que quitar un favorito o borrar un diseño no sea un salto:
 * quien lo use tiene que envolver la lista en `<AnimatePresence>` y darle `key`
 * al elemento, o la salida no ocurre.
 */
export function Elemento({
	children,
	className,
	indice = 0,
}: {
	children: ReactNode;
	className?: string;
	indice?: number;
}) {
	return (
		<motion.div
			className={className}
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{
				opacity: 0,
				scale: 0.97,
				transition: { duration: SALIDA, ease: CURVA },
			}}
			transition={{
				duration: ENTRADA,
				ease: CURVA,
				delay: Math.min(indice, 7) * 0.035,
			}}
		>
			{children}
		</motion.div>
	);
}
