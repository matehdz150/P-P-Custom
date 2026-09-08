"use client";

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	esTecnica,
	TECNICAS,
	TECNICAS_EN_ORDEN,
	type Tecnica,
} from "@/lib/impresion/tecnicas";

/** Los ladrillos del formulario. Todos con la misma altura y el mismo foco. */

export const CAMPO =
	"h-[50px] w-full rounded-lg border-[1.5px] border-tinta/18 bg-white px-[15px] text-[15px] text-tinta outline-none placeholder:text-tinta/45 focus:border-tinta focus:shadow-[0_0_0_3px_rgba(174,255,110,0.55)]";

export function Etiqueta({
	children,
	opcional,
}: {
	children: string;
	opcional?: boolean;
}) {
	return (
		<span className="text-sm font-semibold text-tinta">
			{children}
			{opcional && (
				<span className="ml-1.5 font-normal text-tinta/50">opcional</span>
			)}
		</span>
	);
}

/** La línea que dice para qué sirve el campo. Es lo que hace entendible el alta. */
export function Ayuda({ children }: { children: React.ReactNode }) {
	return (
		<span className="text-[13px] leading-5 text-tinta/60">{children}</span>
	);
}

export function Texto({
	etiqueta,
	ayuda,
	valor,
	onChange,
	placeholder,
	opcional,
	tipo = "text",
	className,
}: {
	etiqueta: string;
	ayuda?: string;
	valor: string;
	onChange: (v: string) => void;
	placeholder?: string;
	opcional?: boolean;
	tipo?: string;
	className?: string;
}) {
	return (
		<label className={`flex flex-col gap-[7px] ${className ?? ""}`}>
			<Etiqueta opcional={opcional}>{etiqueta}</Etiqueta>
			<input
				type={tipo}
				value={valor}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				className={CAMPO}
			/>
			{ayuda && <Ayuda>{ayuda}</Ayuda>}
		</label>
	);
}

export function Numero({
	valor,
	onChange,
	ancho = "w-24",
	min = 0,
}: {
	valor: number | "";
	onChange: (v: number | "") => void;
	ancho?: string;
	min?: number;
}) {
	return (
		<input
			type="number"
			min={min}
			value={valor}
			onChange={(e) =>
				onChange(e.target.value === "" ? "" : Number(e.target.value))
			}
			className={`${CAMPO} ${ancho} px-3 text-center font-mono`}
		/>
	);
}

/** Chip de selección múltiple: categorías, técnicas, qué puede meter el cliente. */
export function Chip({
	activo,
	onClick,
	children,
}: {
	activo: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={activo}
			className={`flex h-10 items-center rounded-lg px-[15px] text-sm ${
				activo
					? "bg-lima font-semibold text-tinta"
					: "border-[1.5px] border-tinta/15 text-tinta"
			}`}
		>
			{children}
		</button>
	);
}

export function Palomita() {
	return (
		<svg
			width="13"
			height="13"
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden="true"
		>
			<path
				d="M5 12.6l4.8 4.8L19.5 7"
				stroke="currentColor"
				strokeWidth="3.4"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

/**
 * Con qué se estampa un lado.
 *
 * NO ES UN CAMPO MÁS: es el único del formulario que cambia el ARCHIVO que el
 * taller va a recibir. Por eso lleva debajo lo que implica —PNG a los DPI de
 * al lado, o trazos— en vez de dejarlo a que cada quien lo deduzca del nombre
 * de la técnica.
 *
 * Es un `Select` de shadcn y no un `<select>` a mano: el proyecto ya lo trae
 * sobre Radix, y dibujarlo aparte terminaría con dos desplegables que se ven
 * distinto en la misma pantalla.
 */
export function SelectorDeTecnica({
	valor,
	onCambio,
}: {
	valor: Tecnica | "";
	onCambio: (v: Tecnica) => void;
}) {
	const salida = esTecnica(valor) ? TECNICAS[valor].salida : null;

	return (
		<span className="flex items-center gap-2">
			<Select value={valor || undefined} onValueChange={onCambio}>
				<SelectTrigger
					aria-label="Con qué se estampa"
					className="h-[38px] w-[176px] rounded-lg border-[1.5px] border-tinta/18 bg-white text-[14px] text-tinta"
				>
					<SelectValue placeholder="Cómo se estampa" />
				</SelectTrigger>
				<SelectContent>
					{TECNICAS_EN_ORDEN.map(([clave, t]) => (
						<SelectItem key={clave} value={clave}>
							{t.nombre}
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			{/* Lo que de verdad cambia, dicho en una palabra. Sin esto, "Grabado
			    láser" y "Sublimación" se leen como dos etiquetas equivalentes. */}
			{salida && (
				<Ayuda>{salida === "vector" ? "manda trazos" : "manda PNG"}</Ayuda>
			)}
		</span>
	);
}
