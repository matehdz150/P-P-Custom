"use client";

import { ContenidoDeInfo } from "@/components/Designer/DesignerSidebar/panels/InfoPanel";

/**
 * La ficha del producto en el teléfono.
 *
 * ES LA PIEZA DE ESCRITORIO, no una versión para móvil. Lo que había aquí
 * estaba escrito a mano y describía otro producto: una camiseta de Comfort
 * Colors con precios en dólares y un proveedor que no es el nuestro. No se
 * actualizaba porque no leía nada — daba igual qué producto estuvieras
 * diseñando, decía siempre lo mismo.
 *
 * No lleva cabecera: el drawer que la abre ya pone su propio título.
 */
export default function InfoPanelMobile() {
	return (
		<div className="font-sora bg-white pb-6">
			<ContenidoDeInfo />
		</div>
	);
}
