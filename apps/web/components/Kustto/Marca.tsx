// Símbolo y logotipo de kustto.
// La camisa y el cursor son un solo sistema: el cursor lleva un recorte del
// color de la placa para que se despegue de la prenda a cualquier tamaño.

/** Trazo de la prenda del símbolo. La animación del hero reusa este mismo
 *  path: es la figura de la marca, no un dibujo aparte. */
export const CAMISA =
	"M106,66 C114,82 146,82 154,66 L182,75 L205,105 L185,126 L173,112 L173,193 Q173,200 166,200 L94,200 Q87,200 87,193 L87,112 L75,126 L55,105 L78,75 Z";

/** Alto de la prenda dentro del viewBox de 260, para calcular escalas. */
export const CAMISA_ALTO = 134 / 260;

export const CURSOR = "0,0 0,21 5.8,15.9 9.7,24 13.5,22.1 9.7,14.4 16.4,14.4";

type SimboloProps = {
	size?: number;
	placa?: string;
	prenda?: string;
	cursor?: string;
	/** Abajo de 24px la puntada del cursor se pierde: usa la versión sin cursor. */
	reducido?: boolean;
	className?: string;
};

export function Simbolo({
	size = 40,
	placa = "#aeff6e",
	prenda = "#2b2812",
	cursor = "#2b2812",
	reducido = false,
	className,
}: SimboloProps) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 260 260"
			fill="none"
			className={className}
			aria-hidden="true"
		>
			<rect width="260" height="260" rx="48" fill={placa} />
			<path d={CAMISA} fill={prenda} />
			{!reducido && (
				<g transform="translate(158,150) scale(2.35)">
					<polygon
						points={CURSOR}
						fill="none"
						stroke={placa}
						strokeWidth="6.5"
						strokeLinejoin="round"
					/>
					<polygon points={CURSOR} fill={cursor} />
				</g>
			)}
		</svg>
	);
}

export function Logotipo({ className }: { className?: string }) {
	return (
		<span
			className={`font-brand font-medium tracking-[-0.05em] leading-none text-tinta ${className ?? ""}`}
		>
			kustto
		</span>
	);
}
