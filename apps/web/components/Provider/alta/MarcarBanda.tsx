"use client";

import { useRef, useState } from "react";
import type { BandaDeCilindro, FotoDePrenda } from "./tipos";

/**
 * Dónde cae lo impreso sobre una taza o un termo.
 *
 * ES EL GEMELO DE `MarcarCuadro`, con otra geometría. Allí se marcan cuatro
 * esquinas porque una playera es un plano; aquí se marca una BANDA porque un
 * cilindro sólo enseña 180° de su envoltura, comprimidos hacia los bordes. Con
 * cuatro esquinas el estampado saldría como calcomanía pegada.
 *
 * SON CUATRO BORDES Y DOS NÚMEROS, no ocho puntos sueltos:
 *
 *   - **izquierda / derecha**: dónde empieza y acaba el cuerpo visible. NO el
 *     asa: el asa no lleva estampado.
 *   - **arriba / abajo**: el alto de la banda imprimible.
 *   - **bombeo**: el filo de una taza de frente es una elipse, no una recta.
 *     Admite negativo, para una foto tomada desde abajo.
 *   - **centro**: qué punto de la envoltura mira a la cámara. Se mueve cuando
 *     el asa queda a un lado y lo que se ve no es el centro del arte.
 *
 * LAS GUÍAS VERTICALES NO SON DECORACIÓN. Se dibujan en las posiciones que de
 * verdad ocupan columnas repartidas por igual en la envoltura, así que se ven
 * apretarse hacia los bordes. Es la única forma de comprobar de un vistazo que
 * la banda cubre el cuerpo y no se pasa: si las guías del borde caen sobre el
 * fondo, sobra banda.
 */
export default function MarcarBanda({
	foto,
	onBanda,
}: {
	foto: FotoDePrenda;
	onBanda: (b: BandaDeCilindro) => void;
}) {
	const caja = useRef<HTMLDivElement>(null);
	const banda = foto.banda;

	const [medida, setMedida] = useState({ ancho: 0, alto: 0 });

	function medir() {
		const el = caja.current;
		if (el) setMedida({ ancho: el.clientWidth, alto: el.clientHeight });
	}

	if (!banda) return null;

	/**
	 * El arrastre va en `window` y no en el tirador.
	 *
	 * Con los eventos en el propio tirador, basta salirse un píxel —y uno se
	 * sale siempre, porque se arrastra rápido— para que el borde se quede a
	 * medio camino. Es lo mismo que hace `MarcarCuadro`.
	 */
	function arrastrar(campo: keyof BandaDeCilindro, evento: React.PointerEvent) {
		evento.preventDefault();

		const el = caja.current;
		if (!el) return;

		const horizontal = campo === "izquierda" || campo === "derecha";

		const mover = (e: PointerEvent) => {
			const r = el.getBoundingClientRect();
			const v = horizontal
				? (e.clientX - r.left) / r.width
				: (e.clientY - r.top) / r.height;

			const acotado = Math.min(1, Math.max(0, v));
			onBanda({ ...banda, [campo]: acotado } as BandaDeCilindro);
		};

		const soltar = () => {
			window.removeEventListener("pointermove", mover);
			window.removeEventListener("pointerup", soltar);
		};

		window.addEventListener("pointermove", mover);
		window.addEventListener("pointerup", soltar);
	}

	const izq = banda.izquierda * medida.ancho;
	const der = banda.derecha * medida.ancho;
	const arriba = banda.arriba * medida.alto;
	const abajo = banda.abajo * medida.alto;
	const bombeoPx = banda.bombeo * (abajo - arriba);

	/* Ocho columnas repartidas por igual en la ENVOLTURA, no en la foto. La
	   inversa de `θ = asin(2u − 1)` es `u = (sin θ + 1) / 2`, así que salen
	   apretadas hacia los bordes: es la compresión que hará el rasterizador. */
	const guias = Array.from({ length: 9 }, (_, i) => {
		const theta = (i / 8 - 0.5) * Math.PI;
		const u = (Math.sin(theta) + 1) / 2;
		return { u, coseno: Math.cos(theta) };
	});

	return (
		<div className="flex flex-col gap-3">
			<div ref={caja} className="relative touch-none select-none">
				{/* biome-ignore lint/performance/noImgElement: export estático */}
				<img
					src={foto.url}
					alt=""
					onLoad={medir}
					className="w-full rounded-lg border border-tinta/12"
				/>

				{medida.ancho > 0 && (
					<>
						{guias.map(({ u, coseno }) => {
							const x = izq + u * (der - izq);
							const y1 = arriba + bombeoPx * coseno;
							const y2 = abajo + bombeoPx * coseno;

							return (
								<span
									key={u}
									aria-hidden
									className="pointer-events-none absolute w-px bg-[#f8774d]/55"
									style={{ left: x, top: y1, height: Math.max(0, y2 - y1) }}
								/>
							);
						})}

						<Tirador
							etiqueta="Borde izquierdo del cuerpo"
							estilo={{ left: izq, top: (arriba + abajo) / 2 }}
							onArrastrar={(e) => arrastrar("izquierda", e)}
						/>
						<Tirador
							etiqueta="Borde derecho del cuerpo"
							estilo={{ left: der, top: (arriba + abajo) / 2 }}
							onArrastrar={(e) => arrastrar("derecha", e)}
						/>
						<Tirador
							etiqueta="Arriba de la banda"
							estilo={{ left: (izq + der) / 2, top: arriba + bombeoPx }}
							onArrastrar={(e) => arrastrar("arriba", e)}
						/>
						<Tirador
							etiqueta="Abajo de la banda"
							estilo={{ left: (izq + der) / 2, top: abajo + bombeoPx }}
							onArrastrar={(e) => arrastrar("abajo", e)}
						/>
					</>
				)}
			</div>

			<Deslizador
				etiqueta="Curvatura del filo"
				ayuda="Súbela hasta que las guías sigan el borde de la taza."
				min={-0.3}
				max={0.3}
				valor={banda.bombeo}
				onCambio={(v) => onBanda({ ...banda, bombeo: v })}
			/>

			{/* LA TIRA ES EL CONTROL DE VERDAD; el deslizador sólo la mueve.
			
			    "Qué parte mira al frente" es un número entre 0 y 1 y nadie sabe
			    qué poner. Peor: equivocarlo no da un error, imprime el diseño
			    DETRÁS del asa y eso no se descubre hasta ver la taza. Aquí se
			    dibuja la envoltura desplegada con la mitad visible marcada, así
			    que se ve de un vistazo qué trozo del diseño se ve de frente. */}
			<div className="flex flex-col gap-1.5">
				<span className="text-[13px] font-semibold text-tinta">
					Qué parte del diseño se ve de frente
				</span>

				<TiraDeEnvoltura centro={banda.centro} />

				<input
					type="range"
					min={0}
					max={1}
					step={0.01}
					value={banda.centro}
					onChange={(e) =>
						onBanda({ ...banda, centro: Number(e.target.value) })
					}
					aria-label="Qué parte del diseño se ve de frente"
					className="w-full accent-tinta"
				/>

				<span className="text-[12px] leading-[18px] text-tinta/55">
					Con el asa detrás, déjala en el centro. Muévela sólo si el asa queda a
					un lado.
				</span>
			</div>
		</div>
	);
}

function Tirador({
	etiqueta,
	estilo,
	onArrastrar,
}: {
	etiqueta: string;
	estilo: React.CSSProperties;
	onArrastrar: (e: React.PointerEvent) => void;
}) {
	return (
		<button
			type="button"
			aria-label={etiqueta}
			title={etiqueta}
			onPointerDown={onArrastrar}
			style={estilo}
			className="absolute size-5 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full border-2 border-tinta bg-white shadow active:cursor-grabbing"
		/>
	);
}

function Deslizador({
	etiqueta,
	ayuda,
	min,
	max,
	valor,
	onCambio,
}: {
	etiqueta: string;
	ayuda: string;
	min: number;
	max: number;
	valor: number;
	onCambio: (v: number) => void;
}) {
	return (
		<label className="flex flex-col gap-1">
			<span className="text-[13px] font-semibold text-tinta">{etiqueta}</span>
			<input
				type="range"
				min={min}
				max={max}
				step={0.01}
				value={valor}
				onChange={(e) => onCambio(Number(e.target.value))}
				className="w-full accent-tinta"
			/>
			<span className="text-[12px] leading-[18px] text-tinta/55">{ayuda}</span>
		</label>
	);
}

/**
 * La envoltura desplegada, con la mitad que se ve marcada.
 *
 * POR QUÉ EXISTE. `centro` es un número de 0 a 1 y nadie sabe qué poner.
 * Equivocarlo no da un error: imprime el diseño detrás del asa, y eso no se
 * descubre hasta que llega la taza. Aquí se ve.
 *
 * DE FRENTE SE VE MEDIA ENVOLTURA —180° de 360°— así que la ventana marcada
 * mide siempre la mitad de la tira. Lo único que se mueve es dónde cae.
 *
 * ENVUELVE POR LOS EXTREMOS, y por eso puede salir partida en dos trozos: la
 * costura está en el borde, y con el asa a un lado lo que se ve de frente son
 * el final y el principio del diseño. Dibujarlo de un trozo mentiría.
 */
function TiraDeEnvoltura({ centro }: { centro: number }) {
	const inicio = centro - 0.25;
	const fin = centro + 0.25;

	// Los trozos visibles, ya recortados al [0,1] de la tira.
	const trozos =
		inicio < 0
			? [
					{ desde: 0, hasta: fin },
					{ desde: 1 + inicio, hasta: 1 },
				]
			: fin > 1
				? [
						{ desde: inicio, hasta: 1 },
						{ desde: 0, hasta: fin - 1 },
					]
				: [{ desde: inicio, hasta: fin }];

	return (
		<div className="relative h-11 overflow-hidden rounded-lg border border-tinta/15 bg-gris">
			{/* La costura, donde empieza y acaba el diseño. */}
			<span
				aria-hidden
				className="absolute inset-y-0 left-0 w-px bg-tinta/30"
			/>
			<span
				aria-hidden
				className="absolute inset-y-0 right-0 w-px bg-tinta/30"
			/>

			{trozos.map((t) => (
				<span
					key={t.desde}
					aria-hidden
					className="absolute inset-y-0 border-x-[1.5px] border-tinta bg-lima/45"
					style={{
						left: `${t.desde * 100}%`,
						width: `${(t.hasta - t.desde) * 100}%`,
					}}
				/>
			))}

			<span className="pointer-events-none absolute inset-0 flex items-center justify-between px-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-tinta/45">
				<span>costura</span>
				<span>costura</span>
			</span>
		</div>
	);
}
