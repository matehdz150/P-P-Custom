"use client";

import { Check, LogOut } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
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
 *
 * LA DIRECCIÓN A MEDIAS SE GUARDA, y es deliberado —del servidor, ver
 * `services/compradores/src/rutas/perfil.ts`—: es un borrador para la próxima
 * compra, no una etiqueta de envío. Lo único que el servidor sí rechaza es un
 * CP mal escrito, porque ése viaja al checkout y ahí cuesta un paquete.
 */

const CAMPO =
	"h-[52px] rounded-2xl border-[1.5px] bg-white px-4 text-base text-tinta outline-none placeholder:text-tinta/45 focus:shadow-[0_0_0_4px_rgba(43,40,18,0.04)]";

/** Sólo los dígitos: la gente escribe espacios, guiones y prefijos. */
const DIGITOS = (v: string) => v.replace(/\D/g, "");

type Estado = "cargando" | "listo" | "guardando" | "guardado";
type Errores = { nombre?: string; whatsapp?: string; cp?: string };

/**
 * Las reglas son LAS MISMAS que las de más abajo, a propósito.
 *
 * El CP lo rechaza el servidor y el teléfono lo exige el checkout. Sin
 * comprobarlo aquí, lo del CP se descubre después de un viaje de ida y vuelta,
 * y lo del teléfono días más tarde: el perfil precarga un número corto, el
 * checkout lo rechaza y nadie relaciona una cosa con la otra.
 */
function revisar(campo: keyof Errores, valor: string): string | undefined {
	const v = valor.trim();

	if (campo === "nombre") {
		return v ? undefined : "Hace falta tu nombre.";
	}

	if (campo === "cp") {
		if (!v) return undefined;
		return /^\d{5}$/.test(v)
			? undefined
			: "El código postal va a cinco dígitos.";
	}

	// Vacío está bien: el teléfono es opcional aquí. Mal escrito, no — el
	// checkout pide diez dígitos y lo va a rechazar con esto ya precargado.
	if (!v) return undefined;
	return DIGITOS(v).length >= 10
		? undefined
		: "Un teléfono mexicano son diez dígitos.";
}

export default function Ajustes() {
	const { comprador, salir } = useComprador();
	const [estado, setEstado] = useState<Estado>("cargando");
	const [fallo, setFallo] = useState<string | null>(null);
	const [errores, setErrores] = useState<Errores>({});
	const formulario = useRef<HTMLFormElement>(null);

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

	/** Cualquier campo ensucia. Antes sólo lo hacían los de la dirección, así
	 *  que cambiar el nombre después de guardar dejaba el "Guardado" puesto,
	 *  diciendo que estaba a salvo algo que no lo estaba. */
	function tocado() {
		if (estado === "guardado") setEstado("listo");
	}

	function alSalirDe(campo: keyof Errores, valor: string) {
		setErrores((e) => ({ ...e, [campo]: revisar(campo, valor) }));
	}

	async function guardar(e: React.FormEvent) {
		e.preventDefault();
		if (estado === "guardando") return;

		const encontrados: Errores = {
			nombre: revisar("nombre", nombre),
			whatsapp: revisar("whatsapp", whatsapp),
			cp: revisar("cp", dir.cp),
		};

		setErrores(encontrados);

		/* Con algo mal, el foco va al PRIMER campo inválido. Es lo que hace que
		   un error sirva a quien navega con teclado o con lector de pantalla:
		   sin esto el mensaje existe, pero hay que ir a buscarlo. */
		const primero = (["nombre", "whatsapp", "cp"] as const).find(
			(c) => encontrados[c],
		);

		if (primero) {
			formulario.current
				?.querySelector<HTMLInputElement>(`[data-campo="${primero}"]`)
				?.focus();
			return;
		}

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
		tocado();
	};

	return (
		<form
			ref={formulario}
			onSubmit={guardar}
			noValidate
			className="flex max-w-[1020px] flex-col"
		>
			<p className="-mt-3 pb-6 text-[15px] leading-[25px] text-tinta/65">
				Lo que usamos para contactarte y para mandarte lo que pides.
			</p>

			{/* Dos tarjetas lado a lado en escritorio. Se apilan en el teléfono:
			    a 375 px, dos columnas de campos son ilegibles. */}
			<div className="flex flex-col gap-6 lg:flex-row lg:gap-6">
				<section className="flex min-w-0 flex-1 flex-col gap-4 rounded-2xl border border-tinta/10 bg-white p-6">
					<Titulo>Tu información</Titulo>

					<Campo
						etiqueta="Nombre"
						valor={nombre}
						cambiar={(v) => {
							setNombre(v);
							tocado();
						}}
						alSalir={() => alSalirDe("nombre", nombre)}
						error={errores.nombre}
						campo="nombre"
					/>

					{/* No es un <label>: no hay campo que etiquetar. El correo se
					    enseña, no se edita. */}
					<div className="flex flex-col gap-2">
						<span className="text-sm font-semibold text-tinta">Correo</span>
						<span className="flex h-[52px] items-center rounded-2xl border-[1.5px] border-tinta/12 bg-gris px-4 text-base text-tinta/60">
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
						cambiar={(v) => {
							setWhatsapp(v);
							tocado();
						}}
						alSalir={() => alSalirDe("whatsapp", whatsapp)}
						error={errores.whatsapp}
						campo="whatsapp"
						tipo="tel"
						placeholder="Opcional, para avisarte de tu pedido"
						ayuda="El taller lo usa para dudas rápidas sobre tu diseño, y la paquetería para entregarte."
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
							alSalir={() => alSalirDe("cp", dir.cp)}
							error={errores.cp}
							campo="cp"
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
								className={`${CAMPO} border-tinta/14 focus:border-tinta/30`}
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
					disabled={estado === "guardando"}
					className="h-[52px] rounded-2xl bg-tinta px-[26px] text-[16px] font-semibold text-lima disabled:cursor-not-allowed disabled:bg-tinta/14 disabled:text-tinta/40"
				>
					{estado === "guardando" ? "Guardando…" : "Guardar cambios"}
				</button>

				{/* El aviso cambia a la confirmación en el mismo sitio: así la
				    respuesta sale donde ya se está mirando, y no arriba. */}
				{estado === "guardado" ? (
					// `output` y no un `span` con `role="status"`: es el elemento
					// para el resultado de un formulario, y ya lo anuncia solo.
					<output className="flex items-center gap-1.5 text-[15px] font-medium text-lima-oscuro">
						<Check className="size-4" aria-hidden />
						Guardado
					</output>
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

/**
 * Un campo, con su error debajo.
 *
 * EL ERROR VA PEGADO AL CAMPO, no en un aviso al final del formulario. Con
 * doce campos, un "revisa los datos" abajo del todo obliga a recorrerlos uno
 * por uno buscando cuál es. Y va atado con `aria-describedby` más `role`, que
 * es lo que hace que un lector de pantalla lo lea AL LLEGAR al campo en vez de
 * dejarlo perdido en la página.
 *
 * SE COMPRUEBA AL SALIR DEL CAMPO, no al escribir: marcar en rojo un código
 * postal a medias, mientras se teclea, es regañar a alguien por no haber
 * terminado.
 */
function Campo({
	etiqueta,
	valor,
	cambiar,
	alSalir,
	error,
	campo,
	tipo = "text",
	placeholder,
	modo,
	ayuda,
}: {
	etiqueta: string;
	valor: string;
	cambiar: (v: string) => void;
	alSalir?: () => void;
	error?: string;
	/** Marca el campo para poder llevarle el foco al fallar el guardado. */
	campo?: string;
	tipo?: string;
	placeholder?: string;
	modo?: "numeric";
	/** Para qué sirve el dato. Va debajo, no en el placeholder: el placeholder
	 *  desaparece al escribir, justo cuando uno duda de si hizo bien. */
	ayuda?: string;
}) {
	const id = useId();
	const idError = `${id}-error`;
	const idAyuda = `${id}-ayuda`;

	return (
		<label className="flex flex-col gap-2">
			<span className="text-sm font-semibold text-tinta">{etiqueta}</span>
			<input
				type={tipo}
				inputMode={modo}
				placeholder={placeholder}
				value={valor}
				data-campo={campo}
				onChange={(e) => cambiar(e.target.value)}
				onBlur={alSalir}
				aria-invalid={error ? true : undefined}
				aria-describedby={
					[error ? idError : null, ayuda ? idAyuda : null]
						.filter(Boolean)
						.join(" ") || undefined
				}
				className={`${CAMPO} ${
					error
						? "border-[#c0392b] focus:border-[#c0392b]"
						: "border-tinta/14 focus:border-tinta/30"
				}`}
			/>

			{error && (
				<span
					id={idError}
					role="alert"
					className="text-[13px] leading-[21px] font-medium text-[#c0392b]"
				>
					{error}
				</span>
			)}

			{ayuda && (
				<span id={idAyuda} className="text-[13px] leading-[21px] text-tinta/55">
					{ayuda}
				</span>
			)}
		</label>
	);
}
