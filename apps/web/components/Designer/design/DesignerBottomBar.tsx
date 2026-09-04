"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import DesignerPanButton from "./DesignerPanButton";

interface Props {
	zoom: number;
	zoomIn: () => void;
	zoomOut: () => void;
	isPanning: boolean;
	togglePan: () => void;
	/**
	 * En "Probar" el zoom mueve la VISTA, no el lienzo, y se le suma la descarga.
	 *
	 * La barra NO desaparece en ese modo, y es a propósito: agregar al carrito o
	 * pedir es justo lo que uno quiere hacer DESPUÉS de ver cómo queda. Obligar a
	 * volver a "Editar" para encontrar el botón sería mandar a la gente hacia
	 * atrás en el momento de decidir.
	 */
	probando?: boolean;
	/** Vuelve al 100 % y recentra. Sólo en "Probar". */
	onReiniciarZoom?: () => void;
	/** Devuelve `null` si no hay nada que descargar todavía. */
	onDescargar?: () => Promise<void>;
}

export default function DesignerBottomBar({
	zoom,
	zoomIn,
	zoomOut,
	isPanning,
	togglePan,
	probando,
	onReiniciarZoom,
	onDescargar,
}: Props) {
	const { setPidiendo, setAgregando, plantilla } = useDesigner();
	const [bajando, setBajando] = useState(false);

	async function descargar() {
		if (!onDescargar || bajando) return;
		setBajando(true);
		try {
			await onDescargar();
		} finally {
			setBajando(false);
		}
	}

	return (
		<div
			className="
      absolute bottom-0 left-0 w-full 
      bg-white border-t shadow-lg 
      py-3 px-4 
      flex items-center justify-between
      z-70
    "
		>
			{/* CONTROLES DE ZOOM (compactos como Printify) */}
			<div className="flex items-center gap-2">
				<button
					type="button"
					onClick={zoomOut}
					aria-label="Alejar"
					className="px-3 py-1 border rounded hover:bg-gray-100"
				>
					-
				</button>

				{/* En "Probar" el porcentaje se puede pulsar para volver al 100 % y
				    recentrar: acercarse a mirar una costura y no encontrar el camino
				    de vuelta es el final natural de todo zoom. */}
				{probando ? (
					<button
						type="button"
						onClick={onReiniciarZoom}
						title="Volver al 100%"
						className="px-4 py-1 border rounded text-sm bg-white hover:bg-gray-100"
					>
						{Math.round(zoom * 100)}%
					</button>
				) : (
					<span className="px-4 py-1 border rounded text-sm bg-white">
						{Math.round(zoom * 100)}%
					</span>
				)}

				<button
					type="button"
					onClick={zoomIn}
					aria-label="Acercar"
					className="px-3 py-1 border rounded hover:bg-gray-100"
				>
					+
				</button>

				{/* La mano sólo en el editor. Ahí hace falta un modo porque arrastrar
				    también mueve objetos; en la vista no hay nada que seleccionar, así
				    que arrastrar siempre significa mover y un interruptor con un solo
				    significado sobra. */}
				{!probando && (
					<DesignerPanButton isPanning={isPanning} togglePan={togglePan} />
				)}

				{probando && (
					<button
						type="button"
						onClick={descargar}
						disabled={!onDescargar || bajando}
						aria-busy={bajando}
						className="ml-2 flex items-center gap-2 rounded border-[1.5px] border-tinta/25 px-4 py-2 font-sora text-tinta transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<Download size={18} aria-hidden />
						<span className="font-medium">
							{bajando ? "Preparando…" : "Descargar imagen"}
						</span>
					</button>
				)}
			</div>

			{/* La salida del editor. Antes decía "Guardar producto" y no tenía
			    onClick: era un botón muerto que prometía algo que no ocurría.

			    ARMANDO UNA PLANTILLA HAY UNA SOLA SALIDA, y es a propósito: la
			    plantilla se pide entera y después, así que "pedir este diseño"
			    aquí llevaría a un pedido de un producto suelto y dejaría la
			    plantilla a medias sin decirlo. */}
			<div className="flex items-center gap-2">
				{plantilla ? (
					<button
						type="button"
						onClick={() => setAgregando(true)}
						className="bg-lima hover:bg-lima-oscuro text-tinta font-medium px-6 py-2 rounded font-sora"
					>
						Agregar a la plantilla
					</button>
				) : (
					<>
						<button
							type="button"
							onClick={() => setAgregando(true)}
							className="border-[1.5px] border-tinta/25 text-tinta font-medium px-5 py-2 rounded font-sora"
						>
							Agregar al carrito
						</button>

						<button
							type="button"
							onClick={() => setPidiendo(true)}
							className="bg-lima hover:bg-lima-oscuro text-tinta font-medium px-6 py-2 rounded font-sora"
						>
							Pedir este diseño
						</button>
					</>
				)}
			</div>
		</div>
	);
}
