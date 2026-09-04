"use client";

import { ImageOff, X } from "lucide-react";
import { useDesignRules } from "@/components/Designer/hooks/useProductConfig";
import BibliotecaDeImagenes from "@/components/Designer/panels/BibliotecaDeImagenes";

/**
 * El panel de imágenes del editor de escritorio.
 *
 * TODO LO QUE HACE VIVE EN `BibliotecaDeImagenes`, compartido con el móvil:
 * subir y volver a usar lo subido es lo mismo en los dos sitios, y este
 * archivo sólo pone la cabecera del panel lateral.
 *
 * Antes tenía botones de Dropbox y Google Drive que no hacían nada —ni un
 * `onClick`— y los textos en inglés. Un control que promete algo y no lo hace
 * es peor que no tenerlo.
 */
export default function SidebarUploadPanel({ close }: { close: () => void }) {
	const { allowImages } = useDesignRules();

	return (
		<div className="h-full overflow-y-auto p-6">
			<div className="mb-4 flex items-center justify-between">
				<h2 className="text-lg font-semibold">Imágenes</h2>
				<button type="button" onClick={close} aria-label="Cerrar">
					<X size={20} />
				</button>
			</div>

			{allowImages ? (
				<BibliotecaDeImagenes />
			) : (
				<div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center text-neutral-500">
					<ImageOff size={36} />
					<p className="font-medium text-neutral-700">
						Este producto no permite imágenes
					</p>
					<p className="text-sm">
						El proveedor lo configuró para personalizarse sólo con texto.
					</p>
				</div>
			)}
		</div>
	);
}
