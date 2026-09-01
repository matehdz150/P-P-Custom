"use client";

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
