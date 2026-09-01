"use client";

import { motion, useAnimate, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { Simbolo } from "./Marca";

/* La pieza arranca en la trama de marca —"el tuyo, entre muchos"— y de ahí
   entra al taller: se abre el área editable, se escribe y se cambia el color.
   Todo en porcentajes, para que la misma coreografía sirva a 330px de alto en
   móvil y a 468 en desktop. */

const PRENDA =
	"M96 22 C110 46 150 46 164 22 L200 34 L232 74 L206 102 L190 84 L190 258 C190 266 184 272 176 272 L84 272 C76 272 70 266 70 258 L70 84 L54 102 L28 74 L60 34 Z";

const TEXTO = "TU MARCA";
const COLORES = ["#fffdf8", "#aeff6e", "#c9b8ff"];

/* El 8 cae dentro del cuadro tanto en la retícula de 5 columnas del móvil
   como en la de 6 del desktop. */
const MARCADO = 8;
const SELLOS = Array.from({ length: 30 }, (_, i) => ({
	id: `sello-${i}`,
	encendido: i === MARCADO,
}));

const REPOSO = { left: "94%", top: "104%" };
const SOBRE_PRENDA = { left: "58%", top: "50%" };
const SOBRE_MUESTRA = { left: "24%", top: "86%" };

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

function Cursor() {
	return (
		<svg
			width="34"
			height="42"
			viewBox="0 0 20 26"
			fill="none"
			aria-hidden="true"
		>
			<polygon
				points="0,0 0,21 5.8,15.9 9.7,24 13.5,22.1 9.7,14.4 16.4,14.4"
				fill="none"
				stroke="#f8774d"
				strokeWidth="4"
				strokeLinejoin="round"
			/>
			<polygon
				points="0,0 0,21 5.8,15.9 9.7,24 13.5,22.1 9.7,14.4 16.4,14.4"
				fill="#2b2812"
			/>
		</svg>
	);
}

export default function HeroPieza() {
	const [scope, animate] = useAnimate();
	const sinMovimiento = useReducedMotion();
	const [escrito, setEscrito] = useState(0);
	const [color, setColor] = useState(0);
	const [enTaller, setEnTaller] = useState(false);

	useEffect(() => {
		// Con movimiento reducido se queda la trama, que es el estado en reposo.
		if (sinMovimiento) return;

		let vivo = true;

		/** En segundo plano el rAF se estrangula y el cursor se desfasa del
		 *  texto, así que ahí esperamos en lugar de seguir. */
		const enPausa = async () => {
			while (vivo && document.hidden) await espera(300);
		};

		async function correr() {
			while (vivo) {
				await enPausa();
				if (!vivo) return;

				// 1 · la trama, tal cual el estado en reposo
				setEnTaller(false);
				setEscrito(0);
				setColor(0);
				await Promise.all([
					animate("#trama", { opacity: 1, scale: 1 }, { duration: 0.5 }),
					animate("#taller", { opacity: 0, scale: 0.92 }, { duration: 0.4 }),
					animate("#cursor", { ...REPOSO, scale: 1 }, { duration: 0 }),
					animate("#area", { opacity: 0, scale: 0.94 }, { duration: 0 }),
				]);
				await espera(2100);
				if (!vivo) return;

				// 2 · nos metemos dentro de uno: la trama se acerca y se disuelve
				setEnTaller(true);
				await Promise.all([
					animate(
						"#trama",
						{ opacity: 0, scale: 1.22 },
						{ duration: 0.8, ease: [0.4, 0, 0.2, 1] },
					),
					animate(
						"#taller",
						{ opacity: 1, scale: 1 },
						{ duration: 0.8, ease: [0.22, 1, 0.36, 1] },
					),
				]);
				await espera(200);
				if (!vivo) return;

				// 3 · el cursor entra y se para sobre el pecho
				await animate("#cursor", SOBRE_PRENDA, {
					duration: 0.9,
					ease: [0.22, 1, 0.36, 1],
				});
				if (!vivo) return;

				// 4 · se abre el área editable
				await animate(
					"#area",
					{ opacity: 1, scale: 1 },
					{ duration: 0.42, ease: [0.34, 1.4, 0.64, 1] },
				);
				await espera(240);
				if (!vivo) return;

				// 5 · se escribe, letra por letra
				for (let i = 1; i <= TEXTO.length; i++) {
					if (!vivo) return;
					setEscrito(i);
					await espera(TEXTO[i - 1] === " " ? 60 : 105);
				}
				await espera(620);
				if (!vivo) return;

				// 6 · baja por un color y lo aplica
				await animate("#cursor", SOBRE_MUESTRA, {
					duration: 0.8,
					ease: [0.22, 1, 0.36, 1],
				});
				if (!vivo) return;
				await animate("#cursor", { scale: 0.82 }, { duration: 0.09 });
				setColor(1);
				await animate("#cursor", { scale: 1 }, { duration: 0.16 });
				await espera(1150);
				if (!vivo) return;

				// 7 · y otro, para que se lea que son varios
				await animate(
					"#cursor",
					{ left: "35%", top: "86%" },
					{ duration: 0.4 },
				);
				await animate("#cursor", { scale: 0.82 }, { duration: 0.09 });
				setColor(2);
				await animate("#cursor", { scale: 1 }, { duration: 0.16 });
				await espera(1300);
				if (!vivo) return;

				// 8 · el cursor sale y volvemos a la trama
				await animate("#cursor", REPOSO, { duration: 0.7, ease: "easeIn" });
				await espera(250);
			}
		}

		correr();
		return () => {
			vivo = false;
		};
	}, [animate, sinMovimiento]);

	return (
		<div
			ref={scope}
			className="relative h-[330px] w-full overflow-hidden rounded-[18px] bg-naranja md:h-[468px] md:rounded-[22px]"
		>
			{/* ── estado en reposo: la trama de marca ── */}
			<motion.div id="trama" className="absolute inset-0" initial={false}>
				<div className="absolute -left-5 -top-6 grid grid-cols-5 gap-4 md:-left-7 md:-top-9 md:grid-cols-6 md:gap-[22px]">
					{SELLOS.map(({ id, encendido }) => (
						<div
							key={id}
							className={encendido ? "opacity-100" : "opacity-[0.34]"}
						>
							<Simbolo
								size={74}
								className="md:h-24 md:w-24"
								placa={encendido ? "#2b2812" : "#fffdf8"}
								prenda={encendido ? "#aeff6e" : "#f8774d"}
								reducido
							/>
						</div>
					))}
				</div>
			</motion.div>

			{/* ── el taller: la prenda que se edita ── */}
			<motion.div
				id="taller"
				className="absolute inset-0"
				initial={{ opacity: 0, scale: 0.92 }}
			>
				<div className="absolute inset-0 flex items-center justify-center">
					<svg
						viewBox="0 0 260 300"
						fill="none"
						aria-hidden="true"
						className="h-[86%] w-auto"
					>
						<motion.path
							d={PRENDA}
							stroke="#2b2812"
							strokeWidth="4"
							strokeLinejoin="round"
							animate={{ fill: COLORES[color] }}
							transition={{ duration: 0.45, ease: "easeOut" }}
						/>
					</svg>
				</div>

				<motion.div
					id="area"
					initial={{ opacity: 0, scale: 0.94 }}
					className="absolute left-1/2 top-[45%] flex h-[76px] w-[150px] -translate-x-1/2 -translate-y-1/2 items-center justify-center border-[2.5px] border-dashed border-lima md:h-[112px] md:w-[224px] md:border-[3px]"
				>
					<span className="absolute -left-[5px] -top-[5px] h-2.5 w-2.5 bg-lima md:h-3 md:w-3" />
					<span className="absolute -right-[5px] -top-[5px] h-2.5 w-2.5 bg-lima md:h-3 md:w-3" />
					<span className="absolute -bottom-[5px] -left-[5px] h-2.5 w-2.5 bg-lima md:h-3 md:w-3" />
					<span className="absolute -bottom-[5px] -right-[5px] h-2.5 w-2.5 bg-lima md:h-3 md:w-3" />

					<span className="flex items-center font-display text-[19px] uppercase leading-none tracking-[-0.02em] text-tinta md:text-[30px]">
						{TEXTO.slice(0, escrito)}
						{escrito < TEXTO.length && (
							<motion.span
								aria-hidden="true"
								className="ml-[2px] inline-block h-[18px] w-[3px] bg-tinta md:h-7"
								animate={{ opacity: [1, 1, 0, 0] }}
								transition={{ duration: 0.9, repeat: Number.POSITIVE_INFINITY }}
							/>
						)}
					</span>
				</motion.div>

				<div className="absolute bottom-[9%] left-[16%] flex items-center gap-2.5 md:gap-3">
					{COLORES.map((c, i) => (
						<span
							key={c}
							className="block h-6 w-6 rounded-full border-2 border-tinta md:h-8 md:w-8"
							style={{
								backgroundColor: c,
								boxShadow: i === color ? "0 0 0 3px #2b2812" : undefined,
							}}
						/>
					))}
				</div>
			</motion.div>

			<motion.div
				id="cursor"
				className="pointer-events-none absolute z-10"
				style={{ left: REPOSO.left, top: REPOSO.top }}
			>
				<Cursor />
			</motion.div>

			<motion.span
				key={enTaller ? "taller" : "trama"}
				initial={{ opacity: 0, y: -6 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.35, ease: "easeOut" }}
				className="absolute right-4 top-4 rounded-full bg-hueso px-3.5 py-2 text-[13px] font-semibold text-tinta md:right-6 md:top-6 md:px-[18px] md:py-2.5 md:text-sm"
			>
				{enTaller ? "Así se personaliza" : "El tuyo, entre muchos"}
			</motion.span>
		</div>
	);
}
