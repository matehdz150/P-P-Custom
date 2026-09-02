"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Category } from "@/lib/api/categories";
import {
	actualizarMiProducto,
	categoriasParaAlta,
	crearMiProducto,
	ErrorProveedor,
	plantillasParaAlta,
} from "@/lib/api/proveedores";
import type { ProductTemplate } from "@/lib/api/templates";
import { Palomita } from "./campos";
import {
	PasoDatos,
	PasoImpresion,
	PasoPlantilla,
	PasoPrecio,
	PasoRevisar,
	PasoVariantes,
} from "./pasos";
import { ALTA_VACIA, type Alta, aPayload } from "./tipos";

const PASOS = [
	{ id: "plantilla", nombre: "Qué produces", titulo: "¿Qué vas a producir?" },
	{ id: "datos", nombre: "Preséntalo", titulo: "Preséntalo" },
	{ id: "impresion", nombre: "Cómo se imprime", titulo: "Cómo se imprime" },
	{ id: "variantes", nombre: "Tallas y colores", titulo: "Tallas y colores" },
	{ id: "precio", nombre: "Tu precio", titulo: "Tu precio" },
	{ id: "revisar", nombre: "Revisar", titulo: "Revisa antes de enviarlo" },
] as const;

const AYUDA: Record<string, string> = {
	plantilla:
		"Elige la prenda base. De ahí salen los lados que se pueden imprimir y el molde donde el cliente coloca su diseño — no tienes que dibujar nada.",
	datos:
		"Lo que el cliente va a leer y ver en el catálogo. Nada de esto es definitivo: puedes cambiarlo cuando quieras.",
	impresion:
		"Marca los lados que sí puedes imprimir y hasta dónde llega tu área útil. Esto es lo que limita al cliente en el editor: no va a poder mandarte un diseño más grande de lo que aguantas.",
	variantes: "Las tallas que manejas y los colores que tienes en existencia.",
	precio:
		"Tu precio por pieza y lo que suma cada decisión del cliente. Tú lo defines, nosotros no le movemos.",
	revisar:
		"Si algo no cuadra, vuelve al paso y corrígelo. Puedes guardarlo como borrador y terminarlo después.",
};

/**
 * El mismo asistente sirve para dar de alta y para corregir.
 *
 * Se reusa entero a propósito: las reglas de qué falta en cada paso son las
 * mismas, y un formulario aparte para editar acabaría divergiendo del alta
 * en cuanto alguien tocara uno de los dos.
 */
export default function AltaProducto({
	editando,
}: {
	editando?: {
		id: string;
		inicial: Alta;
		/** Por qué lo regresó el admin, si lo regresó. */
		notaRevision?: string | null;
		yaPublicado: boolean;
	};
} = {}) {
	const router = useRouter();
	const [plantillas, setPlantillas] = useState<ProductTemplate[]>([]);
	const [categorias, setCategorias] = useState<Category[]>([]);
	const [alta, setAlta] = useState<Alta>(editando?.inicial ?? ALTA_VACIA);
	const [paso, setPaso] = useState(0);
	const [enviando, setEnviando] = useState(false);
	const [fallo, setFallo] = useState<string | null>(null);

	useEffect(() => {
		// Por la API del proveedor, con su propio token: el asistente no debe
		// pasar por el puente del admin ni por la llave compartida.
		plantillasParaAlta()
			.then(setPlantillas)
			.catch(() => setPlantillas([]));
		categoriasParaAlta()
			.then(setCategorias)
			.catch(() => setCategorias([]));
	}, []);

	function set<K extends keyof Alta>(k: K, v: Alta[K]) {
		setAlta((a) => ({ ...a, [k]: v }));
	}

	const plantilla = useMemo(
		() => plantillas.find((t) => t.id === alta.templateId) ?? null,
		[plantillas, alta.templateId],
	);

	const actual = PASOS[paso];
	const ultimo = paso === PASOS.length - 1;

	// Lo mínimo para poder avanzar. Sólo lo que de verdad rompe el producto.
	const puedeSeguir = useMemo(() => {
		switch (actual.id) {
			case "plantilla":
				return !!alta.templateId;
			case "datos":
				return alta.name.trim().length > 0 && alta.images.length >= 2;
			case "impresion":
				return alta.printSides.length > 0;
			case "variantes":
				// Con nombre no basta: sin medidas la talla no se puede guardar.
				return alta.sizes.some(
					(t) => t.size.trim() !== "" && t.widthIn !== "" && t.lengthIn !== "",
				);
			case "precio":
				return Number(alta.pricing.basePrice) > 0;
			default:
				return true;
		}
	}, [actual.id, alta]);

	async function guardar(enviar: boolean) {
		setFallo(null);
		setEnviando(true);
		try {
			if (editando) {
				await actualizarMiProducto(editando.id, aPayload(alta, enviar));
			} else {
				await crearMiProducto(aPayload(alta, enviar));
			}
			router.push("/proveedor/productos");
		} catch (error) {
			// La Lambda contesta con el motivo ("Marca al menos un lado que
			// puedas imprimir"); sin enseñarlo, un fallo de validación se ve
			// igual que uno de red.
			const detalle =
				error instanceof ErrorProveedor ? `: ${error.message}` : "";
			setFallo(`No pudimos guardar el producto${detalle}`);
			setEnviando(false);
		}
	}

	return (
		<div className="flex min-h-[calc(100vh-68px)] flex-col justify-between gap-6">
			<div className="flex flex-col gap-6">
				<Riel paso={paso} onIr={setPaso} />

				<div className="flex flex-col gap-1.5">
					<h1 className="font-display text-[27px] font-semibold leading-[34px] tracking-[-0.032em] text-tinta">
						{actual.titulo}
					</h1>
					<p className="max-w-[640px] text-[15px] leading-[25px] text-tinta/60">
						{AYUDA[actual.id]}
					</p>
				</div>

				{/* El motivo del rechazo va arriba y en todos los pasos: es la razón
				    por la que el taller entró aquí, y el paso donde está el problema
				    no tiene por qué ser el primero. */}
				{editando?.notaRevision && (
					<div className="rounded-lg border border-[rgba(192,57,43,0.35)] bg-[rgba(192,57,43,0.07)] p-4">
						<p className="text-[13px] font-semibold text-tinta">
							Te lo regresamos con esta nota
						</p>
						<p className="pt-1 text-sm leading-[22px] text-tinta/80">
							{editando.notaRevision}
						</p>
					</div>
				)}

				{editando?.yaPublicado && (
					<div className="rounded-lg border border-tinta/20 bg-gris p-4 text-sm leading-[22px] text-tinta/80">
						Este producto está publicado. Al guardar cambios vuelve a revisión y
						deja de aparecer en el catálogo hasta que lo aprobemos otra vez.
					</div>
				)}

				{actual.id === "plantilla" && (
					<PasoPlantilla
						plantillas={plantillas}
						elegida={alta.templateId}
						onElegir={(t) => {
							set("templateId", t.id);
							// Cambiar de plantilla invalida los lados: son otros.
							set("printSides", []);
						}}
					/>
				)}
				{actual.id === "datos" && (
					<PasoDatos alta={alta} set={set} categorias={categorias} />
				)}
				{actual.id === "impresion" && (
					<PasoImpresion alta={alta} set={set} plantilla={plantilla} />
				)}
				{actual.id === "variantes" && <PasoVariantes alta={alta} set={set} />}
				{actual.id === "precio" && <PasoPrecio alta={alta} set={set} />}
				{actual.id === "revisar" && (
					<PasoRevisar
						alta={alta}
						plantilla={plantilla}
						categorias={categorias}
					/>
				)}

				{fallo && (
					<div
						role="alert"
						className="rounded-lg border border-[rgba(192,57,43,0.35)] bg-[rgba(192,57,43,0.07)] p-4 text-sm text-tinta"
					>
						{fallo}
					</div>
				)}
			</div>

			<div className="flex items-center justify-between gap-5 border-t border-tinta/12 pt-[26px]">
				<button
					type="button"
					onClick={() =>
						paso === 0 ? router.push("/proveedor/productos") : setPaso(paso - 1)
					}
					className="flex h-12 items-center gap-2 rounded-lg border-[1.5px] border-tinta/20 px-[18px] text-[15px] font-semibold text-tinta"
				>
					<svg
						width="15"
						height="15"
						viewBox="0 0 24 24"
						fill="none"
						aria-hidden="true"
					>
						<path
							d="M14.5 6l-6 6 6 6"
							stroke="currentColor"
							strokeWidth="1.8"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
					{paso === 0 ? "Cancelar" : "Atrás"}
				</button>

				<div className="flex items-center gap-2.5">
					{ultimo && (
						<button
							type="button"
							disabled={enviando}
							onClick={() => guardar(false)}
							className="flex h-12 items-center rounded-lg border-[1.5px] border-tinta/20 px-5 text-[15px] font-semibold text-tinta disabled:opacity-50"
						>
							{editando ? "Guardar sin enviar" : "Guardar como borrador"}
						</button>
					)}
					<button
						type="button"
						disabled={!puedeSeguir || enviando}
						onClick={() => (ultimo ? guardar(true) : setPaso(paso + 1))}
						className="flex h-12 items-center gap-2 rounded-lg bg-tinta px-[22px] text-[15px] font-semibold text-lima disabled:bg-tinta/14 disabled:text-tinta/40"
					>
						{enviando
							? "Guardando…"
							: ultimo
								? editando
									? "Guardar y enviar a revisión"
									: "Enviar a revisión"
								: "Continuar"}
						{!enviando && (
							<svg
								width="15"
								height="15"
								viewBox="0 0 24 24"
								fill="none"
								aria-hidden="true"
							>
								<path
									d="M9.5 6l6 6-6 6"
									stroke="currentColor"
									strokeWidth="1.8"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
						)}
					</button>
				</div>
			</div>
		</div>
	);
}

/** Sólo deja volver a pasos ya vistos: adelantarse rompería la validación. */
function Riel({ paso, onIr }: { paso: number; onIr: (n: number) => void }) {
	return (
		<div className="flex items-center gap-1 border-b border-tinta/12 pb-[22px]">
			{PASOS.map((p, i) => {
				const hecho = i < paso;
				const activo = i === paso;
				return (
					<button
						key={p.id}
						type="button"
						disabled={i > paso}
						onClick={() => onIr(i)}
						aria-current={activo ? "step" : undefined}
						className={`flex h-9 items-center gap-2.5 whitespace-nowrap rounded-lg px-3.5 text-sm ${
							activo
								? "bg-tinta font-semibold text-lima"
								: hecho
									? "text-tinta"
									: "text-tinta/55"
						}`}
					>
						<span
							className={`flex h-5 w-5 items-center justify-center rounded-full font-mono text-[11px] ${
								activo
									? "bg-lima/25 text-lima"
									: hecho
										? "bg-lima text-tinta"
										: "border-[1.2px] border-tinta/25"
							}`}
						>
							{hecho ? <Palomita /> : i + 1}
						</span>
						{p.nombre}
					</button>
				);
			})}
		</div>
	);
}
