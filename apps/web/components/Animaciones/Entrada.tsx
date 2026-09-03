"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

const EASE_SUAVE = [0.22, 1, 0.36, 1] as const;

type EntradaProps = {
	children: ReactNode;
	className?: string;
	delay?: number;
	desplazamiento?: number;
	escala?: number;
	alCargar?: boolean;
};

/** Entrada breve y reutilizable para mantener el mismo ritmo entre landings. */
export function Entrada({
	children,
	className,
	delay = 0,
	desplazamiento = 22,
	escala = 1,
	alCargar = false,
}: EntradaProps) {
	const sinMovimiento = useReducedMotion();
	const inicial = sinMovimiento
		? false
		: { opacity: 0, y: desplazamiento, scale: escala };
	const visible = { opacity: 1, y: 0, scale: 1 };
	const transition = { duration: 0.68, delay, ease: EASE_SUAVE };

	if (alCargar) {
		return (
			<motion.div
				className={className}
				initial={inicial}
				animate={visible}
				transition={transition}
			>
				{children}
			</motion.div>
		);
	}

	return (
		<motion.div
			className={className}
			initial={inicial}
			whileInView={visible}
			viewport={{ once: true, amount: 0.2, margin: "0px 0px -8% 0px" }}
			transition={transition}
		>
			{children}
		</motion.div>
	);
}
