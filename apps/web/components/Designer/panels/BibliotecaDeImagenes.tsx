"use client";

import { ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { useComprador } from "@/Contexts/CompradorContext";
import { useAddImage } from "@/components/Designer/hooks/useAddImage";
import {
	borrarImagen,
	getMisImagenes,
	guardarImagen,
	type ImagenGuardada,
} from "@/lib/api/cuenta";

/**
 * Subir una imagen, y las que ya subiste.
 *
 * QUÉ RESUELVE. Quien pide para su empresa usa el MISMO logo cada vez, y hasta
 * ahora el editor lo olvidaba al cerrarse: había que ir a buscar el archivo al
 * disco en cada diseño. Lo que se sube queda guardado y la próxima vez está a
 * un clic.
 *
 * LA BIBLIOTECA PIDE SESIÓN, y no es una limitación que haya que superar: sin
 * cuenta no hay dónde colgarla. Quien diseña sin entrar sube archivos como
 * siempre —el editor no exige cuenta y no va a exigirla— y lo único que no
 * tiene es memoria. Por eso el aviso invita a entrar en vez de bloquear.
 *
 * GUARDAR NO PUEDE ROMPER DISEÑAR. La imagen entra al lienzo ANTES de intentar
 * subirla: si la biblioteca falla —sin red, cuota llena, sesión caducada— lo
 * que la persona vino a hacer ya está hecho y sólo se pierde el recuerdo.
 */
export default function BibliotecaDeImagenes() {
	const { comprador } = useComprador();
	const {
		addImage,
		ponerEnElLienzo,
		esGrabado,
		estado,
		reintentar,
		descartar,
	} = useAddImage();

	const [imagenes, setImagenes] = useState<ImagenGuardada[] | null>(null);
	const [subiendo, setSubiendo] = useState(false);
	const [aviso, setAviso] = useState<string | null>(null);

	useEffect(() => {
		if (!comprador) {
			setImagenes([]);
			return;
		}

		getMisImagenes()
			.then(setImagenes)
			// Una biblioteca que no carga no puede impedir subir un archivo.
			.catch(() => setImagenes([]));
	}, [comprador]);

	async function alElegir(e: React.ChangeEvent<HTMLInputElement>) {
		const archivo = e.target.files?.[0];
		if (!archivo) return;

		// Primero al lienzo: es lo que se vino a hacer.
		addImage(archivo);

		// El input se limpia para que elegir el MISMO archivo otra vez vuelva a
		// disparar el evento; sin esto, `change` no salta la segunda vez.
		e.target.value = "";

		if (!comprador) return;

		setAviso(null);
		setSubiendo(true);

		try {
			const guardada = await guardarImagen(archivo);
			setImagenes((antes) => [guardada, ...(antes ?? [])]);
		} catch (error) {
			setAviso(
				error instanceof Error
					? error.message
					: "No pudimos guardarla en tu biblioteca.",
			);
		} finally {
			setSubiendo(false);
		}
	}

	async function quitar(imagen: ImagenGuardada) {
		// Se quita de la lista antes de que conteste el servidor: es una acción
		// pequeña y esperar medio segundo a que desaparezca se siente roto. Si
		// falla, vuelve.
		setImagenes((antes) => (antes ?? []).filter((i) => i.id !== imagen.id));

		try {
			await borrarImagen(imagen.id);
		} catch {
			setImagenes((antes) => [imagen, ...(antes ?? [])]);
			setAviso("No pudimos borrarla. Inténtalo otra vez.");
		}
	}

	return (
		<div className="flex flex-col gap-5">
			<label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-tinta/25 px-6 py-8 text-center transition-colors hover:border-tinta/45 hover:bg-tinta/[0.03]">
				<Upload className="size-8 text-tinta/50" aria-hidden />
				<span className="text-[15px] font-semibold text-tinta">
					Sube una imagen
				</span>
				<span className="text-[13px] leading-[20px] text-tinta/55">
					PNG, JPG o WebP, hasta 15 MB.
					{/* En grabado la imagen no entra tal cual: se convierte a trazos
					    antes de tocar el lienzo, y conviene decirlo ANTES de que
					    alguien suba una foto y no reconozca lo que sale. */}
					{esGrabado ? " La convertiremos a trazos para grabarla." : ""}
				</span>
				<input
					type="file"
					accept="image/png,image/jpeg,image/webp"
					className="hidden"
					onChange={alElegir}
				/>
			</label>

			{aviso && (
				<p className="rounded-lg bg-[rgba(192,57,43,0.08)] px-3 py-2 text-[13px] leading-[19px] text-[#c0392b]">
					{aviso}
				</p>
			)}

			{/* EL ESTADO DEL TRAZADO. En un lado de grabado, agregar una imagen deja
			    de ser instantáneo, y un lienzo que no reacciona durante medio
			    segundo se lee como que el clic no funcionó. */}
			{estado?.fase === "vectorizando" && (
				<p className="flex items-center gap-2.5 rounded-lg bg-gris px-3.5 py-3 text-[13px] leading-[20px] text-tinta/70">
					<span
						aria-hidden
						className="size-4 shrink-0 animate-spin rounded-full border-2 border-tinta/20 border-t-tinta"
					/>
					Preparando imagen para grabado…
				</p>
			)}

			{/* SALIÓ, PERO FLOJO. No bloquea: el diseño ya está en el lienzo y se
			    puede pedir. Sólo dice cómo saldría mejor, porque una imagen chica
			    estirada da un contorno sucio que en el grabado sí se ve.

			    NO SE PIDE UN SVG aunque sea la respuesta obvia: la biblioteca no
			    acepta SVG a propósito —puede traer `<script>` y se sirve desde
			    nuestro origen, ver `services/compradores/rutas/imagenes.ts`—, así
			    que mandar a subir uno sería mandar a chocar con un rechazo. */}
			{estado?.fase === "flojo" && (
				<div className="flex flex-col items-start gap-2 rounded-lg bg-[rgba(184,134,11,0.1)] px-3.5 py-3">
					<p className="text-[13px] leading-[19px] text-[#8a6508]">
						La imagen es pequeña para grabarla y el contorno queda algo sucio.
						Si tienes el original en más resolución —2000 px o más de lado—,
						súbelo y saldrá más limpio.
					</p>
					<button
						type="button"
						onClick={descartar}
						className="rounded-md border border-tinta/20 px-2.5 py-1.5 text-[12px] font-semibold text-tinta"
					>
						Entendido
					</button>
				</div>
			)}

			{/* SIN CAÍDA SILENCIOSA AL PNG: si no se pudo trazar, no se mete nada.
			    Colar el ráster daría un diseño que se ve bien en pantalla y llega al
			    taller como un archivo que no se puede grabar. */}
			{estado?.fase === "fallo" && (
				<div className="flex flex-col items-start gap-2 rounded-lg bg-[rgba(192,57,43,0.08)] px-3.5 py-3">
					<p className="text-[13px] leading-[19px] text-[#c0392b]">
						{estado.mensaje}
					</p>
					<div className="flex items-center gap-2">
						{estado.puedeReintentar && (
							<button
								type="button"
								onClick={reintentar}
								className="rounded-md bg-tinta px-2.5 py-1.5 text-[12px] font-semibold text-lima"
							>
								Reintentar
							</button>
						)}
						<button
							type="button"
							onClick={descartar}
							className="rounded-md border border-tinta/20 px-2.5 py-1.5 text-[12px] font-semibold text-tinta"
						>
							Quitar
						</button>
					</div>
				</div>
			)}

			{!comprador ? (
				<p className="rounded-lg bg-gris px-3.5 py-3 text-[13px] leading-[20px] text-tinta/65">
					Entra a tu cuenta y guardaremos las imágenes que subas, para que la
					próxima vez estén aquí sin buscarlas.
				</p>
			) : (
				<div className="flex flex-col gap-2.5">
					<div className="flex items-center justify-between gap-3">
						<h3 className="text-[13px] font-semibold text-tinta">
							Tus imágenes
						</h3>
						{subiendo && (
							<span className="flex items-center gap-1.5 text-[12px] text-tinta/55">
								<Loader2 className="size-3.5 animate-spin" aria-hidden />
								Guardando
							</span>
						)}
					</div>

					{imagenes === null ? (
						<div className="grid grid-cols-3 gap-2">
							{["a", "b", "c"].map((k) => (
								<div
									key={k}
									className="aspect-square animate-pulse rounded-lg bg-gris"
								/>
							))}
						</div>
					) : imagenes.length === 0 ? (
						<p className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-tinta/20 px-3 py-6 text-center text-[13px] leading-[19px] text-tinta/55">
							<ImagePlus className="size-5 text-tinta/40" aria-hidden />
							Lo que subas se guarda aquí.
						</p>
					) : (
						<ul className="grid grid-cols-3 gap-2">
							{imagenes.map((imagen) => (
								<li key={imagen.id} className="group relative">
									{/* La tarjeta ES el botón: pulsarla mete la imagen en el
									    lienzo, que es lo único que se hace con ella. */}
									<button
										type="button"
										onClick={() => ponerEnElLienzo(imagen.url)}
										title={imagen.nombre}
										className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border border-tinta/12 bg-gris p-1.5 transition-colors hover:border-tinta/40"
									>
										{/* biome-ignore lint/performance/noImgElement: ruta /medios/… del mismo origen servida por el rewrite */}
										<img
											src={imagen.url}
											alt={imagen.nombre}
											loading="lazy"
											className="max-h-full max-w-full object-contain"
										/>
									</button>

									<button
										type="button"
										onClick={() => quitar(imagen)}
										aria-label={`Borrar ${imagen.nombre}`}
										className="absolute -right-1.5 -top-1.5 inline-flex size-7 items-center justify-center rounded-full border border-tinta/12 bg-white text-tinta/50 opacity-0 transition-opacity hover:text-[#c0392b] focus-visible:opacity-100 group-hover:opacity-100"
									>
										<Trash2 className="size-3.5" aria-hidden />
									</button>
								</li>
							))}
						</ul>
					)}
				</div>
			)}
		</div>
	);
}
