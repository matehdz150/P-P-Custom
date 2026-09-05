"use client";

import { Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { subirFotoDeProducto } from "@/lib/api/proveedores";
import { matrizDeEsquinas, mezclaParaColor } from "@/lib/prenda/perspectiva";
import { Ayuda, Etiqueta } from "./campos";
import MarcarBanda from "./MarcarBanda";
import {
	type Alta,
	BANDA_POR_DEFECTO,
	ESQUINAS_POR_DEFECTO,
	type FotoDePrenda,
	type Punto,
} from "./tipos";

/**
 * Cómo se ve el diseño puesto: una foto por lado y por color.
 *
 * POR QUÉ ES UN PASO Y NO UN CAMPO. Hasta ahora lo único que veía el comprador
 * era el mockup —el dibujo plano de la prenda—, que sirve para colocar y no
 * para decidir. Nadie paga mirando un dibujo. Aquí el taller sube la foto de la
 * prenda de verdad y marca dónde cae lo impreso; con eso el editor puede
 * proyectar el diseño encima.
 *
 * VA DESPUÉS DE TALLAS Y COLORES a propósito: la rejilla se arma con los
 * colores capturados, y antes de ese paso no hay ninguno.
 *
 * ES OPCIONAL, TODO. Un producto sin una sola foto se publica igual y el editor
 * se cae al mockup con un aviso. Obligar a subir dieciséis fotos antes de poder
 * enviar a revisión frenaría el alta de cualquier taller que empieza.
 */
export default function PasoPrenda({
	alta,
	set,
	forma = "plano",
	etiquetas = {},
}: {
	alta: Alta;
	set: <K extends keyof Alta>(k: K, v: Alta[K]) => void;
	/** Los nombres de los lados que puso la plantilla: "Delante", "Envoltura". */
	etiquetas?: Record<string, string>;
	/**
	 * La forma de la plantilla, que decide QUÉ se marca sobre la foto.
	 *
	 * Plano: cuatro esquinas. Cilindro: una banda. No son variantes de lo
	 * mismo, y el paso es el mismo porque la pregunta es la misma —"dónde cae
	 * lo impreso"—; lo que cambia es la respuesta.
	 */
	forma?: "plano" | "cilindro" | "cono";
}) {
	const esCilindro = forma !== "plano";
	const lados = alta.printSides.map((l) => l.sideKey);
	const colores = alta.colors.filter((c) => c.name.trim());

	/* LA IDENTIDAD DE UNA FOTO ES SU URL. Cada subida trae su propio nombre al
	   azar desde S3, así que no hay dos iguales, y eso evita añadirle un id al
	   modelo sólo para poder editarla.

	   Se reemplaza EN SU SITIO y no quitando y volviendo a poner al final: con
	   varias fotos por combinación, mover la editada al final las reordenaría
	   en pantalla mientras se arrastra una esquina. */
	function guardar(foto: FotoDePrenda) {
		const existe = alta.fotosReales.some((f) => f.url === foto.url);
		set(
			"fotosReales",
			existe
				? alta.fotosReales.map((f) => (f.url === foto.url ? foto : f))
				: [...alta.fotosReales, foto],
		);
	}

	function quitar(url: string) {
		set(
			"fotosReales",
			alta.fotosReales.filter((f) => f.url !== url),
		);
	}

	if (lados.length === 0 || colores.length === 0) {
		return (
			<p className="rounded-lg border border-tinta/15 bg-gris p-4 text-sm leading-[22px] text-tinta/70">
				{lados.length === 0
					? "Primero marca en “Cómo se imprime” qué lados puedes imprimir."
					: "Primero captura los colores en “Tallas y colores”: la foto es de una prenda de un color concreto."}
			</p>
		);
	}

	const total = lados.length * colores.length;
	/* Dos cuentas distintas, porque ahora una combinación puede llevar varias
	   fotos: cuántas hay en total, y cuántas combinaciones tienen al menos una
	   —que es lo que dice si falta trabajo—. */
	const conAlguna = new Set(alta.fotosReales.map((f) => `${f.lado}|${f.color}`))
		.size;

	return (
		<div className="flex flex-col gap-7">
			<div className="flex flex-col gap-1">
				<Etiqueta>La prenda de verdad</Etiqueta>
				<Ayuda>
					Sube las fotos de cada lado y color, y marca en cada una dónde cae lo
					impreso. Con eso el cliente ve su diseño sobre la prenda en vez de
					sobre un dibujo. Puedes poner varias de la misma combinación —de
					frente, de perfil, en la mano— y cada una lleva su propia marca,
					porque el estampado cae distinto en cada encuadre. Puedes dejarlo para
					después: sin foto se sigue viendo el mockup.
				</Ayuda>
				<p className="pt-1 text-[13px] text-tinta/55">
					{alta.fotosReales.length}{" "}
					{alta.fotosReales.length === 1 ? "foto" : "fotos"} · {conAlguna} de{" "}
					{total} {total === 1 ? "combinación" : "combinaciones"}
				</p>
			</div>

			{lados.map((lado) => (
				<div key={lado} className="flex flex-col gap-3">
					{/* El nombre que le puso la plantilla, no la clave interna: a nadie
					    le dice nada "WRAP", y menos cuando es el único lado. */}
					<p className="text-[13px] font-semibold text-tinta">
						{etiquetas[lado] ?? lado}
					</p>

					<div className="grid gap-4 md:grid-cols-2">
						{colores.map((color) => (
							<Casilla
								key={`${lado}|${color.name}`}
								lado={lado}
								color={color}
								fotos={alta.fotosReales.filter(
									(f) => f.lado === lado && f.color === color.name,
								)}
								onGuardar={guardar}
								esCilindro={esCilindro}
								onQuitar={quitar}
							/>
						))}
					</div>
				</div>
			))}
		</div>
	);
}

/**
 * Una combinación de lado y color, con TODAS sus fotos.
 *
 * VARIAS POR COMBINACIÓN es lo normal: la misma taza blanca de frente, de
 * perfil y en una mano son tres vistas del mismo lado, y el comprador las va a
 * querer ver todas. Cada una lleva su propia marca —esquinas o banda— porque el
 * estampado cae distinto en cada encuadre; una marca compartida sólo cuadraría
 * en la foto con la que se hizo.
 */
function Casilla({
	lado,
	color,
	fotos,
	onGuardar,
	esCilindro,
	onQuitar,
}: {
	lado: string;
	color: { name: string; hex: string };
	fotos: FotoDePrenda[];
	onGuardar: (f: FotoDePrenda) => void;
	/** Decide con qué geometría nace la foto y cuál se marca encima. */
	esCilindro: boolean;
	onQuitar: (url: string) => void;
}) {
	const input = useRef<HTMLInputElement>(null);
	const [subiendo, setSubiendo] = useState(false);
	const [fallo, setFallo] = useState<string | null>(null);

	async function elegir(archivo: File | undefined) {
		if (!archivo) return;

		setSubiendo(true);
		setFallo(null);

		try {
			const url = await subirFotoDeProducto(archivo);
			onGuardar({
				lado,
				color: color.name,
				url,
				// La marca arranca centrada y el taller la mueve. De tamaño cero
				// obligaría a cazar cuatro puntos invisibles.
				...(esCilindro
					? { banda: BANDA_POR_DEFECTO }
					: { esquinas: ESQUINAS_POR_DEFECTO }),
			});
		} catch (error) {
			setFallo(error instanceof Error ? error.message : "No se pudo subir");
		} finally {
			setSubiendo(false);
		}
	}

	return (
		<div className="flex flex-col gap-3 rounded-xl border border-tinta/12 p-3">
			<div className="flex items-center justify-between gap-3">
				<span className="flex min-w-0 items-center gap-2">
					<span
						className="size-4 shrink-0 rounded-full border border-tinta/20"
						style={{ backgroundColor: color.hex || "#f3f3f1" }}
					/>
					<span className="truncate text-sm font-semibold text-tinta">
						{color.name}
					</span>
				</span>

				{fotos.length > 1 && (
					<span className="shrink-0 text-[12px] text-tinta/50">
						{fotos.length} fotos
					</span>
				)}
			</div>

			{fotos.map((foto, i) => (
				<div key={foto.url} className="flex flex-col gap-2">
					{/* La cabecera de cada foto sólo aparece cuando hay más de una: con
					    una sola, un "Foto 1" es ruido que no distingue nada. */}
					{fotos.length > 1 && (
						<div className="flex items-center justify-between gap-3 border-t border-tinta/10 pt-2">
							<span className="text-[12px] font-semibold text-tinta/60">
								Foto {i + 1}
							</span>
							<button
								type="button"
								onClick={() => onQuitar(foto.url)}
								aria-label={`Quitar la foto ${i + 1} de ${color.name}`}
								className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-tinta/45 transition-colors hover:bg-[rgba(192,57,43,0.08)] hover:text-[#c0392b]"
							>
								<Trash2 className="size-4" aria-hidden />
							</button>
						</div>
					)}

					{esCilindro ? (
						<MarcarBanda
							foto={foto}
							onBanda={(banda) => onGuardar({ ...foto, banda })}
						/>
					) : (
						<MarcarCuadro
							foto={foto}
							hex={color.hex}
							onEsquinas={(esquinas) => onGuardar({ ...foto, esquinas })}
						/>
					)}

					{fotos.length === 1 && (
						<button
							type="button"
							onClick={() => onQuitar(foto.url)}
							className="self-start text-[12px] font-semibold text-tinta/50 underline underline-offset-4 hover:text-[#c0392b]"
						>
							Quitar esta foto
						</button>
					)}
				</div>
			))}

			{/* El botón de subir se queda SIEMPRE, con o sin fotos: es lo que hace
			    que se puedan añadir más. Con fotos es una tira baja para no competir
			    con ellas; sin ninguna, el hueco cuadrado de antes. */}
			<button
				type="button"
				onClick={() => input.current?.click()}
				disabled={subiendo}
				className={
					fotos.length > 0
						? "flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-tinta/25 text-[13px] font-semibold text-tinta/60 transition-colors hover:border-tinta/45 hover:text-tinta disabled:opacity-60"
						: "flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-tinta/25 bg-gris text-tinta/55 transition-colors hover:border-tinta/45 disabled:opacity-60"
				}
			>
				<Upload
					className={fotos.length > 0 ? "size-4" : "size-5"}
					aria-hidden
				/>
				<span className="text-[13px] font-semibold">
					{subiendo
						? "Subiendo…"
						: fotos.length > 0
							? "Añadir otra foto"
							: "Subir foto"}
				</span>
			</button>

			{fallo && (
				<p role="alert" className="text-[13px] text-[#c0392b]">
					{fallo}
				</p>
			)}

			<input
				ref={input}
				type="file"
				accept="image/png,image/jpeg,image/webp"
				className="hidden"
				onChange={(e) => {
					elegir(e.target.files?.[0]);
					// Sin esto, volver a elegir el MISMO archivo no dispara `change`.
					e.target.value = "";
				}}
			/>
		</div>
	);
}

/** El tirador de una esquina. 28 px: se agarra con el dedo y no tapa la foto. */
const TIRADOR = 28;

/** El orden del cuadrilátero, y de paso el nombre que oye un lector de pantalla. */
const ESQUINAS = [
	"arriba a la izquierda",
	"arriba a la derecha",
	"abajo a la derecha",
	"abajo a la izquierda",
];

/**
 * Arrastrar las cuatro esquinas del cuadro impreso.
 *
 * SE GUARDA EN FRACCIONES DE LA FOTO, no en píxeles: aquí se marca sobre una
 * caja de unos 300 px y en el editor se pinta a 700, en el teléfono a lo que
 * quepa. Con píxeles, el cuadro sólo cuadraría a este tamaño.
 *
 * SE USAN EVENTOS DE PUNTERO Y NO DE RATÓN, y con captura: sin `setPointerCapture`
 * el arrastre se corta en cuanto el dedo sale del tirador —que es lo que pasa
 * siempre, porque uno arrastra rápido— y la esquina se queda a medio camino.
 */
function MarcarCuadro({
	foto,
	hex,
	onEsquinas,
}: {
	foto: FotoDePrenda;
	hex: string;
	onEsquinas: (e: Punto[]) => void;
}) {
	const caja = useRef<HTMLDivElement>(null);
	const [medida, setMedida] = useState({ ancho: 0, alto: 0 });

	function medir() {
		const el = caja.current;
		if (el) setMedida({ ancho: el.clientWidth, alto: el.clientHeight });
	}

	function arrastrar(indice: number, evento: React.PointerEvent) {
		evento.preventDefault();
		evento.currentTarget.setPointerCapture(evento.pointerId);

		const el = caja.current;
		if (!el) return;

		const mover = (e: PointerEvent) => {
			const r = el.getBoundingClientRect();
			// Se sujeta al [0,1]: fuera de la foto el cuadro no significa nada, y
			// la Lambda lo rechazaría al guardar.
			const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
			const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));

			onEsquinas(
				(foto.esquinas ?? []).map((p, i) => (i === indice ? { x, y } : p)),
			);
		};

		const soltar = () => {
			window.removeEventListener("pointermove", mover);
			window.removeEventListener("pointerup", soltar);
		};

		window.addEventListener("pointermove", mover);
		window.addEventListener("pointerup", soltar);
	}

	const px = (foto.esquinas ?? []).map((p) => ({
		x: p.x * medida.ancho,
		y: p.y * medida.alto,
	}));

	const matriz =
		medida.ancho > 0 ? matrizDeEsquinas(px, medida.ancho, medida.alto) : null;

	return (
		<div className="flex flex-col gap-2">
			{/* No lleva eventos: el arrastre vive en los tiradores, que sí son
			    botones. Esto es sólo el sistema de coordenadas. */}
			<div ref={caja} className="relative touch-none select-none">
				{/* biome-ignore lint/performance/noImgElement: export estático */}
				<img
					src={foto.url}
					alt=""
					onLoad={medir}
					className="block w-full rounded-lg bg-gris"
				/>

				{/* Una muestra a cuadros dentro del cuadro: enseña la deformación de
				    verdad —si el cuadro está torcido, los cuadritos se tuercen— sin
				    tener que subir un diseño de prueba. */}
				{matriz && (
					<div
						aria-hidden
						style={{
							position: "absolute",
							left: 0,
							top: 0,
							width: medida.ancho,
							height: medida.alto,
							transform: matriz,
							transformOrigin: "0 0",
							mixBlendMode: mezclaParaColor(hex),
							backgroundImage:
								"linear-gradient(45deg, rgba(43,40,18,0.5) 25%, transparent 25%, transparent 75%, rgba(43,40,18,0.5) 75%), linear-gradient(45deg, rgba(43,40,18,0.5) 25%, transparent 25%, transparent 75%, rgba(43,40,18,0.5) 75%)",
							backgroundSize: `${Math.max(8, medida.ancho / 10)}px ${Math.max(8, medida.ancho / 10)}px`,
							backgroundPosition: `0 0, ${medida.ancho / 20}px ${medida.ancho / 20}px`,
						}}
					/>
				)}

				{px.map((p, i) => (
					<button
						key={ESQUINAS[i]}
						type="button"
						onPointerDown={(e) => arrastrar(i, e)}
						aria-label={`Mover la esquina de ${ESQUINAS[i]}`}
						className="absolute rounded-full border-2 border-tinta bg-lima"
						style={{
							width: TIRADOR,
							height: TIRADOR,
							left: p.x - TIRADOR / 2,
							top: p.y - TIRADOR / 2,
							cursor: "grab",
						}}
					/>
				))}
			</div>

			<p className="text-[12px] leading-[18px] text-tinta/55">
				Arrastra las esquinas hasta donde imprimes. Si la prenda va en ángulo,
				tuércelo: los cuadritos se deforman igual que lo hará el diseño.
			</p>
		</div>
	);
}
