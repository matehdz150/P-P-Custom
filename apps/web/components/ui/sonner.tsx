"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Los toasts, vestidos de kustto.
 *
 * Sonner trae su propio tema con variables `--normal-bg` y compañía; aquí se
 * sustituyen por los colores de la marca en vez de arrastrar la paleta de
 * shadcn, que no es la nuestra. El fondo es tinta y el texto hueso: el mismo
 * contraste invertido de los botones principales, para que un aviso se lea
 * como algo que dice la casa y no como una notificación del navegador.
 *
 * `richColors` queda APAGADO a propósito. Enciende verdes y rojos propios de
 * sonner que chocan con lima y con el rojo de los avisos de error. El acento
 * lo pone el icono, definido abajo.
 */
export function Toaster(props: ToasterProps) {
	return (
		<Sonner
			position="bottom-right"
			// Suficiente para leer una frase sin prisa, y no tanto como para que
			// se acumulen si el taller ajusta varias variantes seguidas.
			duration={4000}
			gap={10}
			toastOptions={{
				classNames: {
					toast:
						"font-brand rounded-xl border border-tinta/15 bg-tinta text-hueso shadow-[0_10px_34px_rgba(43,40,18,0.22)]",
					title: "text-[15px] font-semibold leading-snug text-hueso",
					description: "text-[13px] leading-[20px] text-hueso/70",
					// El icono es lo único con color: lima para lo que salió bien,
					// naranja para lo que no. La marca ya distingue esos dos.
					success: "[&_[data-icon]]:text-lima",
					error: "[&_[data-icon]]:text-naranja",
					actionButton:
						"bg-lima text-tinta rounded-lg px-2.5 h-8 text-[13px] font-semibold",
					cancelButton:
						"bg-transparent text-hueso/60 rounded-lg px-2 h-8 text-[13px]",
					closeButton: "bg-tinta border-tinta/30 text-hueso/70",
				},
			}}
			{...props}
		/>
	);
}
