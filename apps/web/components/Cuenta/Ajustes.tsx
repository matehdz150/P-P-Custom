"use client";

import { Check, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { useComprador } from "@/Contexts/CompradorContext";
import {
	ErrorCuenta,
	getMiPerfil,
	guardarMiPerfil,
	type PerfilDelComprador,
} from "@/lib/api/cuenta";
import { ESTADOS_MX } from "@/lib/mexico";
import { Aviso, Cargando } from "./piezas";

/**
 * La cuenta: cómo te llamas, cómo contactarte y a dónde mandamos.
 *
 * EL CORREO NO SE EDITA AQUÍ, y no es un olvido: es el que ata los pedidos
 * (`gsi3` va por correo). Dejar cambiarlo desde aquí le movería el historial a
 * otra persona. Lo administra Cognito.
 *
 * Y ESTA DIRECCIÓN NO ES LA DEL PEDIDO. Es la de la próxima vez; cada pedido
 * copió la suya al crearse. Se dice en pantalla porque si no, alguien la
 * corrige creyendo que está arreglando un envío en curso.
 */

const CAMPO =
	"h-[52px] rounded-2xl border-[1.5px] border-tinta/14 bg-white px-4 text-base text-tinta outline-none placeholder:text-tinta/45 focus:border-tinta/30 focus:shadow-[0_0_0_4px_rgba(43,40,18,0.04)]";

type Estado = "cargando" | "listo" | "guardando" | "guardado";

export default function Ajustes() {
	const { comprador, salir } = useComprador();
	const [estado, setEstado] = useState<Estado>("cargando");
	const [fallo, setFallo] = useState<string | null>(null);

	const [nombre, setNombre] = useState("");
	const [whatsapp, setWhatsapp] = useState("");
	const [dir, setDir] = useState({
		calle: "",
		numero: "",
		interior: "",
		colonia: "",
		ciudad: "",
		estado: "",
		cp: "",
		referencias: "",
	});

	useEffect(() => {
		getMiPerfil()
			.then((perfil: PerfilDelComprador) => {
				// El nombre de Cognito es el de arranque: si nunca guardó perfil,
				// el campo sale con lo que puso al registrarse en vez de vacío.
				setNombre(perfil.nombre ?? comprador?.nombre ?? "");
				setWhatsapp(perfil.whatsapp ?? "");
				if (perfil.direccion) {
					setDir({
						calle: perfil.direccion.calle ?? "",
						numero: perfil.direccion.numero ?? "",
						interior: perfil.direccion.interior ?? "",
						colonia: perfil.direccion.colonia ?? "",
						ciudad: perfil.direccion.ciudad ?? "",
						estado: perfil.direccion.estado ?? "",
						cp: perfil.direccion.cp ?? "",
						referencias: perfil.direccion.referencias ?? "",
					});
				}
				setEstado("listo");
			})
			.catch((error) => {
				setFallo(
					error instanceof ErrorCuenta && error.hayQueEntrar
						? "Tu sesión caducó. Vuelve a entrar."
						: "No pudimos traer tu información.",
				);
				setEstado("listo");
			});
	}, [comprador]);

	async function guardar(e: React.FormEvent) {
		e.preventDefault();
		if (estado === "guardando" || !nombre.trim()) return;

		setFallo(null);
		setEstado("guardando");

		try {
			await guardarMiPerfil({
				nombre: nombre.trim(),
				whatsapp: whatsapp.trim() || null,
				direccion: dir.calle.trim() ? dir : null,
			});
			setEstado("guardado");
		} catch (error) {
			setFallo(
				error instanceof ErrorCuenta
					? error.message
					: "No pudimos guardar los cambios.",
			);
			setEstado("listo");
		}
	}

	if (estado === "cargando") return <Cargando />;

	const cambiar = (campo: keyof typeof dir) => (v: string) => {
		setDir((d) => ({ ...d, [campo]: v }));
		if (estado === "guardado") setEstado("listo");
	};

	return (
		<form onSubmit={guardar} className="flex max-w-[1020px] flex-col">
			<p className="-mt-3 pb-6 text-[15px] leading-[25px] text-tinta/65">
				Lo que usamos para contactarte y para mandarte lo que pides.
			</p>

			{/* Dos tarjetas lado a lado en escritorio. Se apilan en el teléfono:
			    a 375 px, dos columnas de campos son ilegibles. */}
			<div className="flex flex-col gap-6 lg:flex-row lg:gap-6">
				<section className="flex min-w-0 flex-1 flex-col gap-4 rounded-2xl border border-tinta/10 bg-white p-6">
					<Titulo>Tu información</Titulo>

					<Campo etiqueta="Nombre" valor={nombre} cambiar={setNombre} />

					{/* No es un <label>: no hay campo que etiquetar. El correo se
					    enseña, no se edita. */}
					<div className="flex flex-col gap-2">
						<span className="text-sm font-semibold text-tinta">Correo</span>
						<span className="flex h-[52px] items-center rounded-lg border-[1.5px] border-tinta/12 bg-gris px-4 text-base text-tinta/60">
							{comprador?.email ?? ""}
						</span>
						<span className="text-[13px] leading-[21px] text-tinta/55">
							No se puede cambiar: es con el que encontramos tus pedidos,
							incluso los que hiciste antes de tener cuenta.
						</span>
					</div>

					<Campo
						etiqueta="WhatsApp"
						valor={whatsapp}
						cambiar={setWhatsapp}
						tipo="tel"
						placeholder="Opcional, para avisarte de tu pedido"
						ayuda="El taller lo usa para dudas rápidas sobre tu diseño."
					/>
				</section>

				<section className="flex min-w-0 flex-1 flex-col gap-4 rounded-2xl border border-tinta/10 bg-white p-6">
					<div>
						<Titulo>Dirección de envío</Titulo>
						<p className="mt-1 text-[13px] leading-[21px] text-tinta/55">
							Es la que te vamos a precargar la próxima vez que pidas. Los
							pedidos que ya hiciste conservan la suya y no cambian.
						</p>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div className="col-span-2">
							<Campo
								etiqueta="Calle"
								valor={dir.calle}
								cambiar={cambiar("calle")}
							/>
						</div>
						<Campo
							etiqueta="Número"
							valor={dir.numero}
							cambiar={cambiar("numero")}
						/>
						<Campo
							etiqueta="Interior"
							valor={dir.interior}
							cambiar={cambiar("interior")}
							placeholder="Opcional"
						/>
						<Campo
							etiqueta="Colonia"
							valor={dir.colonia}
							cambiar={cambiar("colonia")}
						/>
						<Campo
							etiqueta="C.P."
							valor={dir.cp}
							cambiar={cambiar("cp")}
							modo="numeric"
						/>
						<Campo
							etiqueta="Ciudad o municipio"
							valor={dir.ciudad}
							cambiar={cambiar("ciudad")}
						/>

						<label className="flex flex-col gap-2">
							<span className="text-sm font-semibold text-tinta">Estado</span>
							<select
								value={dir.estado}
								onChange={(e) => cambiar("estado")(e.target.value)}
								className={CAMPO}
							>
								<option value="">Elige…</option>
								{ESTADOS_MX.map((n) => (
									<option key={n} value={n}>
										{n}
									</option>
								))}
							</select>
						</label>

						<div className="col-span-2">
							<Campo
								etiqueta="Referencias"
								valor={dir.referencias}
								cambiar={cambiar("referencias")}
								placeholder="Entre qué calles, color de la casa…"
							/>
						</div>
					</div>
				</section>
			</div>

			{fallo && (
				<div className="pt-5">
					<Aviso texto={fallo} />
				</div>
			)}

			<div className="flex flex-wrap items-center gap-4 pt-[22px]">
				<button
					type="submit"
					disabled={estado === "guardando" || !nombre.trim()}
					className="h-[52px] rounded-lg bg-tinta px-[26px] text-[16px] font-semibold text-lima disabled:bg-tinta/14 disabled:text-tinta/40"
				>
					{estado === "guardando" ? "Guardando…" : "Guardar cambios"}
				</button>

				{/* El aviso cambia a la confirmación en el mismo sitio: así la
				    respuesta sale donde ya se está mirando, y no arriba. */}
				{estado === "guardado" ? (
					<span className="flex items-center gap-1.5 text-[15px] font-medium text-lima-oscuro">
						<Check className="size-4" aria-hidden />
						Guardado
					</span>
				) : (
					<span className="text-[15px] text-tinta/55">
						Nada se guarda hasta que lo confirmes.
					</span>
				)}

				<button
					type="button"
					onClick={salir}
					className="ml-auto flex items-center gap-1.5 text-[15px] font-medium text-tinta/55 hover:text-tinta"
				>
					<LogOut className="size-4" aria-hidden />
					Cerrar sesión
				</button>
			</div>
		</form>
	);
}

function Titulo({ children }: { children: React.ReactNode }) {
	return (
		<h2 className="font-display text-[19px] font-semibold tracking-[-0.02em] text-tinta">
			{children}
		</h2>
	);
}

function Campo({
	etiqueta,
	valor,
	cambiar,
	tipo = "text",
	placeholder,
	modo,
	ayuda,
}: {
	etiqueta: string;
	valor: string;
	cambiar: (v: string) => void;
	tipo?: string;
	placeholder?: string;
	modo?: "numeric";
	/** Para qué sirve el dato. Va debajo, no en el placeholder: el placeholder
	 *  desaparece al escribir, justo cuando uno duda de si hizo bien. */
	ayuda?: string;
}) {
	return (
		<label className="flex flex-col gap-2">
			<span className="text-sm font-semibold text-tinta">{etiqueta}</span>
			<input
				type={tipo}
				inputMode={modo}
				placeholder={placeholder}
				value={valor}
				onChange={(e) => cambiar(e.target.value)}
				className={CAMPO}
			/>
			{ayuda && (
				<span className="text-[13px] leading-[21px] text-tinta/55">{ayuda}</span>
			)}
		</label>
	);
}
