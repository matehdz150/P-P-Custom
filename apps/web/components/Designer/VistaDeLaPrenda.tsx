"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import type { BandaDeCilindro, FotoRealDePrenda } from "@/lib/api/catalogo";
import {
	exportarColocacion,
	exportarMiniaturaDelArte,
} from "@/lib/designer/exportarArte";
import { componerCilindro } from "@/lib/prenda/cilindro";
import type { MezclaDeTinta } from "@/lib/prenda/componer";
import { matrizDeEsquinas, mezclaParaColor } from "@/lib/prenda/perspectiva";

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

export default function VistaDeLaPrenda({
	fotosReales,
	sideLabels,
	zoom,
	desplazamiento,
	alArrastrar,
	onVista,
}: {
	fotosReales: FotoRealDePrenda[];
	sideLabels: Record<string, string>;
	zoom: number;
	desplazamiento: { x: number; y: number };
	alArrastrar: (e: React.PointerEvent) => void;
	/**
	 * Avisa de qué combinación está en pantalla.
	 *
	 * El botón de descargar vive en la barra de abajo, que es hermana de esto y
	 * no sabe qué lado ni qué color se está mirando. Sube por aquí en vez de
	 * bajar la barra aquí dentro: la barra tiene que seguir siendo la misma en
	 * los dos modos, con sus botones de carrito y de pedir.
	 */
	onVista: (v: VistaActual | null) => void;
}) {
	const { sides, activeSide, colores, colorPrenda, setColorPrenda } =
		useDesigner();

	const [lado, setLado] = useState(activeSide);
	const [arte, setArte] = useState<Record<string, string | null>>({});
	const [mockups, setMockups] = useState<Record<string, string | null>>({});

	// biome-ignore lint/correctness/useExhaustiveDependencies: corre una sola vez al entrar al modo, a propósito
	useLayoutEffect(() => {
		const dibujos: Record<string, string | null> = {};
		const respaldos: Record<string, string | null> = {};

		for (const [nombre, estado] of Object.entries(sides)) {
			if (!estado.canvas) continue;
			dibujos[nombre] = exportarMiniaturaDelArte(
				estado.canvas,
				estado.editableAreas,
			);
			respaldos[nombre] =
				exportarColocacion(estado.canvas, estado.editableAreas)?.dataUrl ??
				null;
		}

		setArte(dibujos);
		setMockups(respaldos);
	}, []);

	const conDiseno = Object.keys(sides).filter((s) => arte[s]);
	/* Si el lado que se estaba editando no lleva nada, se enseña el primero que
	   sí: entrar a "Probar" y encontrar una prenda vacía no dice nada. */
	const visto = arte[lado] ? lado : (conDiseno[0] ?? lado);

	/* QUÉ SE PUEDE PROYECTAR LO DICE LA FOTO, no la forma de la plantilla.

	   La foto trae la geometría con la que se marcó: `esquinas` si el producto
	   es plano, `banda` si es un cilindro. Leerlo de la foto y no de la
	   plantilla es lo correcto aunque parezca dar igual — una foto marcada como
	   banda sólo se puede componer como cilindro, aunque alguien cambiara la
	   forma de la plantilla después.

	   Sin ninguna de las dos no hay nada que proyectar y se cae al mockup con
	   su aviso, igual que un producto sin fotos. */
	const encontrada = fotosReales.find(
		(f) => f.lado === visto && f.color === colorPrenda?.name,
	);

	const foto =
		encontrada?.banda || encontrada?.esquinas?.length === 4
			? encontrada
			: undefined;

	const dibujo = arte[visto];
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
						nombre: `${etiqueta}-${colorPrenda?.name ?? ""}`,
					}
				: null,
		);
		/* `etiqueta` y no `sideLabels`: ese objeto llega recién creado en cada
		   render del armazón —`product.sideLabels ?? {}`—, así que tenerlo de
		   dependencia dispararía el efecto siempre; y como `onVista` guarda un
		   objeto nuevo cada vez, el render volvería a empezar. Bucle infinito. */
	}, [foto, dibujo, colorPrenda?.hex, colorPrenda?.name, etiqueta, onVista]);

	return (
		<div className="absolute inset-0 z-30 flex bg-hueso-suave">
			{/* Mover con el puntero es una comodidad, no la única vía: el zoom
			    tiene sus botones en la barra de abajo y ésos sí se alcanzan con el
			    teclado. */}
			<div
				onPointerDown={dibujo ? alArrastrar : undefined}
				className={`flex min-w-0 flex-1 items-center justify-center overflow-hidden p-6 select-none md:p-10 ${
					dibujo ? "cursor-grab active:cursor-grabbing" : ""
				}`}
			>
				{dibujo ? (
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
						Todavía no has puesto nada en la prenda. Vuelve a Editar y agrega tu
						diseño.
					</p>
				)}
			</div>

			<aside className="flex w-[300px] shrink-0 flex-col gap-6 overflow-y-auto border-l border-tinta/12 bg-white px-5 py-6">
				<section className="flex flex-col gap-3">
					<h2 className="font-display text-[17px] font-bold tracking-[-0.02em] text-tinta">
						Vistas
					</h2>

					{conDiseno.length === 0 ? (
						<p className="text-[13px] leading-[20px] text-tinta/55">
							Aquí aparecen los lados que ya tienen diseño.
						</p>
					) : (
						<div className="grid grid-cols-2 gap-3">
							{conDiseno.map((s) => {
								const suya = fotosReales.find(
									(f) => f.lado === s && f.color === colorPrenda?.name,
								);
								const activa = s === visto;

								return (
									<button
										key={s}
										type="button"
										onClick={() => setLado(s)}
										aria-pressed={activa}
										className="flex flex-col gap-1.5 text-left"
									>
										<span
											className={`block overflow-hidden rounded-lg border bg-gris transition-colors ${
												activa
													? "border-tinta ring-2 ring-tinta/25"
													: "border-tinta/15 hover:border-tinta/40"
											}`}
										>
											<Compuesto
												foto={suya}
												mockup={mockups[s] ?? null}
												arte={arte[s]}
												hex={colorPrenda?.hex}
												alt=""
												className="w-full"
											/>
										</span>
										<span
											className={`truncate text-[13px] ${activa ? "font-semibold text-tinta" : "text-tinta/60"}`}
										>
											{sideLabels[s] ?? s}
										</span>
									</button>
								);
							})}
						</div>
					)}
				</section>

				{colores.length > 0 && (
					<section className="flex flex-col gap-3">
						<h2 className="font-display text-[17px] font-bold tracking-[-0.02em] text-tinta">
							Color
						</h2>

						<div className="flex flex-wrap gap-2.5">
							{colores.map((c) => {
								const activo = c.name === colorPrenda?.name;
								/* El punto se marca cuando ese color NO tiene foto de este
								   lado: así se ve de un vistazo cuáles se pueden mirar de
								   verdad, en vez de descubrirlo color por color. */
								const tieneFoto = fotosReales.some(
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
							{foto
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
