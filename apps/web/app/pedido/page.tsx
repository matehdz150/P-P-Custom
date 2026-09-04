"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useComprador } from "@/Contexts/CompradorContext";
import Footer from "@/components/Kustto/Footer";
import Header from "@/components/Kustto/Header";
import DetalleDePedido from "@/components/Pedido/Detalle";
import { getMiPedido } from "@/lib/api/cuenta";
import {
	type CompraEnSeguimiento,
	esCompra,
	type PedidoEnSeguimiento,
	seguirPedido,
} from "@/lib/api/pedir";

/**
 * El seguimiento del pedido, para quien llega DE FUERA.
 *
 * SE PUEDE LLEGAR POR DOS CAMINOS y los dos enseñan lo mismo:
 *
 *   CON SESIÓN — se pide por `/cuenta/pedidos/:id`, que comprueba que el
 *   pedido sea tuyo comparando el correo del token. No hace falta el token del
 *   enlace.
 *
 *   SIN SESIÓN — con el `?token=` que va en el enlace del correo. Pedir no
 *   exige cuenta, así que este camino no puede desaparecer.
 *
 * Cuando hay sesión se prefiere la sesión aunque venga token: el token caduca
 * conceptualmente —se comparte, se reenvía— y la sesión es quien de verdad es.
 *
 * QUIEN YA ESTÁ DENTRO DEL PANEL no pasa por aquí: allí el mismo detalle se
 * abre sin salir del dashboard. Los dos pintan `<DetalleDePedido>`, que es lo
 * que garantiza que sean la misma pantalla y no dos que se parecen.
 */

function Seguimiento() {
	/* El id va en la query y no en la ruta a propósito.

	   El sitio se publica como export estático, y una ruta dinámica necesita
	   conocer todas sus URLs en el build. Los pedidos se crean después de
	   desplegar, así que `/pedido/[id]` no se puede pre-renderizar nunca. Aquí
	   no se pierde nada: el enlace es privado y no tiene que indexarse. */
	const parametros = useSearchParams();
	const id = parametros.get("id") ?? "";
	const token = parametros.get("token") ?? "";

	const { comprador, cargando: cargandoSesion } = useComprador();
	const [pedido, setPedido] = useState<
		PedidoEnSeguimiento | CompraEnSeguimiento | null
	>(null);
	const [fallo, setFallo] = useState<string | null>(null);
	const [sinAcceso, setSinAcceso] = useState(false);

	useEffect(() => {
		// Esperar a saber si hay sesión: sin esto, quien llega con su cuenta
		// abierta vería el error de "enlace incompleto" un instante antes de que
		// cargue, y ya habría pulsado "volver".
		if (cargandoSesion) return;

		if (!id) {
			setFallo("A este enlace le falta el pedido.");
			return;
		}

		/* CON TOKEN MANDA EL TOKEN, aunque haya sesión abierta.

		   No es una preferencia: el enlace que se entrega al pagar lleva el id
		   de la COMPRA, y la ruta de la cuenta sólo sabe de pedidos —respondía
		   "no encontramos ese pedido en tu cuenta" justo después de pagar—. La
		   pública resuelve las dos cosas. La de la cuenta queda de respaldo,
		   para enlaces viejos a los que ya se les cayó el token. */
		if (token) {
			seguirPedido(id, token)
				.then(setPedido)
				.catch((e) => {
					if (comprador) {
						getMiPedido(id)
							.then(setPedido)
							.catch(() =>
								setFallo(
									"No encontramos ese pedido en tu cuenta. Si lo hiciste con otro correo, abre el enlace que te llegó.",
								),
							);
						return;
					}

					setFallo(
						e instanceof Error ? e.message : "No pudimos abrir tu pedido",
					);
				});
			return;
		}

		if (comprador) {
			getMiPedido(id)
				.then(setPedido)
				.catch(() =>
					setFallo(
						"No encontramos ese pedido en tu cuenta. Si lo hiciste con otro correo, abre el enlace que te llegó.",
					),
				);
			return;
		}

		if (!token) {
			// Sin sesión y sin token no hay nada que comprobar. Antes esto decía
			// "abre el que te llegó por correo" y punto; entrar a la cuenta es la
			// otra salida, y para quien ya la tiene es la buena.
			setSinAcceso(true);
			return;
		}
	}, [id, token, comprador, cargandoSesion]);

	if (sinAcceso) {
		return (
			<Centrado
				titulo="Entra para ver este pedido"
				texto="Este enlace no trae la clave de seguimiento. Si el pedido es tuyo, entra a tu cuenta y ahí está."
			>
				<Link
					href={`/cuenta/entrar?volver=${encodeURIComponent(`/pedido?id=${id}`)}`}
					className="inline-flex h-12 items-center rounded-lg bg-tinta px-5 text-[15px] font-semibold text-lima"
				>
					Entrar a mi cuenta
				</Link>
				<Link
					href="/catalogo"
					className="inline-flex h-12 items-center rounded-lg border-[1.5px] border-tinta px-5 text-[15px] font-semibold text-tinta"
				>
					Ir al catálogo
				</Link>
			</Centrado>
		);
	}

	if (fallo) {
		return (
			<Centrado titulo="No pudimos abrir este pedido" texto={fallo}>
				<Link
					href={comprador ? "/cuenta" : "/catalogo"}
					className="inline-flex h-12 items-center rounded-lg border-[1.5px] border-tinta px-5 text-[15px] font-semibold text-tinta"
				>
					{comprador ? "Ver mis pedidos" : "Ir al catálogo"}
				</Link>
			</Centrado>
		);
	}

	if (!pedido) {
		return (
			<main className="mx-auto w-full max-w-[760px] flex-1 px-5 py-16">
				<div className="h-7 w-40 animate-pulse rounded bg-gris" />
				<div className="mt-4 h-10 w-72 animate-pulse rounded bg-gris" />
				<div className="mt-8 h-24 animate-pulse rounded-xl bg-gris" />
			</main>
		);
	}

	return (
		<main className="mx-auto w-full max-w-[1120px] flex-1 px-5 py-8 md:py-12">
			{comprador && (
				<Link
					href="/cuenta"
					className="mb-4 inline-flex items-center gap-1.5 text-[14px] font-medium text-tinta/60 hover:text-tinta"
				>
					<ArrowLeft className="size-4" aria-hidden />
					Mis pedidos
				</Link>
			)}

			{/* UNA COMPRA CON VARIOS TALLERES SON VARIOS PEDIDOS, y se enseñan
			    como tales: cada taller produce y entrega lo suyo por su cuenta,
			    así que cada parte tiene su estado, su envío y su guía. Fundirlas
			    en una sola ficha obligaría a inventar un estado común que no
			    existe —¿qué es "enviado" cuando una parte salió y la otra no?—.
			    Con un solo taller la API ya devuelve la parte sola, así que este
			    camino sólo se pisa cuando de verdad hay varias. */}
			{esCompra(pedido) ? (
				<>
					<div className="pb-6">
						<p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-tinta/45">
							Compra {pedido.folio}
						</p>
						<h1 className="pt-1 font-display text-[26px] font-semibold tracking-[-0.032em] text-tinta">
							{pedido.partes.length} pedidos, uno por taller
						</h1>
						<p className="pt-1.5 text-[15px] leading-[24px] text-tinta/65">
							Cada taller produce y entrega lo suyo, así que cada parte avanza a
							su ritmo y tiene su propio seguimiento.
						</p>
					</div>

					<div className="flex flex-col gap-10">
						{pedido.partes.map((parte) => (
							<section key={parte.id}>
								<DetalleDePedido
									pedido={parte}
									conCuenta={Boolean(comprador)}
								/>
							</section>
						))}
					</div>
				</>
			) : (
				<DetalleDePedido pedido={pedido} conCuenta={Boolean(comprador)} />
			)}
		</main>
	);
}

function Centrado({
	titulo,
	texto,
	children,
}: {
	titulo: string;
	texto: string;
	children?: React.ReactNode;
}) {
	return (
		<main className="mx-auto w-full max-w-[560px] flex-1 px-5 py-20 text-center">
			<h1 className="font-display text-[26px] font-semibold tracking-[-0.032em] text-tinta">
				{titulo}
			</h1>
			<p className="pt-2 text-[15px] leading-[25px] text-tinta/70">{texto}</p>
			<div className="flex flex-wrap justify-center gap-3 pt-7">{children}</div>
		</main>
	);
}

/**
 * `useSearchParams` obliga a un límite de Suspense.
 *
 * Al construir el sitio estático, Next pre-renderiza esta página sin conocer
 * la query —no existe hasta que alguien abre su enlace—, y sin el Suspense el
 * build falla. El envoltorio es lo que le permite dejar el hueco y rellenarlo
 * en el navegador.
 */
export default function Pagina() {
	return (
		<div className="flex min-h-screen flex-col bg-hueso text-tinta">
			<Header />
			<Suspense
				fallback={
					<main className="mx-auto w-full max-w-[760px] flex-1 px-5 py-16 text-tinta/60">
						Abriendo tu pedido…
					</main>
				}
			>
				<Seguimiento />
			</Suspense>
			<Footer />
		</div>
	);
}
