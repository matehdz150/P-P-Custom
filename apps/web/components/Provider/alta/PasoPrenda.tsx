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

	function guardar(foto: FotoDePrenda) {
		const resto = alta.fotosReales.filter(
			(f) => !(f.lado === foto.lado && f.color === foto.color),
		);
		set("fotosReales", [...resto, foto]);
	}

	function quitar(lado: string, color: string) {
		set(
			"fotosReales",
			alta.fotosReales.filter((f) => !(f.lado === lado && f.color === color)),
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

	const puestas = alta.fotosReales.length;
	const total = lados.length * colores.length;

	return (
		<div className="flex flex-col gap-7">
			<div className="flex flex-col gap-1">
				<Etiqueta>La prenda de verdad</Etiqueta>
				<Ayuda>
					Sube una foto por cada lado y color, y arrastra las cuatro esquinas
					hasta el cuadro donde imprimes. Con eso el cliente ve su diseño sobre
					la prenda en vez de sobre un dibujo. Puedes dejarlo para después: sin
					foto se sigue viendo el mockup.
				</Ayuda>
				<p className="pt-1 text-[13px] text-tinta/55">
					{puestas} de {total} {total === 1 ? "combinación" : "combinaciones"}
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
								foto={alta.fotosReales.find(
									(f) => f.lado === lado && f.color === color.name,
								)}
								onGuardar={guardar}
								esCilindro={esCilindro}
								onQuitar={() => quitar(lado, color.name)}
							/>
						))}
					</div>
				</div>
			))}
		</div>
	);
}

/** Una combinación de lado y color: la foto, o el hueco para subirla. */
function Casilla({
	lado,
	color,
	foto,
	onGuardar,
	esCilindro,
	onQuitar,
}: {
	lado: string;
	color: { name: string; hex: string };
	foto?: FotoDePrenda;
	onGuardar: (f: FotoDePrenda) => void;
	/** Decide con qué geometría nace la foto y cuál se marca encima. */
	esCilindro: boolean;
	onQuitar: () => void;
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
				// El cuadro arranca centrado en el pecho y el taller lo mueve. Un
				// cuadro de tamaño cero obligaría a cazar cuatro puntos invisibles.
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
		<div className="flex flex-col gap-2.5 rounded-xl border border-tinta/12 p-3">
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

				{foto && (
					<button
						type="button"
						onClick={onQuitar}
						aria-label={`Quitar la foto de ${color.name}`}
						className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-tinta/45 transition-colors hover:bg-[rgba(192,57,43,0.08)] hover:text-[#c0392b]"
					>
						<Trash2 className="size-[17px]" aria-hidden />
					</button>
				)}
			</div>

			{foto ? (
				esCilindro ? (
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
				)
			) : (
				<button
					type="button"
					onClick={() => input.current?.click()}
					disabled={subiendo}
					className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-tinta/25 bg-gris text-tinta/55 transition-colors hover:border-tinta/45 disabled:opacity-60"
				>
					<Upload className="size-5" aria-hidden />
					<span className="text-[13px] font-semibold">
						{subiendo ? "Subiendo…" : "Subir foto"}
					</span>
				</button>
			)}

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
