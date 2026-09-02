"use client";

/**
 * Un campo del checkout.
 *
 * La etiqueta flota sobre el borde en vez de ir arriba: en una pantalla con
 * ocho campos, las etiquetas sueltas duplican la altura y obligan a hacer
 * scroll justo cuando alguien está a punto de confirmar.
 *
 * El error va ATADO al campo con `aria-describedby` y no suelto al final del
 * formulario, para que un lector de pantalla lo lea al llegar al campo que
 * está mal y no cuando ya pasó de largo.
 */
export function Campo({
	id,
	etiqueta,
	valor,
	onChange,
	tipo = "text",
	requerido = false,
	error,
	ayuda,
	autoComplete,
	inputMode,
	maxLength,
	bloqueado = false,
	className = "",
}: {
	id: string;
	etiqueta: string;
	valor: string;
	onChange: (v: string) => void;
	tipo?: string;
	requerido?: boolean;
	error?: string | null;
	ayuda?: string;
	autoComplete?: string;
	inputMode?: "text" | "numeric" | "tel" | "email";
	maxLength?: number;
	/**
	 * Se enseña pero no se edita. `readOnly` y no `disabled` a propósito: un
	 * campo deshabilitado no recibe foco, no lo lee un lector de pantalla al
	 * tabular, y su valor no se manda en un envío nativo del formulario.
	 */
	bloqueado?: boolean;
	className?: string;
}) {
	const idError = `${id}-error`;
	const idAyuda = `${id}-ayuda`;

	return (
		<div className={`flex flex-col ${className}`}>
			<div className="relative">
				<input
					id={id}
					type={tipo}
					value={valor}
					onChange={(e) => onChange(e.target.value)}
					autoComplete={autoComplete}
					inputMode={inputMode}
					maxLength={maxLength}
					readOnly={bloqueado}
					placeholder=" "
					aria-invalid={error ? true : undefined}
					aria-describedby={error ? idError : ayuda ? idAyuda : undefined}
					className={`peer h-14 w-full rounded-lg border-[1.5px] px-3.5 pt-4 text-[15px] outline-none transition-colors placeholder:text-transparent focus:border-tinta ${
						bloqueado
							? "border-tinta/12 bg-gris text-tinta/60"
							: "bg-white text-tinta"
					} ${error ? "border-[#c0392b]" : bloqueado ? "" : "border-tinta/20"}`}
				/>
				<label
					htmlFor={id}
					className={`pointer-events-none absolute left-3.5 top-1.5 text-[11px] uppercase tracking-[0.06em] transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-[15px] peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-focus:top-1.5 peer-focus:translate-y-0 peer-focus:text-[11px] peer-focus:uppercase peer-focus:tracking-[0.06em] ${
						error ? "text-[#c0392b]" : "text-tinta/55 peer-focus:text-tinta/70"
					}`}
				>
					{etiqueta}
					{requerido && " *"}
				</label>
			</div>

			{error ? (
				<span
					id={idError}
					role="alert"
					className="pt-1.5 text-[13px] text-[#c0392b]"
				>
					{error}
				</span>
			) : ayuda ? (
				<span id={idAyuda} className="pt-1.5 text-[13px] text-tinta/55">
					{ayuda}
				</span>
			) : null}
		</div>
	);
}
