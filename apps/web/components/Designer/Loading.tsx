"use client";

import { motion } from "framer-motion";

export default function Loading() {
	return (
		<motion.div
			className="fixed inset-0 z-50 bg-[#fbfaf6] flex items-center justify-center font-sora"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.25 }}
		>
			<div className="flex flex-col items-center gap-3">
				{/* TÍTULO */}
				<motion.span
					className="text-3xl font-medium font-sora text-black"
					initial={{ y: 6, opacity: 0 }}
					animate={{ y: 0, opacity: 1 }}
					transition={{ duration: 0.35, ease: "easeOut" }}
				>
					Cargando
				</motion.span>

				{/* DOTS */}
				<div className="flex gap-1">
					{[0, 1, 2].map((i) => (
						<motion.span
							key={i}
							className="w-2 h-2 rounded-full bg-black"
							animate={{ opacity: [0.3, 1, 0.3] }}
							transition={{
								duration: 1.2,
								repeat: Infinity,
								delay: i * 0.2,
								ease: "easeInOut",
							}}
						/>
					))}
				</div>

				{/* SUBTEXTO */}
				<span className="text-sm text-[#6b6b5e] font-sora tracking-wide">
					Preparando tu diseño
				</span>
			</div>
		</motion.div>
	);
}
