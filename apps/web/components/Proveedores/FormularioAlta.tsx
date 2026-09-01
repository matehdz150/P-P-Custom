"use client";

import Link from "next/link";
import { useState } from "react";
import { type SolicitudProveedor, solicitarAlta } from "@/lib/api/providers";

/** Lo que define qué productos puede publicar un taller. */
const TECNICAS = [
	"Serigrafía",
	"Bordado",
	"Sublimación",
	"DTF",
	"Vinil textil",
	"Grabado láser",
	"Tampografía",
];

const PRODUCE = [
	"Playeras",
	"Sudaderas",
	"Gorras",
	"Totes",
	"Termos y vasos",
	"Otros",
];

const CAPACIDADES = [
	"Menos de 50 piezas por semana",
	"Entre 50 y 200",
	"Entre 200 y 500",
	"Más de 500",
];

const VACIA: SolicitudProveedor = {
	taller: "",
	contacto: "",
	email: "",
	whatsapp: "",
	ciudad: "",
	tecnicas: [],
	produce: [],
	capacidad: "",
	nota: "",
};

const CAMPO =
	"h-[52px] w-full rounded-lg border-[1.5px] border-tinta/18 bg-white px-4 text-base text-tinta outline-none placeholder:text-tinta/45 focus:border-tinta focus:shadow-[0_0_0_3px_rgba(174,255,110,0.55)]";

export default function FormularioAlta() {
	const [datos, setDatos] = useState<SolicitudProveedor>(VACIA);
	const [enviando, setEnviando] = useState(false);
	const [fallo, setFallo] = useState<string | null>(null);
	const [enviada, setEnviada] = useState(false);

	function set<K extends keyof SolicitudProveedor>(
		campo: K,
		valor: SolicitudProveedor[K],
	) {
		setDatos((d) => ({ ...d, [campo]: valor }));
	}

	function alternar(campo: "tecnicas" | "produce", valor: string) {
		setDatos((d) => {
			const actual = d[campo];
			return {
				...d,
				[campo]: actual.includes(valor)
					? actual.filter((v) => v !== valor)
					: [...actual, valor],
			};
		});
	}

	// Sin técnicas no sabemos qué puede producir, y sin contacto no podemos
	// responderle: esos son los mínimos, lo demás lo preguntamos después.
	const listo =
		datos.taller.trim() !== "" &&
		datos.contacto.trim() !== "" &&
		/^\S+@\S+\.\S+$/.test(datos.email.trim()) &&
		datos.whatsapp.trim() !== "" &&
		datos.ciudad.trim() !== "" &&
		datos.tecnicas.length > 0 &&
		datos.capacidad !== "";

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (!listo || enviando) return;

		setFallo(null);
		setEnviando(true);
		try {
			await solicitarAlta({
				...datos,
				taller: datos.taller.trim(),
				contacto: datos.contacto.trim(),
				email: datos.email.trim(),
				whatsapp: datos.whatsapp.trim(),
				ciudad: datos.ciudad.trim(),
				nota: datos.nota?.trim() || undefined,
			});
			setEnviada(true);
		} catch {
			setFallo(
				"No pudimos enviar tu solicitud. Inténtalo otra vez o escríbenos a [TU CORREO].",
			);
			setEnviando(false);
		}
	}

	if (enviada) return <Recibida email={datos.email.trim()} />;

	return (
		<form
			onSubmit={submit}
			className="flex w-full flex-col gap-7 rounded-xl bg-white px-6 py-8 shadow-[0_12px_40px_0_rgba(43,40,18,0.08)] md:w-[620px] md:gap-8 md:px-12 md:py-11"
		>
			<Bloque titulo="Tu taller">
				<Texto
					etiqueta="Nombre del taller"
					valor={datos.taller}
					onChange={(v) => set("taller", v)}
					placeholder="Textiles del Bajío"
				/>
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					<Texto
						etiqueta="¿Con quién hablamos?"
						valor={datos.contacto}
						onChange={(v) => set("contacto", v)}
						placeholder="Nombre y apellido"
					/>
					<Texto
						etiqueta="Ciudad y estado"
						valor={datos.ciudad}
						onChange={(v) => set("ciudad", v)}
						placeholder="León, Guanajuato"
					/>
				</div>
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					<Texto
						etiqueta="Correo"
						tipo="email"
						valor={datos.email}
						onChange={(v) => set("email", v)}
						placeholder="nombre@tutaller.com"
					/>
					<Texto
						etiqueta="WhatsApp"
						tipo="tel"
						valor={datos.whatsapp}
						onChange={(v) => set("whatsapp", v)}
						placeholder="477 123 4567"
					/>
				</div>
			</Bloque>

			<Bloque
				titulo="Qué sabes hacer"
				nota="Esto define qué productos vas a poder publicar."
			>
				<Chips
					etiqueta="Técnicas"
					opciones={TECNICAS}
					elegidas={datos.tecnicas}
					onToggle={(v) => alternar("tecnicas", v)}
				/>
				<Chips
					etiqueta="Qué produces hoy"
					opciones={PRODUCE}
					elegidas={datos.produce}
					onToggle={(v) => alternar("produce", v)}
					opcional
				/>
				<label className="flex flex-col gap-2">
					<span className="text-sm font-semibold text-tinta">
						Capacidad aproximada
					</span>
					<select
						value={datos.capacidad}
						onChange={(e) => set("capacidad", e.target.value)}
						className={`${CAMPO} cursor-pointer appearance-none bg-[length:16px] bg-[right_16px_center] bg-no-repeat pr-11`}
						style={{
							backgroundImage:
								"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 14' fill='none'%3E%3Cpath d='M3.5 5.25L7 8.75l3.5-3.5' stroke='%232b2812' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
						}}
					>
						<option value="">Elige un rango</option>
						{CAPACIDADES.map((c) => (
							<option key={c} value={c}>
								{c}
							</option>
						))}
					</select>
				</label>
			</Bloque>

			<Bloque titulo="Algo más" nota="Opcional.">
				<textarea
					value={datos.nota}
					onChange={(e) => set("nota", e.target.value)}
					rows={3}
					placeholder="Cuéntanos lo que creas que debemos saber: tus tiempos, tu mínimo, con quién trabajas hoy."
					className="w-full resize-none rounded-lg border-[1.5px] border-tinta/18 bg-white p-4 text-base leading-[26px] text-tinta outline-none placeholder:text-tinta/45 focus:border-tinta focus:shadow-[0_0_0_3px_rgba(174,255,110,0.55)]"
				/>
			</Bloque>

			{fallo && (
				<div
					role="alert"
					className="rounded-lg border border-[rgba(192,57,43,0.35)] bg-[rgba(192,57,43,0.07)] p-4 text-sm leading-[22px] text-tinta"
				>
					{fallo}
				</div>
			)}

			<div className="flex flex-col gap-3">
				<button
					type="submit"
					disabled={!listo || enviando}
					className="flex h-[54px] items-center justify-center rounded-lg bg-tinta text-[17px] font-semibold text-lima disabled:bg-tinta/14 disabled:text-tinta/40"
				>
					{enviando ? "Enviando…" : "Enviar solicitud"}
				</button>
				<span className="text-center text-[13px] leading-[21px] text-tinta/60">
					Revisamos cada solicitud a mano. Si encaja, te damos de alta y te
					mandamos tu acceso por correo.
				</span>
			</div>
		</form>
	);
}

function Recibida({ email }: { email: string }) {
	return (
		<div className="flex w-full flex-col items-center gap-4 rounded-xl bg-white px-6 py-12 text-center shadow-[0_12px_40px_0_rgba(43,40,18,0.08)] md:w-[620px] md:px-12">
			<span className="flex h-14 w-14 items-center justify-center rounded-full bg-lima">
				<svg
					width="26"
					height="26"
					viewBox="0 0 24 24"
					fill="none"
					aria-hidden="true"
				>
					<path
						d="M4.5 12.6l4.8 4.8L19.5 7.2"
						stroke="#2b2812"
						strokeWidth="2.6"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			</span>
			<h2 className="font-display text-[26px] font-semibold leading-8 tracking-[-0.032em] text-tinta md:text-[30px] md:leading-9">
				Recibimos tu solicitud
			</h2>
			<p className="max-w-[420px] text-[15px] leading-[26px] text-tinta/70">
				La revisamos a mano. Si encaja con lo que nos están pidiendo, te
				escribimos a <b className="font-semibold text-tinta">{email}</b> con tu
				acceso al panel.
			</p>
			<Link
				href="/proveedores"
				className="mt-2 flex h-12 items-center justify-center rounded-lg border-[1.5px] border-tinta px-6 text-[15px] font-semibold text-tinta"
			>
				Volver
			</Link>
		</div>
	);
}

function Bloque({
	titulo,
	nota,
	children,
}: {
	titulo: string;
	nota?: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-1 border-b border-tinta/14 pb-3">
				<span className="font-display text-[19px] font-semibold leading-6 tracking-[-0.032em] text-tinta">
					{titulo}
				</span>
				{nota && <span className="text-[13px] text-tinta/60">{nota}</span>}
			</div>
			{children}
		</div>
	);
}

function Texto({
	etiqueta,
	valor,
	onChange,
	placeholder,
	tipo = "text",
}: {
	etiqueta: string;
	valor: string;
	onChange: (v: string) => void;
	placeholder: string;
	tipo?: string;
}) {
	return (
		<label className="flex flex-col gap-2">
			<span className="text-sm font-semibold text-tinta">{etiqueta}</span>
			<input
				type={tipo}
				value={valor}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				className={CAMPO}
			/>
		</label>
	);
}

function Chips({
	etiqueta,
	opciones,
	elegidas,
	onToggle,
	opcional = false,
}: {
	etiqueta: string;
	opciones: string[];
	elegidas: string[];
	onToggle: (v: string) => void;
	opcional?: boolean;
}) {
	return (
		<div className="flex flex-col gap-2.5">
			<span className="text-sm font-semibold text-tinta">
				{etiqueta}
				{opcional && (
					<span className="ml-1.5 font-normal text-tinta/50">opcional</span>
				)}
			</span>
			<div className="flex flex-wrap gap-2">
				{opciones.map((o) => {
					const activo = elegidas.includes(o);
					return (
						<button
							key={o}
							type="button"
							onClick={() => onToggle(o)}
							aria-pressed={activo}
							className={`h-11 rounded-lg px-4 text-[15px] ${
								activo
									? "bg-lima font-semibold text-tinta"
									: "border-[1.5px] border-tinta/15 font-medium text-tinta"
							}`}
						>
							{o}
						</button>
					);
				})}
			</div>
		</div>
	);
}
