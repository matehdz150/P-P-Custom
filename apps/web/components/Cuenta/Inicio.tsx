"use client";

import { ArrowRight, Package, Repeat2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { catalogoRecordado, getCatalogo } from "@/lib/api/catalogo";
import type { DisenoGuardado } from "@/lib/api/cuenta";
import {
	ESTADOS_PEDIDO,
	enlaceParaRediseñar,
	type PedidoDelComprador,
} from "@/lib/api/cuenta";
import { Elemento } from "./animaciones";
import { useDatosDelPanel } from "./datos";
import { fecha, Pastilla, pesos } from "./Pedidos";
import { Cargando } from "./piezas";
import { TarjetaProducto } from "./TarjetaProducto";

/**
 * La portada del panel.
 *
 * CONTESTA DOS PREGUNTAS Y NADA MÁS: dónde está lo que pedí, y qué vuelvo a
 * pedir. Todo lo demás del panel está a un clic en la columna de la izquierda.
 *
 * Antes esto eran tres contadores —pedidos activos, pedidos totales, diseños
 * guardados— y dos tarjetas de acceso. Los contadores no los venía a buscar
 * nadie: quien entra a su cuenta no quiere saber cuántos pedidos ha hecho en su
 * vida, quiere saber dónde está el que hizo el martes. Y las dos tarjetas
 * llevaban a `?s=pedidos` y `?s=catalogo`, que son dos de las seis entradas del
 * menú, repetidas en grande.
 *
 * FAVORITOS NO ESTÁ AQUÍ, a propósito. Sería el mismo error —una sección del
 * menú repetida— y además obligaría a un tercer `getCatalogo()` dentro del
 * panel para resolver los ids en productos.
 *
 * SIN PEDIDOS ES OTRA PANTALLA, `Bienvenida`. Las dos preguntas de arriba no
 * se le pueden contestar a quien no ha pedido nada, así que ahí la portada
 * deja de informar y pasa a explicar.
 */
export default function Inicio() {
	const { pedidos, disenos } = useDatosDelPanel();
	if (!pedidos || !disenos) return <Cargando />;

	/* Un diseño guardado sale siempre de una línea de un pedido —`disenos.ts`
	   lo copia de ahí—, así que sin pedidos no hay diseños y esto es, de hecho,
	   "todavía no ha pedido nada". Se comprueban los dos igual: el día que se
	   pueda guardar un diseño sin pedirlo, esta pantalla no miente. */
	if (pedidos.length === 0 && disenos.length === 0) {
		return <Bienvenida />;
	}

	/* El más nuevo que siga vivo. Si no hay ninguno, el último que hubo: quien
	   entra con todo entregado igual viene a mirar el último, y una pantalla
	   que sólo dice "no tienes nada en curso" le hace buscarlo a mano. */
	const porFecha = [...pedidos].sort((a, b) =>
		b.createdAt.localeCompare(a.createdAt),
	);
	const enCurso = porFecha.find(
		(p) => !["entregado", "cancelado"].includes(p.estado),
	);
	const destacado = enCurso ?? porFecha[0];

	/* Los más pedidos primero: si algo se pidió tres veces, es lo que más
	   probablemente se vuelva a pedir. A igualdad, el más reciente. */
	const repetibles = [...disenos]
		.sort(
			(a, b) =>
				b.vecesPedido - a.vecesPedido ||
				b.ultimoPedido.localeCompare(a.ultimoPedido),
		)
		.slice(0, 4);

	return (
		<div className="flex max-w-[1100px] flex-col gap-9">
			{destacado && <EnCurso pedido={destacado} enCurso={!!enCurso} />}

			{/* SIN DISEÑOS GUARDADOS, EL CATÁLOGO. No es un relleno: aquí abajo se
			    contesta "qué vuelvo a pedir", y con la sección escondida la pantalla
			    se quedaba en la tarjeta oscura y medio metro de blanco.

			    Y NO ES UN CASO RARO, ES EL NORMAL. Un diseño guardado sólo nace
			    ascendiendo una línea de pedido desde "Mis diseños" —el editor no
			    guarda nada, y `services/compradores/rutas/disenos.ts` explica por
			    qué—, así que cualquiera que haya pedido sin bautizar nada cae aquí.
			    O sea, todo el mundo después de su primer pedido. */}
			{repetibles.length > 0 ? (
				<section>
					<Encabezado
						titulo="Vuelve a pedir"
						texto="Tus diseños guardados, listos para pedir otra vez."
						href="/cuenta?s=disenos"
					/>

					<div className="grid grid-cols-2 gap-3 pt-4 md:grid-cols-4">
						{repetibles.map((diseno, i) => (
							<Elemento key={diseno.id} indice={i}>
								<TarjetaDiseno diseno={diseno} />
							</Elemento>
						))}
					</div>
				</section>
			) : (
				<DelCatalogo />
			)}
		</div>
	);
}

/**
 * Cuatro piezas del catálogo, para abrirlas en el editor.
 *
 * LA REJILLA NO ES DECORACIÓN, ES EL ATAJO. Cada ficha abre el editor de ese
 * producto directamente, así que la acción rápida de verdad son los productos
 * y no un botón: mandar sólo a `?s=catalogo` es pedirle a quien acaba de entrar
 * que empiece por buscar.
 *
 * LA USAN DOS PANTALLAS y por eso está aquí fuera: la de estreno —quien no ha
 * pedido nunca— y la portada de quien pidió pero no tiene ningún diseño
 * guardado. Son la misma respuesta a dos vacíos distintos, y tenerla duplicada
 * garantizaba que una de las dos se quedara atrás.
 *
 * TRAE EL CATÁLOGO ELLA MISMA, y no lo recibe por props, porque `Inicio` sale
 * antes por `Cargando` cuando faltan los datos del panel: un `useEffect` allí
 * arriba quedaría por encima de ese `return` y React no admite un hook que a
 * veces se ejecuta y a veces no.
 */
function DelCatalogo() {
	/* Se pinta con lo recordado si otra sección del panel ya lo trajo, y se
	   vuelve a pedir por detrás. */
	const [productos, setProductos] = useState(catalogoRecordado);

	useEffect(() => {
		/* Si el catálogo falla no se dice nada: esto es el añadido de una
		   pantalla que ya funciona sin él, y un aviso de error aquí sería lo
		   primero que ve alguien al entrar a su cuenta sin poder hacer nada al
		   respecto. */
		getCatalogo()
			.then(setProductos)
			.catch(() => {});
	}, []);

	/* Sólo los que tienen foto: una tarjeta sin imagen es un cuadro gris, y de
	   arranque eso no invita a nada. */
	const primeros = (productos ?? [])
		.filter((producto) => producto.images[0]?.url)
		.slice(0, 4);

	if (primeros.length === 0) return null;

	return (
		<section>
			<Encabezado
				titulo="Empieza por aquí"
				texto="Abre cualquiera en el editor. No pides nada todavía."
				href="/cuenta?s=catalogo"
				enlace="Ver todo"
			/>

			<div className="grid grid-cols-2 gap-4 pt-4 md:grid-cols-4 md:gap-5">
				{primeros.map((producto) => (
					<TarjetaProducto key={producto.id} producto={producto} prioritaria />
				))}
			</div>
		</section>
	);
}

/**
 * De qué va esto, en tres pasos.
 *
 * NO SON ENLACES, a propósito. Explican el camino entero; un paso que se puede
 * pulsar invita a saltarse los otros dos, y aquí sólo hay una cosa que hacer
 * ahora. El número va en un punto lima —el mismo que marca el tramo activo en
 * `Progreso`— porque en tinta el texto atenuado se cae por debajo del contraste
 * mínimo y un ordinal que no se lee deja de ordenar nada.
 */
const PASOS = [
	{
		titulo: "Elige tu prenda",
		texto: "Playeras, totes, termos. De talleres que producen en México.",
	},
	{
		titulo: "Ponle tu diseño",
		texto: "Sube tu logo o escribe algo y míralo encima de la prenda.",
	},
	{
		titulo: "Pide las que necesites",
		texto: "Desde una pieza. Te avisamos por correo en cada paso.",
	},
];

/**
 * La portada cuando todavía no hay nada.
 *
 * ES LA PANTALLA DE ESTRENO, no un hueco por rellenar: quien acaba de
 * registrarse aterriza justo aquí. Era un recuadro punteado con una frase y un
 * botón flotando en un panel en blanco, o sea el sitio contestando "no tienes
 * nada" a alguien que todavía no había podido tener nada.
 *
 * OCUPA EL SITIO DEL PEDIDO EN CURSO —tarjeta oscura arriba, mismo radio,
 * mismo hueco debajo— para que la pantalla no se reorganice con el primer
 * pedido: cambia lo que dice la tarjeta y el resto se queda donde estaba.
 *
 * DEBAJO VA `DelCatalogo`, que es el atajo de verdad. El resto del panel
 * —pedidos, diseños, plantillas, favoritos— no se repite aquí en tarjetas:
 * está entero en la columna de la izquierda, y de todas formas vacío.
 */
function Bienvenida() {
	return (
		<div className="flex max-w-[1100px] flex-col gap-9">
			<section className="overflow-hidden rounded-[20px] bg-tinta text-hueso">
				<div className="p-5 md:p-7">
					<p className="text-[12px] font-bold uppercase tracking-[0.12em] text-lima">
						Empecemos
					</p>

					<h2 className="max-w-[18ch] pt-2 font-display text-[26px] font-bold leading-[1.12] tracking-[-0.025em] md:text-[32px]">
						Tu primera prenda empieza en el catálogo
					</h2>

					<p className="max-w-[52ch] pt-2.5 text-[14px] leading-[22px] text-hueso/60 md:text-[15px] md:leading-[24px]">
						Elige el producto, ponle tu diseño y el taller lo produce. Puedes
						guardar el diseño y pedirlo cuando quieras.
					</p>

					<Link
						href="/cuenta?s=catalogo"
						className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-lima px-5 text-[14px] font-semibold text-tinta transition-colors hover:bg-[#9bef56]"
					>
						Ver el catálogo
						<ArrowRight className="size-4" aria-hidden />
					</Link>
				</div>

				<ol className="grid gap-5 border-t border-hueso/12 px-5 py-5 sm:grid-cols-3 md:gap-7 md:px-7 md:py-6">
					{PASOS.map((paso, i) => (
						<li key={paso.titulo} className="flex gap-3">
							<span
								aria-hidden
								className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-lima text-[12px] font-bold text-tinta"
							>
								{i + 1}
							</span>

							<div className="min-w-0">
								<p className="text-[14px] font-semibold">{paso.titulo}</p>
								<p className="pt-0.5 text-[13px] leading-[20px] text-hueso/55">
									{paso.texto}
								</p>
							</div>
						</li>
					))}
				</ol>
			</section>

			<DelCatalogo />
		</div>
	);
}

/**
 * El pedido que importa ahora, en tinta.
 *
 * Es lo único de la pantalla que responde la pregunta con la que se entra, así
 * que es lo único que se lleva el fondo oscuro y el lima. Si todo se pintara
 * igual habría que leerlo entero para saber por dónde empezar.
 */
function EnCurso({
	pedido,
	enCurso,
}: {
	pedido: PedidoDelComprador;
	enCurso: boolean;
}) {
	const estado = ESTADOS_PEDIDO[
		pedido.estado as keyof typeof ESTADOS_PEDIDO
	] ?? { texto: pedido.estado, tono: "gris" as const };

	const primera = pedido.lineas[0];
	const otras = pedido.lineas.length - 1;
	const recoge = pedido.entrega?.metodo === "recoger";
	const cancelado = pedido.estado === "cancelado";
	const rastreo = pedido.guia?.rastreo;

	return (
		<section className="overflow-hidden rounded-[20px] bg-tinta text-hueso">
			<div className="flex flex-col gap-5 p-5 md:flex-row md:items-start md:justify-between md:gap-8 md:p-7">
				<div className="flex min-w-0 items-start gap-4">
					<Miniatura linea={primera} />

					<div className="min-w-0">
						<p className="text-[12px] font-bold uppercase tracking-[0.12em] text-lima">
							{enCurso ? "En curso" : "Tu último pedido"}
						</p>

						<p className="truncate pt-1.5 font-display text-[21px] font-bold tracking-[-0.02em] md:text-[24px]">
							{primera?.producto ?? "Tu pedido"}
							{otras > 0 && (
								<span className="font-medium text-hueso/50">
									{" "}
									y {otras} más
								</span>
							)}
						</p>

						<p className="pt-1 text-[13px] text-hueso/55">
							<span className="font-mono">#{pedido.folio}</span> ·{" "}
							{pedido.piezas} {pedido.piezas === 1 ? "pieza" : "piezas"} ·{" "}
							{pesos(pedido.total)} · {fecha(pedido.createdAt)}
						</p>
					</div>
				</div>

				<div className="flex shrink-0 items-center gap-3">
					<Pastilla tono={estado.tono === "gris" ? "gris" : "lavanda"}>
						{estado.texto}
					</Pastilla>

					<Link
						href={`/cuenta?s=pedido&id=${encodeURIComponent(pedido.id)}`}
						className="inline-flex h-11 items-center gap-2 rounded-full bg-lima px-5 text-[14px] font-semibold text-tinta transition-colors hover:bg-[#9bef56]"
					>
						Ver pedido
						<ArrowRight className="size-4" aria-hidden />
					</Link>
				</div>
			</div>

			{/* Un pedido cancelado no tiene camino que enseñar, y pintarle una
			    barra de progreso a medias sugiere que sigue vivo. */}
			{!cancelado && (
				<div className="px-5 pb-5 md:px-7 md:pb-7">
					<Progreso estado={pedido.estado} recoge={recoge} />
				</div>
			)}

			{/* El número de rastreo es lo que se viene a copiar. Va en la misma
			    tarjeta y en monoespaciada, no escondido en el detalle. */}
			{rastreo && (
				<div className="flex flex-wrap items-center justify-between gap-3 border-t border-hueso/12 px-5 py-4 md:px-7">
					<div className="min-w-0">
						<p className="text-[11px] uppercase tracking-[0.1em] text-hueso/45">
							{pedido.guia?.paqueteria ?? pedido.envio?.paqueteria ?? "Guía"}
						</p>
						<p className="truncate pt-0.5 font-mono text-[15px] font-semibold">
							{rastreo}
						</p>
					</div>

					{pedido.guia?.rastreoUrl && (
						<a
							href={pedido.guia.rastreoUrl}
							target="_blank"
							rel="noreferrer"
							className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-hueso/25 px-4 text-[13px] font-semibold text-hueso transition-colors hover:bg-hueso/10"
						>
							<Package className="size-4" aria-hidden />
							Rastrear
						</a>
					)}
				</div>
			)}
		</section>
	);
}

/**
 * Dónde va el pedido, en cuatro tramos.
 *
 * Es la MISMA figura que llevan los correos (ver `plantillas.ts`): quien abre
 * el panel después de leer el correo reconoce el dibujo en vez de tener que
 * releerlo. Si cambias uno, cambia el otro.
 *
 * CON ENVÍO, `listo` NO adelanta el tramo. Para el taller significa que ya
 * está producido; para quien compró no ha pasado nada todavía —el paquete
 * sigue ahí— y adelantar la barra prometería un movimiento que no ocurrió.
 */
function Progreso({ estado, recoge }: { estado: string; recoge: boolean }) {
	const tramos = recoge
		? ["Recibido", "En producción", "Listo", "Recogido"]
		: ["Recibido", "En producción", "En camino", "Entregado"];

	const indices: Record<string, number> = recoge
		? { nuevo: 0, produccion: 1, listo: 2, entregado: 3 }
		: { nuevo: 0, produccion: 1, listo: 1, enviado: 2, entregado: 3 };

	const activo = indices[estado] ?? 0;

	return (
		<ol className="flex gap-1.5">
			{tramos.map((nombre, i) => {
				const hecho = i < activo;
				const aqui = i === activo;

				return (
					<li key={nombre} className="min-w-0 flex-1">
						<div
							className={`h-[5px] rounded-full ${
								aqui ? "bg-lima" : hecho ? "bg-lima/40" : "bg-hueso/15"
							}`}
						/>
						<p
							className={`truncate pt-2 text-[11px] md:text-[12px] ${
								aqui ? "font-semibold text-hueso" : "text-hueso/45"
							}`}
						>
							{nombre}
						</p>
					</li>
				);
			})}
		</ol>
	);
}

function Encabezado({
	titulo,
	texto,
	href,
	enlace = "Ver todos",
}: {
	titulo: string;
	texto: string;
	href: string;
	/** "Ver todos" no vale para una muestra del catálogo: no son suyos. */
	enlace?: string;
}) {
	return (
		<div className="flex items-end justify-between gap-5">
			<div>
				<h2 className="font-display text-[20px] font-bold tracking-[-0.02em] text-tinta md:text-[22px]">
					{titulo}
				</h2>
				<p className="pt-0.5 text-[13px] text-tinta/55">{texto}</p>
			</div>

			<Link
				href={href}
				className="shrink-0 whitespace-nowrap text-[13px] font-semibold text-tinta underline underline-offset-4 hover:text-tinta/70"
			>
				{enlace}
			</Link>
		</div>
	);
}

/**
 * Un diseño guardado, listo para volver a pedir.
 *
 * `vecesPedido` va a la vista y no escondido: es lo que distingue "esto ya
 * funcionó tres veces" de "esto lo guardé una tarde", y es la información que
 * decide cuál de los cuatro se vuelve a pedir.
 */
function TarjetaDiseno({ diseno }: { diseno: DisenoGuardado }) {
	return (
		<Link
			href={enlaceParaRediseñar(diseno)}
			className="group flex flex-col overflow-hidden rounded-2xl border border-tinta/10 bg-white transition-colors hover:border-tinta/25"
		>
			<div className="relative aspect-square bg-gris">
				{diseno.miniatura ? (
					// biome-ignore lint/performance/noImgElement: export estático
					<img
						src={diseno.miniatura}
						alt=""
						className="size-full object-cover p-3 transition-transform duration-200 group-hover:scale-[1.02]"
					/>
				) : null}

				{diseno.vecesPedido > 1 && (
					<span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-tinta/90 px-2.5 py-1 text-[11px] font-semibold text-lima">
						<Repeat2 className="size-3" aria-hidden />
						{diseno.vecesPedido} veces
					</span>
				)}
			</div>

			<div className="flex flex-col gap-0.5 p-3.5">
				<p className="truncate text-[14px] font-semibold text-tinta">
					{diseno.nombre}
				</p>
				<p className="truncate text-[12px] text-tinta/50">{diseno.producto}</p>
			</div>
		</Link>
	);
}

/** La misma miniatura que la lista de pedidos, en oscuro. */
function Miniatura({
	linea,
}: {
	linea?: { imagen: string | null; producto: string };
}) {
	if (!linea?.imagen) {
		return (
			<div className="size-16 shrink-0 rounded-xl bg-hueso/10 md:size-[72px]" />
		);
	}

	return (
		// biome-ignore lint/performance/noImgElement: export estático
		<img
			src={linea.imagen}
			alt=""
			className="size-16 shrink-0 rounded-xl bg-hueso object-cover p-1.5 md:size-[72px]"
		/>
	);
}
