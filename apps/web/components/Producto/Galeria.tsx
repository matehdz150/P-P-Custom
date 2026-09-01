"use client";

import Image from "next/image";
import { useState } from "react";
import type { Vista } from "./datos";

/**
 * La pieza flota sobre el fondo, sin caja: las miniaturas de abajo son las
 * caras imprimibles y cambian la vista grande.
 */
export default function Galeria({
	vistas,
	nombre,
}: {
	vistas: Vista[];
	nombre: string;
}) {
	const [activa, setActiva] = useState(0);
	const vista = vistas[activa];

	if (!vista) {
		return (
			<div className="flex h-[320px] items-center justify-center md:h-[560px]">
				<span className="text-[13px] text-tinta/40">Sin imagen</span>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4 md:gap-5">
			<div className="flex h-[320px] items-center justify-center md:h-[560px]">
				<Image
					src={vista.src}
					alt={`${nombre} — ${vista.label}`}
					width={640}
					height={800}
					priority
					className="max-h-full w-auto max-w-[80%] object-contain md:max-w-[74%]"
				/>
			</div>

			{vistas.length > 1 && (
				<div className="flex items-center justify-center gap-2.5 md:justify-start md:gap-3.5">
					{vistas.map((v, i) => (
						<button
							key={v.key}
							type="button"
							onClick={() => setActiva(i)}
							aria-label={v.label}
							aria-pressed={i === activa}
							className={`flex h-[66px] w-[66px] items-center justify-center rounded-[14px] bg-gris md:h-24 md:w-24 md:rounded-[18px] ${
								i === activa ? "border-[1.5px] border-tinta" : ""
							}`}
						>
							<Image
								src={v.src}
								alt=""
								width={200}
								height={250}
								className="max-h-[76%] w-auto max-w-[70%] object-contain"
							/>
						</button>
					))}
				</div>
			)}
		</div>
	);
}
