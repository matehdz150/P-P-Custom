"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Los aros se desplazan y expanden apenas; los trazos cortos recorren su
 * perímetro para que el movimiento se perciba sin competir con el titular.
 */
export function ArosProveedor() {
	const sinMovimiento = useReducedMotion();

	return (
		<motion.svg
			className="pointer-events-none absolute -right-[220px] -top-10 md:-right-40 md:-top-[60px]"
			width="1200"
			height="1100"
			viewBox="0 0 1200 1100"
			fill="none"
			aria-hidden="true"
			initial={false}
			animate={
				sinMovimiento
					? undefined
					: {
							x: [0, -8, 4, 0],
							y: [0, 6, -4, 0],
							rotate: [0, 0.25, -0.2, 0],
						}
			}
			transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
		>
			<motion.circle
				cx="820"
				cy="560"
				r="560"
				stroke="rgba(43,40,18,0.16)"
				strokeWidth="1.1"
				vectorEffect="non-scaling-stroke"
				animate={sinMovimiento ? undefined : { scale: [1, 1.012, 1] }}
				transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
				style={{ transformOrigin: "820px 560px" }}
			/>
			<motion.circle
				cx="820"
				cy="560"
				r="330"
				stroke="rgba(43,40,18,0.09)"
				strokeWidth="1.1"
				vectorEffect="non-scaling-stroke"
				animate={sinMovimiento ? undefined : { scale: [1, 0.982, 1] }}
				transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
				style={{ transformOrigin: "820px 560px" }}
			/>
			<motion.circle
				cx="820"
				cy="560"
				r="180"
				stroke="rgba(43,40,18,0.12)"
				strokeWidth="1.1"
				vectorEffect="non-scaling-stroke"
				animate={sinMovimiento ? undefined : { scale: [1, 1.022, 1] }}
				transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
				style={{ transformOrigin: "820px 560px" }}
			/>

			<motion.circle
				cx="820"
				cy="560"
				r="560"
				stroke="rgba(43,40,18,0.22)"
				strokeWidth="1.6"
				strokeDasharray="64 3455"
				strokeLinecap="round"
				initial={false}
				animate={sinMovimiento ? undefined : { rotate: 360 }}
				transition={{ duration: 36, repeat: Infinity, ease: "linear" }}
				style={{ transformOrigin: "820px 560px" }}
			/>
			<motion.circle
				cx="820"
				cy="560"
				r="330"
				stroke="rgba(43,40,18,0.16)"
				strokeWidth="1.5"
				strokeDasharray="42 2032"
				strokeLinecap="round"
				initial={false}
				animate={sinMovimiento ? undefined : { rotate: -360 }}
				transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
				style={{ transformOrigin: "820px 560px" }}
			/>
		</motion.svg>
	);
}
