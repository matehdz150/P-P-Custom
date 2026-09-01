"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { uploadImage } from "@/lib/api/uploads";
import { Ayuda, Etiqueta } from "./campos";

type Foto = { url: string; order: number };

/**
 * Las fotos del producto: arrastrar al recuadro o dar clic para elegirlas.
 *
 * Suben a Cloudinary con `uploadImage`, el mismo endpoint que ya usa el
 * admin (`POST /uploads/image`). El orden importa: la primera es la portada.
 */
export default function Fotos({
	fotos,
	onChange,
}: {
	fotos: Foto[];
	onChange: (f: Foto[]) => void;
}) {
	const input = useRef<HTMLInputElement>(null);
	const [arrastrando, setArrastrando] = useState(false);
	// Cada subida en curso lleva su propio id: son huecos en la rejilla y
	// necesitan identidad estable mientras Cloudinary responde.
	const [subiendo, setSubiendo] = useState<string[]>([]);
	const [fallo, setFallo] = useState<string | null>(null);

	async function subir(archivos: FileList | File[]) {
		const imagenes = Array.from(archivos).filter((f) =>
			f.type.startsWith("image/"),
		);
		if (imagenes.length === 0) {
			setFallo("Sólo imágenes: JPG, PNG o WebP.");
			return;
		}

		setFallo(null);
		const pendientes = imagenes.map((archivo) => ({
			id: crypto.randomUUID(),
			archivo,
		}));
		setSubiendo((s) => [...s, ...pendientes.map((p) => p.id)]);

		// Una por una para que cada foto aparezca en cuanto termina, en vez de
		// esperar a que suba todo el lote.
		let acumulado = fotos;
		for (const { id, archivo } of pendientes) {
			try {
				const { url } = await uploadImage(archivo);
				acumulado = [...acumulado, { url, order: acumulado.length }];
				onChange(acumulado);
			} catch {
				setFallo(`No se pudo subir ${archivo.name}. Inténtalo otra vez.`);
			} finally {
				setSubiendo((s) => s.filter((x) => x !== id));
			}
		}
	}

	function quitar(i: number) {
		onChange(
			fotos.filter((_, j) => j !== i).map((img, order) => ({ ...img, order })),
		);
	}

	/** La portada es la primera; esto la sube al frente sin reordenar a mano. */
	function hacerPortada(i: number) {
		const elegida = fotos[i];
		onChange(
			[elegida, ...fotos.filter((_, j) => j !== i)].map((img, order) => ({
				...img,
				order,
			})),
		);
	}

	return (
		<div className="flex flex-1 flex-col gap-3">
			<div className="flex items-baseline justify-between gap-3">
				<Etiqueta>Fotos</Etiqueta>
				<Ayuda>Mínimo 2 · la primera es la de portada</Ayuda>
			</div>

			{/* biome-ignore lint/a11y/noStaticElementInteractions: la zona sólo
			    recibe el soltar; el control accesible es el botón de adentro. */}
			<div
				onDragOver={(e) => {
					e.preventDefault();
					setArrastrando(true);
				}}
				onDragLeave={() => setArrastrando(false)}
				onDrop={(e) => {
					e.preventDefault();
					setArrastrando(false);
					if (e.dataTransfer.files.length) subir(e.dataTransfer.files);
				}}
				className={`grid grid-cols-3 gap-3 rounded-xl p-1 transition-colors ${
					arrastrando ? "bg-lima/25 outline-2 outline-dashed outline-tinta" : ""
				}`}
			>
				{fotos.map((img, i) => (
					<div
						key={img.url}
						className="group relative flex h-[150px] items-center justify-center rounded-[10px] border border-tinta/14 bg-gris"
					>
						<Image
							src={img.url}
							alt=""
							width={200}
							height={240}
							className="max-h-[80%] w-auto max-w-[70%] object-contain"
						/>

						{i === 0 ? (
							<span className="absolute left-2.5 top-2.5 rounded-md bg-lima px-2 py-[3px] font-mono text-[10px] font-bold text-tinta">
								PORTADA
							</span>
						) : (
							<button
								type="button"
								onClick={() => hacerPortada(i)}
								className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-md bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-tinta opacity-0 group-hover:opacity-100"
							>
								Hacer portada
							</button>
						)}

						<button
							type="button"
							onClick={() => quitar(i)}
							aria-label="Quitar foto"
							className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md bg-white/90 text-tinta"
						>
							<svg
								width="13"
								height="13"
								viewBox="0 0 24 24"
								fill="none"
								aria-hidden="true"
							>
								<path
									d="M6 6l12 12M18 6L6 18"
									stroke="currentColor"
									strokeWidth="2.2"
									strokeLinecap="round"
								/>
							</svg>
						</button>
					</div>
				))}

				{subiendo.map((id) => (
					<div
						key={id}
						className="flex h-[150px] items-center justify-center rounded-[10px] border border-tinta/14 bg-gris text-[13px] text-tinta/60"
					>
						Subiendo…
					</div>
				))}

				<button
					type="button"
					onClick={() => input.current?.click()}
					className="flex h-[150px] flex-col items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-dashed border-tinta/28 px-3 hover:border-tinta hover:bg-hueso"
				>
					<svg
						width="22"
						height="22"
						viewBox="0 0 24 24"
						fill="none"
						aria-hidden="true"
					>
						<path
							d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4.5 19h15"
							stroke="#2b2812"
							strokeWidth="1.7"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
					<span className="text-[13px] font-semibold text-tinta">
						Arrastra o elige
					</span>
				</button>

				<input
					ref={input}
					type="file"
					accept="image/*"
					multiple
					className="hidden"
					onChange={(e) => {
						if (e.target.files?.length) subir(e.target.files);
						e.target.value = "";
					}}
				/>
			</div>

			{fallo ? (
				<span role="alert" className="text-[13px] leading-5 text-[#c0392b]">
					{fallo}
				</span>
			) : (
				<Ayuda>
					Fondo claro y la prenda sola. Si tienes la de espalda, súbela: el
					cliente la busca.
				</Ayuda>
			)}
		</div>
	);
}
