"use client";

import { Hand } from "lucide-react";

interface Props {
	isPanning: boolean;
	togglePan: () => void;
}

export default function DesignerPanButton({ isPanning, togglePan }: Props) {
	return (
		<button
			type="button"
			onClick={togglePan}
			// Un botón de sólo icono sin nombre no existe para un lector de
			// pantalla: se anuncia como "botón" y nada más.
			aria-label={isPanning ? "Dejar de mover el lienzo" : "Mover el lienzo"}
			aria-pressed={isPanning}
			title={isPanning ? "Dejar de mover" : "Mover el lienzo"}
			className={`
        px-2 py-1 border rounded flex items-center gap-1 
        transition
        ${isPanning ? "bg-tinta text-hueso-suave border-tinta" : "bg-white hover:bg-gray-100"}
      `}
		>
			<Hand size={18} aria-hidden />
		</button>
	);
}
