"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { pesos } from "@/components/Cuenta/Pedidos";
import {
	type CategoriaPublica,
	catalogoRecordado,
	categoriasRecordadas,
	getCatalogo,
	getCategoriasPublicas,
	type ProductoDeCatalogo,
} from "@/lib/api/catalogo";
import { sinAcentos } from "@/lib/texto";

/**
 * El buscador de la portada.
 *
 * ES EL CTA DEL HERO, no un adorno: en un marketplace quien llega ya sabe qué
 * quiere, y hasta ahora tenía que pulsar un botón, esperar al catálogo y
 * entonces escribir. Esto se salta la pantalla de en medio.
 *
 * ENSEÑA PRODUCTOS DE VERDAD MIENTRAS SE ESCRIBE, y ésa es la diferencia con
 * lo que había. El catálogo entero cabe en una petición y ya está pedido —lo
 * comparte `catalogoRecordado`—, así que filtrar en el navegador es instantáneo
 * y no hace falta ni rebotar ni esperar. Quien ve su producto en la lista entra
 * directo a él en vez de aterrizar en una rejilla a buscarlo otra vez.
 *
 * Y LOS ENSEÑA EN VITRINA, con la foto grande, no en una lista de miniaturas.
 * En personalización el producto ES la foto: entre cuatro playeras de talleres
 * distintos, lo que decide es cómo se ven, y una miniatura de 48 px no daba
 * para eso. Caben menos —cuatro— y a cambio se elige sin entrar a mirar.
 *
 * LAS SUGERENCIAS SON LAS CATEGORÍAS REALES. Antes eran tres frases escritas a
 * mano —"Para una boda", "Graduación", "Logo de mi empresa"— que se buscaban
 * como texto contra el NOMBRE de los productos: ninguna encontraba nada, porque
 * ningún producto se llama "boda". Prometían un atajo y llevaban a una pantalla
 * vacía. Ahora salen del mismo endpoint que el catálogo, así que lo que se
 * ofrece existe por construcción.
 *
 * NO ES `BuscadorCatalogo`, aunque se parezcan. Aquel filtra en vivo una lista
 * ya cargada dentro de `SearchProvider`, que aquí no existe; éste NAVEGA a
 * `/catalogo?q=…`, que es el parámetro que `SearchContext` lee al montar.
 */

/**
 * Cuántos productos caben en la vitrina.
 *
 * SON CUATRO PORQUE SON UNA FILA. Con cinco quedaba una huérfana abriendo una
 * segunda fila, y el desplegable crecía un tercio para enseñar un producto más.
 *
 * EN MÓVIL SE ENSEÑAN DOS, que es la fila de allí. Con las cuatro, el panel
 * medía más que la pantalla: la cuarta baldosa salía cortada por abajo y el pie
 * —"Ver todo el catálogo"— quedaba fuera, sin scroll que lo alcanzara, porque
 * el bloque recorta lo que se sale. Se esconden con CSS y no cortando la lista:
 * el número que dice la tira —"12 resultados"— cuenta lo que hay, no lo que
 * cabe, así que no cambia entre un tamaño y otro.
 */
const MAXIMO = 4;

/** Cuántas de esas cuatro se ven antes de `md`. */
const EN_MOVIL = 2;

/** Cuántas categorías caben en la tira sin que se tenga que arrastrar. */
const CATEGORIAS_EN_LA_TIRA = 4;

/** Claves fijas: con el índice, la rejilla se rehace entera en cada render. */
const ESQUELETOS = ["uno", "dos", "tres", "cuatro"];

/**
 * La misma curva de todo el sitio, escrita aquí y no importada del panel de la
 * cuenta: `Animaciones/Entrada` hace lo mismo. Que la landing dependa de
 * `components/Cuenta` por tres números sería peor que repetirlos.
 */
const CURVA = [0.22, 1, 0.36, 1] as const;

/**
 * La vitrina abre en 0.26 s y cierra en 0.14.
 *
 * SALE MÁS RÁPIDO DE LO QUE ENTRA, como el resto del sitio: lo que se va ya no
 * le interesa a nadie, y aquí encima estorba —tapa medio hero— así que cada
 * milisegundo de más se siente como que no se quiere ir.
 *
 * SE ANIMA EL ALTO, que es justo lo que `components/Cuenta/animaciones` dice
 * que no se haga. Allí son treinta tarjetas cambiando de sección quince veces
 * por sesión y el recálculo de maquetación se ve; aquí son cuatro baldosas una
 * vez, y sobre todo: que la pastilla CREZCA hacia abajo es el diseño entero. Con
 * sólo opacidad, el bloque daría un salto a su alto final y el contenido
 * aparecería dentro — que es volver a las dos cajas que esto vino a quitar.
 */
const ENTRADA = 0.26;
const SALIDA = 0.14;

/**
 * El trozo que coincide, en marca.
 *
 * NO ES ADORNO: en una vitrina de cuatro nombres parecidos, ver DÓNDE encajó lo
 * que escribiste es lo que deja elegir de un vistazo en vez de leer los cuatro.
 *
 * SE COMPARA SIN ACENTOS PERO SE PINTA EL ORIGINAL, así que hay que cortar por
 * los índices del texto normalizado. Eso sólo vale si normalizar no cambia la
 * longitud —con los acentos del español no la cambia, porque cada uno se
 * descompone y se vuelve a quedar en una letra—; si algún día cambia, se pinta
 * el nombre entero sin marcar antes que cortarlo por donde no es.
 */
function Resaltado({ texto, termino }: { texto: string; termino: string }) {
	const plano = sinAcentos(texto);
	const desde = termino ? plano.indexOf(termino) : -1;

	if (desde < 0 || plano.length !== texto.length) return <>{texto}</>;

	return (
		<>
			{texto.slice(0, desde)}
			<mark className="bg-lima/45 text-tinta">
				{texto.slice(desde, desde + termino.length)}
			</mark>
			{texto.slice(desde + termino.length)}
		</>
	);
}

/**
 * Un producto en la vitrina.
 *
 * COPIA EL TRATAMIENTO DE `TarjetaProducto` —cuadrada, recortada, sobre gris,
 * el nombre a 14 y el taller a 12— y no la importa: aquélla trae el plazo, los
 * colores y el corazón, que aquí sobran, y no sabe marcar dónde encajó lo que
 * se escribió. Lo que sí tiene que coincidir es la foto y su encuadre: es la
 * misma pieza que se va a ver en el catálogo un clic después, y si se recorta
 * distinto parecen dos productos.
 *
 * EL NOMBRE VA A DOS LÍNEAS, no truncado como en el catálogo. Ahí la ficha mide
 * 236 px; aquí, 161: "Playera de cuello redondo" se quedaba en "Playera de
 * cuel…" y las cuatro baldosas empezaban igual.
 */
function Baldosa({
	producto,
	termino,
	onIr,
}: {
	producto: ProductoDeCatalogo;
	termino: string;
	onIr: () => void;
}) {
	return (
		/* Al producto, no a la búsqueda: si ya lo estás viendo, mandarte a una
		   rejilla para que lo vuelvas a encontrar es un paso de más. */
		<Link
			data-fila
			href={`/product/${encodeURIComponent(producto.id)}`}
			onClick={onIr}
			className="group flex flex-col gap-2 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-tinta/40 focus-visible:ring-offset-2"
		>
			<span className="block overflow-hidden rounded-2xl border border-tinta/10 bg-gris">
				{producto.images?.[0]?.url ? (
					// biome-ignore lint/performance/noImgElement: export estático
					<img
						src={producto.images[0].url}
						alt=""
						loading="lazy"
						className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
					/>
				) : (
					<span className="block aspect-square w-full" />
				)}
			</span>

			<span className="block min-w-0">
				<span className="line-clamp-2 text-[14px] font-semibold leading-[19px] text-tinta transition-colors group-hover:text-lima-oscuro">
					<Resaltado texto={producto.name} termino={termino} />
				</span>
				{/* EL PRECIO VA PRIMERO, al revés que en `TarjetaProducto`. Allí la
				    ficha mide 236 px y la línea entra entera; aquí mide 161, y
				    "Taller de Prueba · desde $250" se quedaba SIEMPRE en "Taller de
				    Prueba · desde …" — se cortaba justo el dato que decide. Puesto
				    delante, lo que se pierde al truncar es el nombre del taller, que
				    duele menos y además se repite en todas las baldosas. */}
				<span className="block truncate text-[12px] text-tinta/55">
					{producto.basePrice ? `desde ${pesos(producto.basePrice)} · ` : ""}
					{producto.provider ?? "kustto"}
				</span>
			</span>
		</Link>
	);
}

export default function BuscadorHero() {
	const router = useRouter();
	const caja = useRef<HTMLDivElement>(null);
	const idLista = useId();

	/* Se comprueba aquí y no con `<MotionConfig reducedMotion="user">` como el
	   panel de la cuenta: la portada no tiene una raíz donde ponerlo, y
	   `Animaciones/Entrada` ya lo resuelve así. */
	const sinMovimiento = useReducedMotion();

	const [texto, setTexto] = useState("");
	const [abierto, setAbierto] = useState(false);
	const [productos, setProductos] = useState<ProductoDeCatalogo[] | null>(
		catalogoRecordado,
	);
	const [categorias, setCategorias] = useState<CategoriaPublica[]>(
		() => categoriasRecordadas() ?? [],
	);

	useEffect(() => {
		// Los dos fallan en silencio: sin catálogo el buscador sigue navegando, y
		// sin categorías simplemente no hay atajos. Ninguna de las dos cosas
		// justifica un error en la portada.
		getCatalogo()
			.then(setProductos)
			.catch(() => {});
		getCategoriasPublicas()
			.then(setCategorias)
			.catch(() => {});
	}, []);

	/* Cerrar al pulsar fuera. Sin esto el desplegable se queda encima del resto
	   de la portada y hay que borrar el texto para quitarlo. */
	useEffect(() => {
		function fuera(e: MouseEvent) {
			if (!caja.current?.contains(e.target as Node)) setAbierto(false);
		}
		document.addEventListener("mousedown", fuera);
		return () => document.removeEventListener("mousedown", fuera);
	}, []);

	/* NULL es "todavía no ha llegado", no "no hay". La diferencia importa: con
	   la lista vacía por no haber llegado, el desplegable decía "nada coincide",
	   que es falso y además desanima justo al primer visitante — el único que
	   espera, porque `catalogoRecordado` ya lo tiene para todos los demás. */
	const cargando = productos === null;

	const termino = sinAcentos(texto);

	/* TODO lo que coincide, sin recortar. Se cuenta antes de cortar a `MAXIMO`
	   porque el pie promete un número —"ver los 12 resultados"— y contar las
	   cuatro que se enseñan lo convertía en "ver los 4", que no es ninguna
	   promesa. */
	const coincidencias = termino
		? (productos ?? []).filter(
				(p) =>
					sinAcentos(p.name).includes(termino) ||
					sinAcentos(p.provider ?? "").includes(termino),
			)
		: /* Sin escribir nada se enseñan los primeros del catálogo: un desplegable
		     vacío al enfocar no dice que aquí hay algo que mirar. */
			(productos ?? []);

	const encontrados = coincidencias.slice(0, MAXIMO);

	/* Las categorías de la tira. Van aparte de los productos porque contestan
	   otra cosa: "playeras" no es ningún producto —se llaman "Playera de cuello
	   redondo"— pero sí es una categoría entera. Sin esto, la palabra más obvia
	   del catálogo no encontraría nada. */
	const categoriasDeLaTira = (
		termino
			? categorias.filter((c) => sinAcentos(c.name).includes(termino))
			: categorias
	).slice(0, CATEGORIAS_EN_LA_TIRA);

	const hayAlgo = encontrados.length > 0 || categoriasDeLaTira.length > 0;

	/**
	 * Las flechas recorren la vitrina; el tabulador sigue funcionando igual.
	 *
	 * ES UN AÑADIDO, NO EL ÚNICO CAMINO, y por eso no se le pone `role` de
	 * combobox a nada: lo que hay debajo son enlaces de verdad, alcanzables con
	 * el tabulador como cualquier enlace de la página. Las flechas sólo ahorran
	 * pulsaciones a quien ya está escribiendo y no quiere soltar la mano.
	 *
	 * Se buscan los `data-fila` en el DOM en vez de llevar una lista de refs:
	 * las filas son de tres tipos —categorías, baldosas y el pie— y mantener el
	 * orden entre tres arreglos sería inventar un problema.
	 *
	 * VA EN EL CONTENEDOR Y NO EN EL INPUT. Puesto en el input sólo funciona la
	 * primera flecha: en cuanto el foco baja a un enlace, el input deja de
	 * recibir teclas y la lista se queda atascada en la primera fila. En el
	 * contenedor lo recibe todo por burbujeo.
	 */
	function porTeclado(e: React.KeyboardEvent) {
		if (e.key === "Escape") {
			setAbierto(false);
			return;
		}

		if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;

		/* Sólo las que se ven. Las baldosas que sobran en móvil siguen en el DOM
		   —se esconden con CSS—, y `focus()` sobre algo con `display:none` no
		   hace nada: la flecha se quedaba muerta en la tercera pulsación. */
		const filas = Array.from(
			caja.current?.querySelectorAll<HTMLElement>("[data-fila]") ?? [],
		).filter((el) => el.offsetParent !== null);
		if (filas.length === 0) return;

		// La flecha mueve por la vitrina, no el cursor dentro del texto.
		e.preventDefault();
		setAbierto(true);

		const donde = filas.indexOf(document.activeElement as HTMLElement);
		const siguiente =
			e.key === "ArrowDown"
				? donde + 1 >= filas.length
					? 0
					: donde + 1
				: donde <= 0
					? filas.length - 1
					: donde - 1;

		filas[siguiente]?.focus();
	}

	/**
	 * Lo que se le dice a quien no ve la pantalla.
	 *
	 * CUENTA LAS DOS SECCIONES. Contando sólo los productos, buscar "playeras"
	 * anunciaba "nada coincide" mientras el desplegable enseñaba la categoría
	 * Playeras — el anuncio contradecía a la pantalla, que es peor que no
	 * anunciar nada.
	 *
	 * Y CUENTA LO QUE HAY, no lo que cabe: es el mismo número que la tira pinta
	 * a la derecha, así que quien lo oye y quien lo ve oyen y ven lo mismo.
	 *
	 * En singular cuando es uno: "1 resultados" delata que nadie leyó la frase
	 * que escribió.
	 */
	const cuantos = coincidencias.length + categoriasDeLaTira.length;
	const anuncio = cargando
		? "Buscando…"
		: cuantos > 0
			? `${cuantos} ${cuantos === 1 ? "resultado" : "resultados"} para ${texto.trim()}`
			: `Nada coincide con ${texto.trim()}`;

	function buscar(valor: string) {
		const limpio = valor.trim();
		setAbierto(false);
		router.push(
			limpio ? `/catalogo?q=${encodeURIComponent(limpio)}` : "/catalogo",
		);
	}

	return (
		/* biome-ignore lint/a11y/noStaticElementInteractions: no es un control; sólo
		   escucha las flechas para los enlaces de dentro, que sí lo son */
		<div
			ref={caja}
			onKeyDown={porTeclado}
			className="flex w-full flex-col items-center"
		>
			{/* EL HUECO QUE DEJA LA BARRA, con el alto escrito a mano.

			    Tiene que ser así: el bloque de abajo va absoluto para TAPAR las
			    píldoras y el abanico de piezas en vez de empujarlos hacia abajo
			    —enfocar el buscador no puede mover media portada—, y algo que no
			    ocupa sitio no puede reservárselo a sí mismo.

			    El número sale del botón, que es la pieza más alta de la barra: 48
			    en móvil y 52 en escritorio, más los 6 de arriba y de abajo del
			    `p-1.5`, más los 3 del borde de 1.5. */}
			<div className="relative h-[63px] w-full max-w-[720px] md:h-[67px]">
				{/* BARRA Y VITRINA SON UNA SOLA PIEZA.

				    Antes eran dos cajas: la barra con su borde y su sombra, y el
				    desplegable ocho píxeles más abajo con los suyos. Dos formas
				    distintas —una pastilla y un rectángulo— que no se hablaban.
				    Aquí el borde, la sombra y el radio son de ESTE bloque, así que
				    al abrir la pastilla crece hacia abajo y no aparece nada nuevo.

				    El radio de 32 es el que ya tenía la barra por ser pastilla (63
				    de alto ÷ 2), así que cerrado se ve idéntico a antes.

				    `overflow-hidden` es lo que recorta la vitrina contra la curva
				    de abajo; sin él, las baldosas se salen por las esquinas. */}
				<div
					/* La sombra se levanta con la vitrina, y tarda lo mismo que ella en
					   hacerlo: con los 150 ms de fábrica llegaba a su sitio con el
					   desplegable a medio abrir. */
					className={`absolute inset-x-0 top-0 z-50 overflow-hidden rounded-[32px] border-[1.5px] border-tinta/16 bg-white transition-shadow duration-[260ms] focus-within:border-tinta/40 ${
						abierto
							? "shadow-[0_18px_44px_rgba(43,40,18,0.13)]"
							: "shadow-[0_6px_24px_rgba(43,40,18,0.06)]"
					}`}
				>
					{/* `search` envolviendo un `form` de verdad. El elemento es el que
					    marca la región de búsqueda —mejor que un `role="search"` a
					    mano—, y el `form` hace que el Enter busque sin atarlo y que el
					    teclado del teléfono enseñe "buscar" en vez de salto de línea. */}
					<search className="block">
						<form
							onSubmit={(e) => {
								e.preventDefault();
								buscar(texto);
							}}
							className="flex w-full items-center gap-2 p-1.5 pl-5"
						>
							<svg
								width="21"
								height="21"
								viewBox="0 0 24 24"
								fill="none"
								aria-hidden="true"
								className={`shrink-0 transition-colors ${
									abierto ? "text-tinta/70" : "text-tinta/40"
								}`}
							>
								<circle
									cx="11"
									cy="11"
									r="7"
									stroke="currentColor"
									strokeWidth="1.8"
								/>
								<path
									d="m16.5 16.5 4 4"
									stroke="currentColor"
									strokeWidth="1.8"
									strokeLinecap="round"
								/>
							</svg>

							<input
								type="search"
								value={texto}
								onChange={(e) => {
									setTexto(e.target.value);
									setAbierto(true);
								}}
								onFocus={() => setAbierto(true)}
								placeholder="Busca playeras, gorras, totes…"
								aria-label="Busca en el catálogo"
								/* SIN `aria-expanded` NI `aria-controls`, y no es un olvido: ésos
							   son de un `combobox`, y un combobox promete una lista de
							   OPCIONES que se eligen con las flechas. Lo que hay debajo son
							   enlaces a productos, que se recorren con el tabulador como
							   cualquier enlace. Ponerle el papel de combobox a esto sería
							   describir una interacción que no existe; el aviso de que hay
							   resultados lo da la región viva de abajo. */
								autoComplete="off"
								className="min-w-0 flex-1 bg-transparent py-2 text-base text-tinta outline-none placeholder:text-tinta/42 md:text-[17px]"
							/>

							<button
								type="submit"
								className="inline-flex h-12 shrink-0 items-center rounded-full bg-tinta px-6 text-[15px] font-semibold text-lima md:h-[52px] md:px-7 md:text-base"
							>
								Buscar
							</button>
						</form>
					</search>

					{/* `AnimatePresence` con `initial={false}` para que la vitrina no
					    intente entrar en el primer render —nadie la ha abierto todavía—
					    y para que, al cerrarla, siga montada el tiempo que tarda en
					    encogerse. Sin ella `abierto` la desmonta de golpe y la salida
					    no existe: sólo hay entrada. */}
					<AnimatePresence initial={false}>
						{abierto && (
							<motion.div
								key="vitrina"
								id={idLista}
								aria-busy={cargando}
								initial={{ height: 0, opacity: 0 }}
								animate={{ height: "auto", opacity: 1 }}
								/* La salida lleva su propia duración. Puesta en `transition`
								   a secas, framer la usa para las dos y cerrar tardaría lo
								   mismo que abrir. */
								exit={{
									height: 0,
									opacity: 0,
									transition: {
										duration: sinMovimiento ? 0 : SALIDA,
										ease: CURVA,
									},
								}}
								transition={{
									duration: sinMovimiento ? 0 : ENTRADA,
									ease: CURVA,
								}}
								className="overflow-hidden"
							>
								{/* La raya va DENTRO del que se encoge, no en él: en el
								    fotograma final el alto es 0 y un borde de arriba seguiría
								    pintando un pelo de línea bajo la barra ya cerrada. */}
								<div className="border-t border-tinta/12">
									{cargando ? (
										/* ESQUELETOS Y NO "nada coincide". Sin esto, escribir antes de
								   que llegue el catálogo daba el mensaje de vacío —la lista
								   estaba vacía porque no había llegado, no porque no hubiera
								   nada—. Es mentira y encima desanima justo al primer visitante,
								   que es el único que espera. */
										<div className="grid grid-cols-2 gap-x-3 gap-y-4 px-5 py-4 md:grid-cols-4">
											{ESQUELETOS.map((clave, i) => (
												<div
													key={clave}
													className={`flex-col gap-2 ${i >= EN_MOVIL ? "hidden md:flex" : "flex"}`}
												>
													<div className="aspect-square w-full animate-pulse rounded-2xl bg-gris" />
													<div className="h-3.5 w-3/4 animate-pulse rounded bg-gris" />
													<div className="h-3 w-1/2 animate-pulse rounded bg-gris" />
												</div>
											))}
										</div>
									) : hayAlgo ? (
										<>
											{/* LA TIRA DE CATEGORÍAS, en texto y no en píldoras.

									    Las píldoras pesaban lo mismo que las baldosas y competían
									    con ellas; aquí son un renglón que se lee de corrido y deja
									    la vitrina de protagonista.

									    NINGUNA VA MARCADA COMO ACTIVA aunque el sitio pida un
									    subrayado: marcar una prometería que la vitrina de abajo
									    está filtrada por ella, y no lo está — son enlaces que se
									    van al catálogo. El lima aparece al pasar por encima, que
									    es lo único que de verdad pasa.

									    Y van por `?categoria=<id>`, NO por `?q=<nombre>`. La
									    búsqueda de texto compara contra el nombre del producto, y
									    las categorías están en plural: "Playeras" no encuentra
									    "Playera de cuello redondo", así que el atajo llevaría a
									    una pantalla vacía. */}
											{(categoriasDeLaTira.length > 0 || termino) && (
												<div className="flex items-center gap-4 px-5 py-3">
													<div className="flex min-w-0 flex-1 items-center gap-4 overflow-x-auto">
														{categoriasDeLaTira.map((c) => (
															<Link
																key={c.id}
																data-fila
																href={`/catalogo?categoria=${encodeURIComponent(c.id)}`}
																onClick={() => setAbierto(false)}
																className="shrink-0 border-b-2 border-transparent pb-0.5 text-[14px] font-medium text-tinta/60 transition-colors hover:border-lima hover:text-tinta focus-visible:border-lima focus-visible:text-tinta focus-visible:outline-none"
															>
																{c.name}
															</Link>
														))}
													</div>

													{termino && (
														<span className="shrink-0 text-[13px] text-tinta/45">
															{coincidencias.length}{" "}
															{coincidencias.length === 1
																? "resultado"
																: "resultados"}
														</span>
													)}
												</div>
											)}

											{encontrados.length > 0 && (
												<div className="grid grid-cols-2 gap-x-3 gap-y-4 px-5 pb-4 md:grid-cols-4">
													{encontrados.map((p, i) => (
														// El envoltorio está sólo para poder esconderla:
														// puesto en la baldosa, `hidden` pelearía con su
														// `flex`.
														<div
															key={p.id}
															className={i >= EN_MOVIL ? "hidden md:block" : ""}
														>
															<Baldosa
																producto={p}
																termino={termino}
																onIr={() => setAbierto(false)}
															/>
														</div>
													))}
												</div>
											)}

											{/* EL PIE VA SIEMPRE, con o sin algo escrito. Sin él, la
									    vitrina terminaba en el borde curvo del bloque y las
									    baldosas de abajo quedaban recortadas por la esquina; y
									    quien mira sin escribir también necesita una salida al
									    catálogo entero. */}
											{termino ? (
												<button
													data-fila
													type="button"
													onClick={() => buscar(texto)}
													className="flex w-full items-center justify-between gap-3 border-t border-tinta/10 px-6 pb-5 pt-4 text-left text-[14px] font-semibold text-tinta transition-colors hover:bg-gris focus-visible:bg-gris focus-visible:outline-none"
												>
													<span className="truncate">
														{coincidencias.length === 1
															? `Ver el único resultado de “${texto.trim()}”`
															: `Ver los ${coincidencias.length} resultados de “${texto.trim()}”`}
													</span>
													<ArrowRight className="size-4 shrink-0" aria-hidden />
												</button>
											) : (
												<Link
													data-fila
													href="/catalogo"
													onClick={() => setAbierto(false)}
													className="flex w-full items-center justify-between gap-3 border-t border-tinta/10 px-6 pb-5 pt-4 text-left text-[14px] font-semibold text-tinta transition-colors hover:bg-gris focus-visible:bg-gris focus-visible:outline-none"
												>
													<span className="truncate">Ver todo el catálogo</span>
													<ArrowRight className="size-4 shrink-0" aria-hidden />
												</Link>
											)}
										</>
									) : (
										/* Un desplegable vacío sería peor que no abrirlo: se dice qué
								   pasó y se ofrece la salida, que es mirar el catálogo entero.

								   Y no es lo mismo vacío por buscar que vacío porque todavía no
								   hay catálogo: "nada coincide con “”" es lo que salía cuando
								   el endpoint contestaba sin un solo producto. */
										<div className="flex flex-col items-start gap-2 px-5 pb-6 pt-4">
											<p className="text-[14px] text-tinta/65">
												{termino
													? `Nada coincide con “${texto.trim()}”.`
													: "Todavía no hay productos publicados."}
											</p>
											<Link
												data-fila
												href="/catalogo"
												onClick={() => setAbierto(false)}
												className="text-[14px] font-semibold text-tinta underline underline-offset-4"
											>
												Ver todo el catálogo
											</Link>
										</div>
									)}
								</div>
							</motion.div>
						)}
					</AnimatePresence>
				</div>
			</div>

			{/* Que aparezcan resultados es un cambio que no se ve si no se mira la
			    pantalla. La región viva lo cuenta; `polite` para que espere a que
			    el lector termine la frase en curso en vez de cortarla en cada
			    tecla. */}
			<p aria-live="polite" className="sr-only">
				{abierto && termino ? anuncio : ""}
			</p>

			{/* Las categorías que existen de verdad, no frases inventadas.

			    Se repiten en la tira de la vitrina a propósito: aquí son el atajo
			    de quien todavía no ha escrito nada, y allí el de quien ya escribió.
			    Con el desplegable abierto éstas quedan tapadas, así que nunca se
			    ven las dos a la vez. */}
			{categorias.length > 0 && (
				<div className="flex flex-wrap justify-center gap-2 pt-4">
					{categorias.slice(0, 4).map((c) => (
						<Link
							key={c.id}
							href={`/catalogo?categoria=${encodeURIComponent(c.id)}`}
							className="rounded-full border-[1.5px] border-tinta/14 px-4 py-2 text-sm text-tinta/70 transition-colors hover:border-tinta/40 hover:text-tinta"
						>
							{c.name}
						</Link>
					))}
				</div>
			)}
		</div>
	);
}
