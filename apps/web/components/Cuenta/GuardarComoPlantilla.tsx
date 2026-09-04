"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
	crearPlantilla,
	type ItemDePlantilla,
	type PedidoDelComprador,
} from "@/lib/api/cuenta";
import NombrarDiseno from "./NombrarDiseno";

/**
 * Convierte un pedido en plantilla.
 *
 * ES DE DONDE NACEN LAS PLANTILLAS, y no del carrito. El arte que se puede
 * volver a pedir vive en `medios/pedidos/`, que es duradero; el del carrito
 * está en `carritos/`, que caduca a los 30 días. Una plantilla armada desde el
 * carrito habría quedado muda al mes.
 *
 * SE LLEVA LAS CANTIDADES DEL PEDIDO como punto de partida, no como condena:
 * se editan después. Es lo que distingue una plantilla de repetir — repetir
 * clona, la plantilla es una receta que se ajusta.
 *
 * Reutiliza el cuadro de nombrar diseños: es la misma operación —ponerle
 * nombre a algo para encontrarlo el mes que viene— y dos cuadros parecidos se
 * habrían separado con el tiempo.
 */
export default function GuardarComoPlantilla({
	abierto,
	onAbrir,
	pedido,
}: {
	abierto: boolean;
	onAbrir: (v: boolean) => void;
	pedido: PedidoDelComprador;
}) {
	const [guardada, setGuardada] = useState(false);

	async function guardar(nombre: string): Promise<string | null> {
		const items: ItemDePlantilla[] = pedido.lineas.map((linea) => ({
			productoId: linea.productoId ?? "",
			// El origen es lo que le da arte: de aquí sale al cargarla.
			origen: { pedidoId: pedido.id, lineaId: linea.id },
			colorPrenda: linea.colorPrenda ?? null,
			tallas: linea.tallas,
			nombre: linea.producto ?? null,
		}));

		try {
			await crearPlantilla({ nombre, items });
			setGuardada(true);
			toast.success("Plantilla guardada", {
				description: "La tienes en Plantillas, lista para volver a pedir.",
				action: {
					label: "Verla",
					onClick: () => {
						window.location.href = "/cuenta?s=plantillas";
					},
				},
			});
			return null;
		} catch (error) {
			return error instanceof Error
				? error.message
				: "No pudimos guardar la plantilla.";
		}
	}

	const piezas = pedido.lineas.reduce(
		(n, l) => n + l.tallas.reduce((s, t) => s + t.piezas, 0),
		0,
	);

	return (
		<NombrarDiseno
			abierto={abierto && !guardada}
			onAbrir={onAbrir}
			titulo="Guardar como plantilla"
			explica="Guarda esta combinación de productos para volver a pedirla cuando quieras, ajustando las cantidades."
			valorInicial={`Pedido #${pedido.folio}`}
			imagen={pedido.lineas[0]?.arte?.[0]?.colocacion ?? null}
			producto={`${pedido.lineas.length} productos · ${piezas} piezas`}
			textoBoton="Guardar plantilla"
			onGuardar={guardar}
		/>
	);
}
