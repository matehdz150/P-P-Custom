"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useProviderAuth } from "@/Contexts/ProviderAuthContext";
import {
	CambioDeContrasena,
	ErrorCognito,
	entrar,
	establecerContrasena,
} from "@/lib/auth/cognito";

/**
 * Entrada de proveedores.
 *
 * El navegador habla directo con Cognito: no hay endpoint nuestro de login.
 * Son dos pasos porque el alta la hace el admin con una contraseña temporal,
 * y Cognito no entrega tokens hasta que el taller elige la suya.
 */

/** Los fallos que el formulario puede distinguir de verdad. */
const MENSAJES = {
	credenciales: {
		titulo: "Correo o contraseña incorrectos",
		texto:
			"Vuelve a intentar. Si no logras entrar, escríbenos a [TU CORREO] y te reponemos el acceso.",
		grave: true,
	},
	red: {
		titulo: "No pudimos conectar",
		texto: "Revisa tu internet e inténtalo de nuevo.",
		grave: false,
	},
	contrasena: {
		titulo: "Esa contraseña no se puede usar",
		texto: "Necesita al menos 10 caracteres, con una letra y un número.",
		grave: true,
	},
	configuracion: {
		titulo: "El acceso está mal configurado",
		texto:
			"No es tu cuenta: el problema es nuestro. Escríbenos y lo arreglamos; el detalle está en la consola del navegador.",
		grave: true,
	},
} as const;

type Fallo = keyof typeof MENSAJES;

export default function ProviderLoginPage() {
	const router = useRouter();
	const { refresh } = useProviderAuth();

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [verPassword, setVerPassword] = useState(false);
	const [fallo, setFallo] = useState<Fallo | null>(null);
	const [enviando, setEnviando] = useState(false);

	// Cuando Cognito pide contraseña nueva, la pantalla cambia de paso sin
	// perder el reto: la misma sesión hay que devolvérsela.
	const [reto, setReto] = useState<CambioDeContrasena | null>(null);
	const [nueva, setNueva] = useState("");
	const [repetida, setRepetida] = useState("");

	const listo = reto
		? nueva.length >= 10 && nueva === repetida
		: email.trim().length > 0 && password.length > 0;

	async function terminar() {
		// Sin esto el contexto sigue con provider en null y el panel rebota
		// de vuelta al login.
		await refresh();
		router.replace("/proveedor");
	}

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (!listo || enviando) return;

		setFallo(null);
		setEnviando(true);

		try {
			if (reto) {
				await establecerContrasena(reto, nueva);
			} else {
				await entrar(email.trim().toLowerCase(), password);
			}
			await terminar();
		} catch (error) {
			if (error instanceof CambioDeContrasena) {
				// No es un fallo: es el segundo paso del alta.
				setReto(error);
				setEnviando(false);
				return;
			}

			// Sólo un rechazo explícito de Cognito habilita hablar de
			// credenciales. Decirle a alguien que su contraseña está mal
			// cuando lo que falló fue la red lo manda a cambiarla sin motivo.
			if (error instanceof ErrorCognito) {
				// El tipo de Cognito, a la consola: sin él, un 400 de
				// configuración se ve idéntico a uno de contraseña mal y se
				// busca el problema donde no está.
				console.error(
					`Cognito rechazó el login (${error.tipo}): ${error.message}`,
				);

				setFallo(
					error.tipo === "InvalidPasswordException"
						? "contrasena"
						: error.sonCredenciales
							? "credenciales"
							: error.esConfiguracion
								? "configuracion"
								: "red",
				);
			} else {
				setFallo("red");
			}
			setEnviando(false);
		}
	}

	return (
		<div className="font-brand relative flex min-h-screen flex-col items-center justify-center gap-[22px] overflow-hidden bg-gris px-5 text-tinta md:gap-[26px]">
			{/* Los aros del hero de proveedores, bajados casi a nada. */}
			<svg
				className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
				width="1400"
				height="1400"
				viewBox="0 0 1400 1400"
				fill="none"
				aria-hidden="true"
			>
				<circle
					cx="700"
					cy="700"
					r="640"
					stroke="rgba(43,40,18,0.07)"
					strokeWidth="1.2"
					fill="none"
				/>
				<circle
					cx="700"
					cy="700"
					r="450"
					stroke="rgba(43,40,18,0.06)"
					strokeWidth="1.2"
					fill="none"
				/>
				<circle
					cx="700"
					cy="700"
					r="280"
					stroke="rgba(43,40,18,0.05)"
					strokeWidth="1.2"
					fill="none"
				/>
			</svg>

			<form
				onSubmit={submit}
				className="relative flex w-full flex-col gap-6 rounded-xl bg-white px-6 py-8 shadow-[0_12px_40px_0_rgba(43,40,18,0.08)] md:w-[480px] md:gap-7 md:px-12 md:py-11"
			>
				<div className="flex flex-col items-center gap-2.5 md:gap-3">
					<span className="font-brand text-[28px] font-semibold leading-none tracking-[-0.05em] text-tinta md:text-[32px]">
						kustto
					</span>
					<h1 className="text-center font-display text-[25px] font-semibold leading-8 tracking-[-0.032em] text-tinta md:text-[28px] md:leading-9">
						{reto ? "Elige tu contraseña" : "Entra a producir"}
					</h1>
					<p className="text-center text-sm leading-[23px] text-tinta/70 md:max-w-[320px] md:text-[15px] md:leading-[25px]">
						{reto
							? "La que te dimos era temporal. Esta ya es tuya y no la vemos."
							: "Tus productos, tus precios y los pedidos que te toca sacar."}
					</p>
				</div>

				<div className="flex flex-col gap-[15px] md:gap-4">
					{reto ? (
						<>
							<Contrasena
								etiqueta="Contraseña nueva"
								valor={nueva}
								cambiar={setNueva}
								ver={verPassword}
								alternar={() => setVerPassword((v) => !v)}
								autoComplete="new-password"
							/>
							<label className="flex flex-col gap-2">
								<span className="text-sm font-semibold text-tinta">
									Repítela
								</span>
								<input
									type={verPassword ? "text" : "password"}
									autoComplete="new-password"
									value={repetida}
									onChange={(e) => setRepetida(e.target.value)}
									className={CAMPO}
								/>
							</label>
							<span className="text-[13px] leading-[21px] text-tinta/60">
								Mínimo 10 caracteres, con una letra y un número.
							</span>
						</>
					) : (
						<>
							<label className="flex flex-col gap-2">
								<span className="text-sm font-semibold text-tinta">Correo</span>
								<input
									type="email"
									autoComplete="username"
									placeholder="nombre@tutaller.com"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									className={CAMPO}
								/>
							</label>

							<Contrasena
								etiqueta="Contraseña"
								valor={password}
								cambiar={setPassword}
								ver={verPassword}
								alternar={() => setVerPassword((v) => !v)}
								autoComplete="current-password"
							/>
						</>
					)}

					{fallo && <Aviso fallo={fallo} />}

					<button
						type="submit"
						disabled={!listo || enviando}
						className="flex h-[54px] items-center justify-center gap-[11px] rounded-lg bg-tinta text-[17px] font-semibold text-lima disabled:bg-tinta/14 disabled:text-tinta/40"
					>
						{enviando ? (
							<>
								<Spinner />
								{reto ? "Guardando…" : "Entrando…"}
							</>
						) : reto ? (
							"Guardar y entrar"
						) : (
							"Iniciar sesión"
						)}
					</button>
				</div>

				<span className="text-center text-[13px] leading-[22px] text-tinta/65 md:text-sm md:leading-[23px]">
					Las cuentas de proveedor las damos de alta nosotros.{" "}
					<Link href="/proveedores" className="font-semibold text-tinta">
						Conoce kustto para proveedores
					</Link>
				</span>
			</form>

			<div className="relative flex items-center gap-4 md:gap-[22px]">
				<span className="text-xs text-tinta/50 md:text-[13px]">
					© 2026 kustto
				</span>
				<Link href="#" className="text-xs text-tinta/50 md:text-[13px]">
					Aviso de privacidad
				</Link>
				<Link href="/catalogo" className="text-xs text-tinta/50 md:text-[13px]">
					Soy comprador
				</Link>
			</div>
		</div>
	);
}

/** El campo: mismo alto y borde en los dos, con el halo lima al enfocar. */
const CAMPO =
	"h-[52px] rounded-lg border-[1.5px] border-tinta/18 bg-white px-4 text-base text-tinta outline-none placeholder:text-tinta/45 focus:border-tinta focus:shadow-[0_0_0_3px_rgba(174,255,110,0.55)]";

function Contrasena({
	etiqueta,
	valor,
	cambiar,
	ver,
	alternar,
	autoComplete,
}: {
	etiqueta: string;
	valor: string;
	cambiar: (v: string) => void;
	ver: boolean;
	alternar: () => void;
	autoComplete: string;
}) {
	return (
		<label className="flex flex-col gap-2">
			<span className="text-sm font-semibold text-tinta">{etiqueta}</span>
			<span
				className={`flex items-center gap-3 ${CAMPO} focus-within:border-tinta focus-within:shadow-[0_0_0_3px_rgba(174,255,110,0.55)]`}
			>
				<input
					type={ver ? "text" : "password"}
					autoComplete={autoComplete}
					value={valor}
					onChange={(e) => cambiar(e.target.value)}
					className="min-w-0 flex-1 bg-transparent text-base text-tinta outline-none"
				/>
				<button
					type="button"
					onClick={alternar}
					aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"}
					className="shrink-0 text-tinta/55 hover:text-tinta"
				>
					<Ojo tachado={ver} />
				</button>
			</span>
		</label>
	);
}

function Aviso({ fallo }: { fallo: Fallo }) {
	const { titulo, texto, grave } = MENSAJES[fallo];

	return (
		<div
			role="alert"
			className={`flex items-start gap-[11px] rounded-lg border p-4 ${
				grave
					? "border-[rgba(192,57,43,0.35)] bg-[rgba(192,57,43,0.07)]"
					: "border-tinta/20 bg-gris"
			}`}
		>
			<svg
				width="19"
				height="19"
				viewBox="0 0 24 24"
				fill="none"
				aria-hidden="true"
				className={`mt-px shrink-0 ${grave ? "text-[#c0392b]" : "text-tinta"}`}
			>
				<circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
				<path
					d="M12 7.6v5.2M12 16.2v.2"
					stroke="currentColor"
					strokeWidth="1.8"
					strokeLinecap="round"
				/>
			</svg>
			<div className="flex flex-col gap-[3px]">
				<span className="text-[15px] font-semibold text-tinta">{titulo}</span>
				<span className="text-sm leading-[22px] text-tinta/70">{texto}</span>
			</div>
		</div>
	);
}

function Spinner() {
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden="true"
			className="animate-spin"
		>
			<circle
				cx="12"
				cy="12"
				r="9"
				stroke="currentColor"
				strokeWidth="2.4"
				opacity="0.3"
			/>
			<path
				d="M21 12a9 9 0 0 0-9-9"
				stroke="currentColor"
				strokeWidth="2.4"
				strokeLinecap="round"
			/>
		</svg>
	);
}

function Ojo({ tachado }: { tachado: boolean }) {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden="true"
		>
			<path
				d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinejoin="round"
			/>
			<circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
			{tachado && (
				<path
					d="M4 20 20 4"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
				/>
			)}
		</svg>
	);
}
