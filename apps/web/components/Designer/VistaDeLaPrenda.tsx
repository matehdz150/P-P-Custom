"use client";

import { Download, Minus, Plus } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import type { BandaDeCilindro, FotoRealDePrenda } from "@/lib/api/catalogo";
import {
	exportarArteParaVista,
	exportarColocacion,
	exportarMiniaturaDelArte,
} from "@/lib/designer/exportarArte";
import { componerCilindro } from "@/lib/prenda/cilindro";
import type { MezclaDeTinta } from "@/lib/prenda/componer";
import { esLaser, platearArte } from "@/lib/prenda/laser";
import { referenciaDeGorra } from "@/lib/prenda/mapeoGorra";
import {
	areaEnMockup,
	type MedidaPlayera,
	type RectDeVista,
} from "@/lib/prenda/mapeoPlayera";
import { matrizDeEsquinas, mezclaParaColor } from "@/lib/prenda/perspectiva";

const Playera3D = dynamic(() => import("./Playera3D"), { ssr: false });
const Gorra3D = dynamic(() => import("./Gorra3D"), { ssr: false });

const Taza3D = dynamic(() => import("./Taza3D"), {
	ssr: false,
	loading: () => (
		<div className="flex aspect-square w-full items-center justify-center text-xs text-tinta/50">
			Cargando 3D…
		</div>
	),
});

const Termo3D = dynamic(() => import("./Termo3D"), {
	ssr: false,
	loading: () => (
		<div className="flex aspect-square w-full items-center justify-center text-xs text-tinta/50">
			Cargando 3D…
		</div>
	),
});

/**
 * El modo "Probar": el diseño puesto sobre la prenda de verdad.
 *
 * ES UN MODO DE LA MISMA PANTALLA, NO UN CUADRO ENCIMA. Mirar cómo queda no es
 * una interrupción de un segundo: se compara el frente con la espalda, se
 * prueban tres colores, se vuelve a editar y se mira otra vez. Un modal obliga
 * a cerrarlo para cada una de esas cosas y no deja sitio para el panel de
 * vistas. Por eso el interruptor Editar/Probar que ya estaba arriba a la
 * derecha ahora cambia de verdad lo que ocupa el lienzo.
 *
 * EL LIENZO SIGUE MONTADO DEBAJO. Esto se pinta encima con fondo opaco, no
 * sustituye a los canvas: desmontarlos perdería el diseño, que sólo vive ahí.
 *
 * SE EXPORTA TODO UNA VEZ, AL ENTRAR. Cambiar de vista o de color no vuelve a
 * tocar el lienzo —son las mismas imágenes recolocadas—, así que la rejilla de
 * vistas responde al instante. Volver a "Editar" y entrar otra vez desmonta y
 * monta esto, y ahí sí se vuelve a exportar: lo que se ve es siempre el diseño
 * de ahora.
 */
/** Lo que se está viendo ahora, para que la barra de abajo pueda descargarlo. */
/**
 * Lo que hace falta para volver a componer la vista al descargarla.
 *
 * LLEVA LAS DOS GEOMETRÍAS y quien descargue elige: `banda` manda si está,
 * porque una foto de cilindro no se puede componer con una homografía. Es la
 * misma regla que en `exportarParaPedido`, y por eso está escrita igual en los
 * dos sitios en vez de deducirse de la forma de la plantilla.
 */
export type VistaActual = {
	fotoUrl: string;
	arteUrl: string;
	esquinas: { x: number; y: number }[];
	banda?: BandaDeCilindro;
	mezcla: MezclaDeTinta;
	nombre: string;
};

/**
 * Si una foto trae con qué proyectar encima.
 *
 * LO DICE LA FOTO, no la forma de la plantilla: trae `esquinas` si se marcó
 * como plana y `banda` si se marcó como cilindro. Leerlo de la foto es lo
 * correcto aunque parezca dar igual — una marcada como banda sólo se puede
 * componer como cilindro, aunque alguien cambiara la plantilla después.
 */
function seProyecta(f: FotoRealDePrenda) {
	return !!f.banda || f.esquinas?.length === 4;
}

export default function VistaDeLaPrenda({
	fotosReales,
	sideLabels,
	zoom,
	desplazamiento,
	alArrastrar,
	onAcercar,
	onAlejar,
	onReiniciarZoom,
	onDescargar,
	onVista,
	taza3D,
	termo3D,
	playera3D = false,
	gorra3D = false,
	medidasPlayera,
}: {
	fotosReales: FotoRealDePrenda[];
	sideLabels: Record<string, string>;
	zoom: number;
	desplazamiento: { x: number; y: number };
	alArrastrar: (e: React.PointerEvent) => void;
	/**
	 * El zoom y la descarga, para el teléfono.
	 *
	 * En escritorio viven en `DesignerBottomBar`, que en móvil no se pinta —ahí
	 * la barra de abajo es la de herramientas y se esconde en "Probar"—. Sin
	 * esto, en el teléfono no había forma de acercarse ni de bajar la imagen.
	 * Son opcionales para no obligar a escritorio a pasar lo que ya tiene.
	 */
	onAcercar?: () => void;
	onAlejar?: () => void;
	onReiniciarZoom?: () => void;
	onDescargar?: () => void;
	/**
	 * Avisa de qué combinación está en pantalla.
	 *
	 * El botón de descargar vive en la barra de abajo, que es hermana de esto y
	 * no sabe qué lado ni qué color se está mirando. Sube por aquí en vez de
	 * bajar la barra aquí dentro: la barra tiene que seguir siendo la misma en
	 * los dos modos, con sus botones de carrito y de pedir.
	 */
	onVista: (v: VistaActual | null) => void;
	/** Sólo para tazas identificadas; un termo no debe mostrarse con asa. */
	taza3D?: { anchoCm?: number; altoCm?: number };
	/** Sólo para termos identificados; el modelo lleva tapa y aros de acero. */
	termo3D?: { anchoCm?: number; altoCm?: number };
	playera3D?: boolean;
	/** Sólo para gorras identificadas; el modelo tiene visera. */
	gorra3D?: boolean;
	medidasPlayera?: MedidaPlayera[];
}) {
	const { sides, activeSide, colores, colorPrenda, setColorPrenda, tecnicas } =
		useDesigner();

	/* Qué VISTA está elegida, no qué lado: con varias fotos por lado el lado ya
	   no la identifica. La llave junta lado y URL de la foto. */
	const [elegida, setElegida] = useState<string | null>(null);
	const [referencia] = useState(() =>
		fotosReales.find((f) => f.lado === "wrap" && f.banda),
	);
	const [arte, setArte] = useState<Record<string, string | null>>({});
	const [mockups, setMockups] = useState<Record<string, string | null>>({});
	const [areasPlayera, setAreasPlayera] = useState<Record<string, RectDeVista>>(
		{},
	);
	const [ladoInicial3D] = useState(activeSide);
	const [referenciaGorra] = useState(() => referenciaDeGorra(fotosReales));

	// biome-ignore lint/correctness/useExhaustiveDependencies: corre una sola vez al entrar al modo, a propósito
	useLayoutEffect(() => {
		/* Qué lados hay que exportar. Se recogen primero y se procesan luego,
		   uno por cuadro. */
		const pendientes: string[] = [];
		const areas3D: Record<string, RectDeVista> = {};

		/* Qué lados se van a componer como cilindro. Lo dice la FOTO y no la
		   forma de la plantilla, igual que en `exportarParaPedido`: es el dato
		   más cercano al rasterizador que lo va a usar. */
		const cilindricos = new Set(
			fotosReales.filter((f) => f.banda).map((f) => f.lado),
		);
		if (taza3D || termo3D) cilindricos.add("wrap");
		if (playera3D) {
			cilindricos.add("front");
			cilindricos.add("back");
		}

		for (const [nombre, estado] of Object.entries(sides)) {
			if (!estado.canvas) continue;
			const area = estado.editableAreas[0];
			const background = estado.canvas.backgroundImage;
			if (playera3D && area && background) {
				// useFabricMockup coloca la imagen después de escalarla; aCoords
				// puede seguir cacheado en el origen. Leer la transformada actual,
				// sin alterar el canvas ni incluir el zoom de la cámara del editor.
				const corners = Object.values(background.calcACoords());
				const left = Math.min(...corners.map((p) => p.x));
				const top = Math.min(...corners.map((p) => p.y));
				const normalized = areaEnMockup(area.getBoundingRect(), {
					left,
					top,
					width: Math.max(...corners.map((p) => p.x)) - left,
					height: Math.max(...corners.map((p) => p.y)) - top,
				});
				if (normalized) areas3D[nombre] = normalized;
			}
			pendientes.push(nombre);
		}

		/* El lado que se estaba editando va PRIMERO. Es el que la vista elige al
		   entrar, así que exportarlo antes evita que el primer cuadro se pinte
		   con la lista de vistas vacía y su mensaje de "aquí aparecen los lados
		   que ya tienen diseño". */
		pendientes.sort((a, b) =>
			a === activeSide ? -1 : b === activeSide ? 1 : 0,
		);

		setAreasPlayera(areas3D);

		/* SE EXPORTA UN LADO POR CUADRO, no los cuatro de golpe.

		   Cada lado cuesta un arte de hasta 8 Mpx más una composición de 1600
		   px, y esto vivía en un `useLayoutEffect`: corría ENTERO antes de que
		   el navegador pudiera pintar. Con cuatro caras eso es el bloqueo que
		   se ve al entrar a "Probar" —la pantalla congelada— y además un pico
		   de memoria con las cuatro imágenes vivas a la vez.

		   Repartido por cuadros, el hilo respira entre lado y lado: la vista
		   aparece con la primera cara y las demás entran solas. Un `for` no se
		   puede pausar; esto sí. */
		let vigente = true;
		let siguiente = 0;
		const hechos: Record<string, string | null> = {};

		const exportarUno = () => {
			if (!vigente) return;
			const nombre = pendientes[siguiente++];
			if (nombre === undefined) {
				/* EL LÁSER SE VE PLATEADO, y se tiñe AQUÍ porque este es el único
				   sitio por el que pasan los tres que pintan: el compositor plano,
				   la playera y la gorra. Teñirlo en cada uno sería escribir la
				   misma regla tres veces y que se desincronizara a la primera. */
				const deLaser = Object.keys(hechos).filter(
					(lado) => hechos[lado] && esLaser(tecnicas[lado]),
				);
				if (deLaser.length === 0) return;
				Promise.all(
					deLaser.map(async (lado) => [
						lado,
						await platearArte(hechos[lado] as string),
					]),
				).then((pares) => {
					if (vigente) setArte((p) => ({ ...p, ...Object.fromEntries(pares) }));
				});
				return;
			}
			const estado = sides[nombre];
			if (estado?.canvas) {
				/* EL ARTE GRANDE SÓLO DONDE PAGA. Un cilindro comprime 180° de
				   envoltura en el ancho del cuerpo y amplía el arte casi 4×: ahí
				   la miniatura de 700 px salía borrosa. Una foto plana proyecta el
				   arte casi a su tamaño y no lo necesita. */
				const arte = cilindricos.has(nombre)
					? exportarArteParaVista(estado.canvas, estado.editableAreas)
					: exportarMiniaturaDelArte(estado.canvas, estado.editableAreas);
				const colocacion =
					exportarColocacion(estado.canvas, estado.editableAreas)?.dataUrl ??
					null;
				hechos[nombre] = arte;
				setArte((p) => ({ ...p, [nombre]: arte }));
				setMockups((p) => ({ ...p, [nombre]: colocacion }));
			}
			requestAnimationFrame(exportarUno);
		};
		requestAnimationFrame(exportarUno);

		return () => {
			vigente = false;
		};
	}, []);

	const conDiseno = Object.keys(sides).filter((s) => arte[s]);

	/* UNA ENTRADA POR FOTO, no por lado. Un taller puede subir varias de la
	   misma combinación —la taza de frente, de perfil, en una mano— y todas son
	   vistas que el comprador quiere ver. Un lado con diseño y sin foto de este
	   color entra igual, con `foto` vacía: ahí se cae al mockup con su aviso, y
	   esconderlo dejaría un lado dibujado fuera de la lista sin explicación. */
	type Vista = {
		lado: string;
		foto?: FotoRealDePrenda;
		clave: string;
		i: number;
		modelo3D?: boolean;
	};

	const vistas = conDiseno.flatMap<Vista>((s) => {
		const suyas = fotosReales.filter(
			(f) => f.lado === s && f.color === colorPrenda?.name && seProyecta(f),
		);

		return suyas.length > 0
			? suyas.map((f, i) => ({ lado: s, foto: f, clave: `${s}|${f.url}`, i }))
			: [{ lado: s, foto: undefined, clave: `${s}|mockup`, i: 0 }];
	});
	/* DELANTE DE LAS FOTOS, no detrás. El modelo es la única vista que se puede
	   girar, así que es la que responde a "cómo va a quedar" mirándola por todos
	   lados; las fotos del taller son un lado congelado cada una. Ponerlo al
	   final lo dejaba fuera de la tira en el teléfono, donde hay que arrastrar
	   para llegar al último. */
	if ((taza3D || termo3D) && sides.wrap) {
		vistas.unshift({ lado: "wrap", clave: "wrap|3d", i: 0, modelo3D: true });
	}
	if (playera3D) {
		vistas.unshift({
			lado: ladoInicial3D === "back" ? "back" : "front",
			clave: "playera|3d",
			i: 0,
			modelo3D: true,
		});
	}
	if (gorra3D) {
		vistas.unshift({ lado: "front", clave: "gorra|3d", i: 0, modelo3D: true });
	}

	/* La elegida, con tres caídas: lo que se estaba editando, el modelo si lo
	   hay, y si no, la primera que haya —porque se cambió de color y esa foto no
	   existe para el nuevo—. Entrar a "Probar" y encontrar la lista sin nada
	   seleccionado no dice nada.

	   El modelo va ANTES que `activeSide` a propósito: al entrar sin haber
	   elegido nada, `activeSide` es el lado que se estaba editando y casaría con
	   una foto plana de ese mismo lado, dejando el 3D sin seleccionar aunque
	   esté el primero de la tira. */
	const activa =
		vistas.find((v) => v.clave === elegida) ??
		vistas.find((v) => v.modelo3D) ??
		vistas.find((v) => v.lado === activeSide) ??
		vistas[0];

	const visto = activa?.lado ?? activeSide;
	const foto = activa?.foto;
	const viendo3D = !!activa?.modelo3D;
	// Calibración canónica: seleccionar fotos o colores nunca recoloca el arte.
	const centro3D = referencia?.banda?.centro ?? 0.5;

	const dibujo = arte[visto];
	/** Cuántas vistas tiene el lado que se está mirando. Sólo para nombrarlas. */
	const vistasDelLado = vistas.filter(
		(v) => v.lado === visto && !v.modelo3D,
	).length;
	const etiqueta = sideLabels[visto] ?? visto;

	/* Sólo se puede descargar la composición sobre una foto REAL: el respaldo
	   del mockup ya es una imagen terminada y descargar un dibujo plano no es lo
	   que nadie viene a buscar aquí. */
	useEffect(() => {
		onVista(
			foto && dibujo
				? {
						fotoUrl: foto.url,
						arteUrl: dibujo,
						esquinas: foto.esquinas ?? [],
						banda: foto.banda,
						mezcla: mezclaParaColor(colorPrenda?.hex) as MezclaDeTinta,
						/* El número de la vista entra en el nombre cuando hay varias
						   del mismo lado: si no, descargar la taza de frente y la de
						   perfil daría dos archivos llamados igual y el segundo se
						   guardaría como "(1)". */
						nombre: `${etiqueta}${vistasDelLado > 1 ? `-${(activa?.i ?? 0) + 1}` : ""}-${colorPrenda?.name ?? ""}`,
					}
				: null,
		);
		/* `etiqueta` y no `sideLabels`: ese objeto llega recién creado en cada
		   render del armazón —`product.sideLabels ?? {}`—, así que tenerlo de
		   dependencia dispararía el efecto siempre; y como `onVista` guarda un
		   objeto nuevo cada vez, el render volvería a empezar. Bucle infinito. */
	}, [
		foto,
		dibujo,
		colorPrenda?.hex,
		colorPrenda?.name,
		etiqueta,
		activa?.i,
		vistasDelLado,
		onVista,
	]);

	return (
		/* COLUMNA EN EL TELÉFONO, FILA EN ESCRITORIO. Era `flex` a secas con un
		   panel de 300 px fijos al lado: en una pantalla de 390 quedaban 90 px
		   para la prenda, que es la pantalla entera dedicada a los controles. */
		<div className="absolute inset-0 z-30 flex flex-col bg-hueso-suave md:flex-row">
			{/* Mover con el puntero es una comodidad, no la única vía: el zoom
			    tiene sus botones en la barra de abajo y ésos sí se alcanzan con el
			    teclado. */}
			<div
				onPointerDown={dibujo && !viendo3D ? alArrastrar : undefined}
				className={`relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden p-4 select-none md:p-10 ${
					dibujo && !viendo3D ? "cursor-grab active:cursor-grabbing" : ""
				}`}
			>
				{taza3D && (
					<div className={viendo3D ? "h-full w-full" : "hidden"}>
						<Taza3D
							arte={arte.wrap}
							hex={colorPrenda?.hex}
							zoom={zoom}
							anchoCm={taza3D?.anchoCm}
							altoCm={taza3D?.altoCm}
							centro={centro3D}
							referencia={referencia}
						/>
					</div>
				)}
				{termo3D && (
					<div className={viendo3D ? "h-full w-full" : "hidden"}>
						<Termo3D
							arte={arte.wrap}
							hex={colorPrenda?.hex}
							zoom={zoom}
							anchoCm={termo3D?.anchoCm}
							altoCm={termo3D?.altoCm}
							centro={centro3D}
						/>
					</div>
				)}
				{gorra3D && (
					<div className={viendo3D ? "h-full w-full" : "hidden"}>
						<Gorra3D
							referencia={referenciaGorra}
							artes={arte}
							medidas={medidasPlayera}
							hex={colorPrenda?.hex}
							zoom={zoom}
						/>
					</div>
				)}
				{playera3D && (
					<div className={viendo3D ? "h-full w-full" : "hidden"}>
						<Playera3D
							artes={arte}
							areas={areasPlayera}
							medidas={medidasPlayera}
							hex={colorPrenda?.hex}
							zoom={zoom}
							ladoInicial={ladoInicial3D}
						/>
					</div>
				)}
				{!viendo3D &&
					(dibujo ? (
						/* `translate` ANTES que `scale`: así arrastrar mueve exactamente
					   lo que se arrastra. Al revés, con el zoom al 300 %, el puntero
					   recorrería el triple que la imagen.

					   El escalado NO descoloca el estampado: `Compuesto` mide la foto
					   con `clientWidth`, que ignora las transformadas, así que la foto
					   y el arte se agrandan juntos y el cuadro sigue donde estaba. */
						<div
							style={{
								transform: `translate(${desplazamiento.x}px, ${desplazamiento.y}px) scale(${zoom})`,
								transition: "none",
							}}
							className="w-full max-w-[560px]"
						>
							<Compuesto
								foto={foto}
								mockup={mockups[visto] ?? null}
								arte={dibujo}
								hex={colorPrenda?.hex}
								alt={`Tu diseño en ${sideLabels[visto] ?? visto}`}
								className="w-full"
							/>
						</div>
					) : (
						<p className="max-w-[36ch] text-center text-[15px] leading-[24px] text-tinta/55">
							Todavía no has puesto nada en la prenda. Vuelve a Editar y agrega
							tu diseño.
						</p>
					))}

				{/* EL ZOOM, FLOTANDO Y SÓLO EN EL TELÉFONO. En escritorio está en la
				    barra de abajo; aquí esa barra no existe en "Probar", así que sin
				    esto no había forma de acercarse. Van sobre la prenda porque es lo
				    único que hay en la pantalla, y a 44 px porque es el mínimo que se
				    acierta con el dedo. */}
				{dibujo && onAcercar && (
					<div className="absolute right-3 top-3 flex flex-col gap-2 md:hidden">
						<button
							type="button"
							onClick={onAcercar}
							aria-label="Acercar"
							className="inline-flex size-11 items-center justify-center rounded-full bg-hueso/94 text-tinta shadow-[0_2px_8px_rgba(43,40,18,0.12)]"
						>
							<Plus className="size-5" aria-hidden />
						</button>
						<button
							type="button"
							onClick={onAlejar}
							aria-label="Alejar"
							className="inline-flex size-11 items-center justify-center rounded-full bg-hueso/94 text-tinta shadow-[0_2px_8px_rgba(43,40,18,0.12)]"
						>
							<Minus className="size-5" aria-hidden />
						</button>
						{/* El porcentaje se pulsa para volver al 100 %: acercarse a mirar
						    una costura y no encontrar la vuelta es el final de todo zoom. */}
						<button
							type="button"
							onClick={onReiniciarZoom}
							aria-label="Volver al 100%"
							className="inline-flex size-11 items-center justify-center rounded-full bg-hueso/94 text-[12px] font-semibold tabular-nums text-tinta shadow-[0_2px_8px_rgba(43,40,18,0.12)]"
						>
							{Math.round(zoom * 100)}%
						</button>
					</div>
				)}
			</div>

			{/* HOJA ABAJO EN EL TELÉFONO, COLUMNA A LA DERECHA EN ESCRITORIO.

			    `max-h-[46%]` y no alto libre: con tres o cuatro lados la tira de
			    miniaturas más los colores empujaban la prenda fuera de la pantalla,
			    que es el mismo problema de antes por el otro lado. Con el tope, lo
			    que sobra se scrollea dentro de la hoja y la prenda conserva más de
			    la mitad. */}
			<aside className="flex max-h-[46%] shrink-0 flex-col gap-4 overflow-y-auto rounded-t-2xl border-t border-tinta/12 bg-white px-4 pb-5 pt-2 shadow-[0_-8px_28px_rgba(43,40,18,0.10)] md:max-h-none md:w-[300px] md:gap-6 md:rounded-none md:border-l md:border-t-0 md:px-5 md:py-6 md:shadow-none">
				{/* El tirador. No arrastra —la hoja no se pliega— pero dice que esto
				    es una hoja y no el final de la pantalla, que es lo que hace que
				    alguien intente subirla y descubra que hay más. */}
				<span
					aria-hidden
					className="mx-auto h-1 w-9 shrink-0 rounded-full bg-tinta/20 md:hidden"
				/>

				{/* Qué se está mirando, en una línea. En escritorio lo dicen la
				    miniatura marcada y el swatch con anillo; en el teléfono la tira
				    se scrollea y la marca puede quedar fuera de vista. */}
				<div className="flex shrink-0 items-center justify-between gap-3 md:hidden">
					<span className="min-w-0">
						<span className="block truncate font-display text-[15px] font-bold tracking-[-0.01em] text-tinta">
							{sideLabels[visto] ?? visto}
							{colorPrenda ? ` · ${colorPrenda.name}` : ""}
						</span>
						<span className="block truncate text-[12px] text-tinta/50">
							{viendo3D
								? "Modelo 3D interactivo"
								: foto
									? "Foto real de este taller"
									: "Sobre el mockup"}
						</span>
					</span>

					{onDescargar && foto && (
						<button
							type="button"
							onClick={onDescargar}
							aria-label="Descargar imagen"
							className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-tinta/15 text-tinta/70"
						>
							<Download className="size-5" aria-hidden />
						</button>
					)}
				</div>
				<section className="flex shrink-0 flex-col gap-3">
					<h2 className="hidden font-display text-[17px] font-bold tracking-[-0.02em] text-tinta md:block">
						Vistas
					</h2>

					{vistas.length === 0 ? (
						<p className="text-[13px] leading-[20px] text-tinta/55">
							Aquí aparecen los lados que ya tienen diseño.
						</p>
					) : (
						/* TIRA QUE SE ARRASTRA EN EL TELÉFONO, rejilla en escritorio.
						   Dos columnas en 358 px de hoja dan miniaturas de 171: cabrían,
						   pero con cuatro lados la hoja crece a dos filas y se come la
						   prenda. En tira caben todas sin crecer hacia abajo. */
						<div className="flex gap-3 overflow-x-auto pb-1 md:grid md:grid-cols-2 md:overflow-x-visible md:pb-0">
							{vistas.map((v) => {
								const puesta = v.clave === activa?.clave;
								/* El nombre del lado basta cuando hay una sola foto suya; con
								   varias hace falta distinguirlas, y numerarlas es lo único
								   honesto —el taller no les pone nombre—. */
								const cuantas = vistas.filter(
									(o) => o.lado === v.lado && !o.modelo3D,
								).length;
								const etiqueta = v.modelo3D
									? "Modelo 3D"
									: cuantas > 1
										? `${sideLabels[v.lado] ?? v.lado} ${v.i + 1}`
										: (sideLabels[v.lado] ?? v.lado);

								return (
									<button
										key={v.clave}
										type="button"
										onClick={() => {
											setElegida(v.clave);
										}}
										aria-pressed={puesta}
										/* Ancho fijo y sin encogerse en la tira; en la rejilla de
										   escritorio vuelve a mandar la columna. */
										className="flex w-[86px] shrink-0 flex-col gap-1.5 text-left md:w-auto md:shrink"
									>
										<span
											className={`block overflow-hidden rounded-lg border bg-gris transition-colors ${
												puesta
													? "border-tinta ring-2 ring-tinta/25"
													: "border-tinta/15 hover:border-tinta/40"
											}`}
										>
											{v.modelo3D && gorra3D ? (
												<Gorra3D
													referencia={referenciaGorra}
													miniatura
													artes={arte}
													medidas={medidasPlayera}
													hex={colorPrenda?.hex}
												/>
											) : v.modelo3D && playera3D ? (
												<Playera3D
													miniatura
													artes={arte}
													areas={areasPlayera}
													medidas={medidasPlayera}
													hex={colorPrenda?.hex}
													ladoInicial={ladoInicial3D}
												/>
											) : v.modelo3D && termo3D ? (
												<Termo3D
													miniatura
													arte={arte[v.lado]}
													hex={colorPrenda?.hex}
													anchoCm={termo3D?.anchoCm}
													altoCm={termo3D?.altoCm}
													centro={centro3D}
												/>
											) : v.modelo3D ? (
												<Taza3D
													miniatura
													arte={arte[v.lado]}
													hex={colorPrenda?.hex}
													anchoCm={taza3D?.anchoCm}
													altoCm={taza3D?.altoCm}
													centro={centro3D}
													referencia={referencia}
												/>
											) : (
												<Compuesto
													foto={v.foto}
													mockup={mockups[v.lado] ?? null}
													arte={arte[v.lado]}
													hex={colorPrenda?.hex}
													alt=""
													className="w-full"
												/>
											)}
										</span>
										<span
											className={`truncate text-[13px] ${puesta ? "font-semibold text-tinta" : "text-tinta/60"}`}
										>
											{etiqueta}
										</span>
									</button>
								);
							})}
						</div>
					)}
				</section>

				{colores.length > 0 && (
					<section className="flex shrink-0 flex-col gap-3">
						<h2 className="hidden font-display text-[17px] font-bold tracking-[-0.02em] text-tinta md:block">
							Color
						</h2>

						<div className="flex flex-wrap gap-2.5">
							{colores.map((c) => {
								const activo = c.name === colorPrenda?.name;
								/* El punto se marca cuando ese color NO tiene foto de este
								   lado: así se ve de un vistazo cuáles se pueden mirar de
								   verdad, en vez de descubrirlo color por color. */
								const tieneFoto =
									viendo3D ||
									fotosReales.some(
										(f) =>
											f.lado === visto &&
											f.color === c.name &&
											(!!f.banda || f.esquinas?.length === 4),
									);

								return (
									<button
										key={c.name}
										type="button"
										onClick={() => setColorPrenda(c)}
										aria-pressed={activo}
										title={
											tieneFoto
												? c.name
												: `${c.name} — sin foto real de este lado`
										}
										className={`relative size-9 rounded-full border transition-shadow ${
											activo
												? "border-tinta shadow-[0_0_0_2px_#fff,0_0_0_4px_#2b2812]"
												: "border-tinta/25 hover:border-tinta/50"
										}`}
										style={{ backgroundColor: c.hex || "#f3f3f1" }}
									>
										<span className="sr-only">{c.name}</span>
										{!tieneFoto && (
											<span
												aria-hidden
												className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border border-white bg-tinta/45"
											/>
										)}
									</button>
								);
							})}
						</div>

						<p className="text-[12px] leading-[18px] text-tinta/50">
							{viendo3D
								? "Modelo 3D de referencia. La forma y el acabado pueden variar respecto al producto real."
								: foto
									? "Foto real de este taller."
									: "Este color todavía no tiene foto real de este lado: se enseña sobre el mockup."}
						</p>
					</section>
				)}
			</aside>
		</div>
	);
}

/**
 * Una prenda con el diseño encima, al tamaño que le den.
 *
 * La misma pieza sirve para la vista grande y para las miniaturas del panel, y
 * eso importa: la miniatura tiene que enseñar EXACTAMENTE lo que se va a ver al
 * pulsarla. Con dos implementaciones, una de las dos se queda atrás.
 *
 * Sin foto real cae al mockup, que ya viene compuesto y no necesita proyección.
 */
function Compuesto({
	foto,
	mockup,
	arte,
	hex,
	alt,
	className,
}: {
	foto?: FotoRealDePrenda;
	mockup: string | null;
	arte: string | null;
	hex?: string | null;
	alt: string;
	className?: string;
}) {
	const caja = useRef<HTMLImageElement>(null);
	const [medida, setMedida] = useState({ ancho: 0, alto: 0 });

	/* Se observa el tamaño en vez de leerlo una vez: la imagen llega después del
	   primer render, el panel puede cambiar de ancho y la ventana también. Las
	   esquinas están en fracciones y hay que pasarlas a píxeles con el tamaño
	   que la foto tenga AHORA. */
	useLayoutEffect(() => {
		const img = caja.current;
		if (!img) return;

		const medir = () =>
			setMedida({ ancho: img.clientWidth, alto: img.clientHeight });

		medir();
		const observador = new ResizeObserver(medir);
		observador.observe(img);
		return () => observador.disconnect();
	}, []);

	if (!foto) {
		if (!mockup) return null;
		return (
			// biome-ignore lint/performance/noImgElement: export estático
			<img src={mockup} alt={alt} className={`block ${className ?? ""}`} />
		);
	}

	/* UN CILINDRO NO LO PUEDE HACER CSS. `matrix3d` es proyectiva: proyecta
	   planos. Sobre una taza el arte saldría como calcomanía pegada, sin
	   comprimirse hacia los bordes.

	   Así que aquí se rasteriza UNA VEZ y se enseña el PNG. Se puede porque
	   "Probar" es una vista aparte y no el lienzo de edición: nadie está
	   arrastrando nada mientras se mira. Repintar en cada fotograma sólo haría
	   falta para ver la taza girar, que no es lo que esta pantalla contesta. */
	if (foto.banda) {
		return (
			<Cilindro
				foto={foto}
				banda={foto.banda}
				arte={arte}
				hex={hex}
				alt={alt}
				className={className}
			/>
		);
	}

	const esquinas = (foto.esquinas ?? []).map((e) => ({
		x: e.x * medida.ancho,
		y: e.y * medida.alto,
	}));

	const matriz =
		medida.ancho > 0
			? matrizDeEsquinas(esquinas, medida.ancho, medida.alto)
			: null;

	return (
		<div className={`relative ${className ?? ""}`}>
			{/* biome-ignore lint/performance/noImgElement: export estático */}
			<img
				ref={caja}
				src={foto.url}
				alt={alt}
				className="block max-h-full w-full object-contain"
			/>

			{arte && matriz ? (
				// biome-ignore lint/performance/noImgElement: export estático
				<img
					src={arte}
					alt=""
					/* El origen en la esquina: con el centro, que es lo que CSS hace
					   por defecto, la proyección sale corrida media caja. */
					style={{
						position: "absolute",
						left: 0,
						top: 0,
						width: medida.ancho,
						height: medida.alto,
						transform: matriz,
						transformOrigin: "0 0",
						mixBlendMode: mezclaParaColor(hex),
					}}
				/>
			) : null}
		</div>
	);
}

/**
 * La taza con el diseño, compuesta en un lienzo.
 *
 * SE REHACE AL CAMBIAR EL ARTE, EL COLOR O LA FOTO, y nada más. Componer
 * recorre píxeles: es de las cosas más caras que hace el editor, y dispararla
 * en cada render la volvería un bucle.
 *
 * MIENTRAS COMPONE SE ENSEÑA LA FOTO SOLA, no un hueco ni una rueda. Tarda
 * unas décimas y la prenda ya es la respuesta a medias; parpadear a blanco
 * para volver con lo mismo más el diseño se lee como un fallo.
 */
function Cilindro({
	foto,
	banda,
	arte,
	hex,
	alt,
	className,
}: {
	foto: FotoRealDePrenda;
	banda: BandaDeCilindro;
	arte: string | null;
	hex?: string | null;
	alt: string;
	className?: string;
}) {
	const [compuesta, setCompuesta] = useState<string | null>(null);

	useEffect(() => {
		if (!arte) {
			setCompuesta(null);
			return;
		}

		let vigente = true;
		let anterior: string | null = null;

		componerCilindro({
			fotoUrl: foto.url,
			arteUrl: arte,
			banda,
			mezcla: mezclaParaColor(hex) as MezclaDeTinta,
		})
			.then((png) => {
				if (!png) return;

				// Se descarta si el efecto ya se volvió a disparar: sin esto, una
				// composición lenta puede llegar después de una rápida y pintar el
				// color anterior.
				if (!vigente) return;

				anterior = URL.createObjectURL(png);
				setCompuesta(anterior);
			})
			.catch(() => {});

		return () => {
			vigente = false;
			// El objeto se suelta al cambiar: son varios MB por composición y el
			// navegador no los recoge solo.
			if (anterior) URL.revokeObjectURL(anterior);
		};
	}, [foto.url, banda, arte, hex]);

	return (
		// biome-ignore lint/performance/noImgElement: export estático
		<img
			src={compuesta ?? foto.url}
			alt={alt}
			className={`block max-h-full w-full object-contain ${className ?? ""}`}
		/>
	);
}
