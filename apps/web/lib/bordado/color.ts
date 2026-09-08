/**
 * Normalizar un color y darle un identificador estable.
 *
 * VIVE APARTE PARA QUE EL WORKER NO ARRASTRE LAS FUENTES. Estas dos funciones
 * estaban junto a la conversión de texto a curvas, que importa opentype.js y el
 * descompresor de woff2 —los dos atados al documento—. Empaquetar el worker
 * traía toda esa librería por dos funciones de treinta líneas que sólo miran
 * cadenas.
 */

/** El id con el que un color se convierte en un hilo del diseño. */
export function colorIdDe(hex: string) {
	return `color-${normalizarHex(hex).slice(1)}`;
}

export function normalizarHex(raw: string | null | undefined): string {
	if (!raw || raw === "none") return "#111111";
	if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase();
	if (/^#[0-9a-f]{3}$/i.test(raw))
		return `#${raw
			.slice(1)
			.split("")
			.map((parte) => parte + parte)
			.join("")}`.toLowerCase();
	const rgb = raw.match(/^rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)/i);
	return rgb
		? `#${rgb
				.slice(1, 4)
				.map((valor) => Number(valor).toString(16).padStart(2, "0"))
				.join("")}`
		: "#111111";
}
