"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import DetalleDePedido from "@/components/Pedido/Detalle";
import {
	ErrorCuenta,
	getMiPedido,
	type PedidoDelComprador,
} from "@/lib/api/cuenta";
import { useDatosDelPanel } from "./datos";
import { Aviso, Cargando } from "./piezas";

/**
 * Un pedido, abierto SIN salir del panel.
 *
 * Antes "Ver detalle" mandaba a `/pedido?id=…`, que es la página pública: se
 * perdía el sidebar, aparecía la cabecera del sitio y volver era el botón de
 * atrás del navegador. Para quien ya está dentro del dashboard eso es salirse
 * de la aplicación para mirar algo suyo.
 *
 * La página pública NO desaparece: es la que abre quien pidió sin cuenta desde
 * el enlace de su correo. Las dos pintan el mismo `<DetalleDePedido>`.
 *
 * EL PEDIDO SE BUSCA PRIMERO EN LO QUE YA HAY. La lista del panel trae los
 * pedidos completos, así que abrir uno normalmente no cuesta ni una petición;
 * sólo se pide a la API si se llegó aquí por una URL pegada.
 */
export default function DetalleEnPanel() {
	const params = useSearchParams();
	const id = params.get("id") ?? "";

	const { pedidos } = useDatosDelPanel();
	const yaLoTenemos = pedidos?.find((p) => p.id === id) ?? null;

	const [pedido, setPedido] = useState<PedidoDelComprador | null>(yaLoTenemos);
	const [fallo, setFallo] = useState<string | null>(null);

	useEffect(() => {
		if (!id) {
			setFallo("Falta decir qué pedido quieres ver.");
			return;
		}

		if (yaLoTenemos) {
			setPedido(yaLoTenemos);
			return;
		}

		// Todavía puede estar cargando la lista: entonces no se pide nada, que
		// llegará sola. Sólo se va a la API cuando la lista ya llegó y no está.
		if (pedidos === null) return;

		getMiPedido(id)
			.then(setPedido)
			.catch((error) =>
				setFallo(
					error instanceof ErrorCuenta && error.hayQueEntrar
						? "Tu sesión caducó. Vuelve a entrar."
						: "No encontramos ese pedido en tu cuenta.",
				),
			);
	}, [id, yaLoTenemos, pedidos]);

	if (fallo) {
		return (
			<div className="flex flex-col gap-4">
				<Aviso texto={fallo} />
			</div>
		);
	}

	if (!pedido) return <Cargando />;

	/* Repetir se ofrece cuando el pedido ya llegó a su fin, igual que en la
	   lista. Aquí importa más: es donde alguien mira lo que pidió el mes
	   pasado y decide que quiere lo mismo. */
	const sePuedeRepetir =
		pedido.estado === "entregado" ||
		pedido.estado === "enviado" ||
		pedido.estado === "cancelado";

	return (
		<div className="max-w-[1180px]">
			<DetalleDePedido
				pedido={pedido}
				conCuenta
				accionTrasTotal={
					sePuedeRepetir ? (
						<Link
							href={`/cuenta?s=repetir&id=${encodeURIComponent(pedido.id)}`}
							className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border-[1.5px] border-tinta bg-transparent px-4 text-[15px] font-semibold text-tinta transition-colors hover:bg-tinta hover:text-lima"
						>
							<RotateCcw className="size-4" aria-hidden />
							Volver a pedir
						</Link>
					) : undefined
				}
			/>
		</div>
	);
}
