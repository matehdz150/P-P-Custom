/** El escalón entre una pieza y la siguiente, en milisegundos. */
const ESCALON = 50;

/** Más allá de esto el último de la fila se sentiría lento. */
const ESCALONES_MAX = 7;

/**
 * Entrada de los bloques del catálogo: suben 16px y aparecen al montarse.
 *
 * Va en CSS y no en JS a propósito. Con una animación por JavaScript el
 * elemento arranca en opacidad 0 y depende de que el runtime la avance; si
 * no lo hace, el contenido nunca se ve. Aquí el estado base es visible y la
 * animación va DESDE la opacidad 0, así que el peor caso es que no haya
 * animación, no que no haya contenido. Y de paso no necesita ser cliente.
 *
 * `indice` escalona una rejilla — el retraso se topa a los primeros
 * elementos para que la última pieza no se haga esperar. La regla vive bajo
 * `prefers-reduced-motion: no-preference`, así que quien pidió menos
 * movimiento no ve nada moverse.
 */
export default function Aparece({
	children,
	indice = 0,
	className,
}: {
	children: React.ReactNode;
	indice?: number;
	className?: string;
}) {
	const retraso = Math.min(indice, ESCALONES_MAX) * ESCALON;

	return (
		<div
			className={`aparece ${className ?? ""}`}
			style={retraso ? { animationDelay: `${retraso}ms` } : undefined}
		>
			{children}
		</div>
	);
}
