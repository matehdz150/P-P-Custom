"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useComprador } from "@/Contexts/CompradorContext";
import {
	confirmarRegistro,
	ErrorEntrada,
	entrar,
	entrarConCorreo,
	reenviarCodigo,
	registrar,
} from "@/lib/auth/comprador";

/**
 * Entrar o crear cuenta. Pantalla NUESTRA, a propósito.
 *
 * Cognito trae una interfaz alojada que hace esto mismo y se descartó: es
 * genérica y es lo primero que ve alguien que va a comprar.
 *
 * Google es la excepción y no puede no serlo: su pantalla de consentimiento
 * vive en accounts.google.com y nadie puede replicarla. Lo que sí se evita es
 * la de Cognito en medio — `entrar({ proveedor: "Google" })` manda directo a
 * Google con `identity_provider`, así que el salto es de aquí a Google y de
 * Google a la tienda.
 */

const MENSAJES = {
	credenciales: {
		titulo: "Correo o contraseña incorrectos",
		texto: "Revísalos e inténtalo otra vez.",
	},
	yaExiste: {
		titulo: "Ese correo ya tiene cuenta",
		texto: "Entra con tu contraseña, o con Google si así la creaste.",
	},
	contrasena: {
		titulo: "Esa contraseña no se puede usar",
		texto: "Necesita al menos 10 caracteres, con una letra y un número.",
	},
	codigo: {
		titulo: "Ese código no es válido",
		texto: "Revisa que sean los seis dígitos del correo, o pide uno nuevo.",
	},
	limite: {
		titulo: "Demasiados intentos",
		texto: "Espera un minuto y vuelve a probar.",
	},
	red: {
		titulo: "No pudimos conectar",
		texto: "Revisa tu internet e inténtalo de nuevo.",
	},
	configuracion: {
		titulo: "El acceso está mal configurado",
		texto:
			"No es tu cuenta: el problema es nuestro. El detalle está en la consola del navegador.",
	},
} as const;

type Fallo = keyof typeof MENSAJES;
type Modo = "entrar" | "registro" | "codigo";

export default function EntrarPage() {
	return (
		<Suspense fallback={<Marco>{null}</Marco>}>
			<Entrar />
		</Suspense>
	);
}

function Entrar() {
	const router = useRouter();
	const params = useSearchParams();
	const { refrescar } = useComprador();

	const [modo, setModo] = useState<Modo>("entrar");
	const [nombre, setNombre] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [codigo, setCodigo] = useState("");
	const [verPassword, setVerPassword] = useState(false);
	const [fallo, setFallo] = useState<Fallo | null>(null);
	const [enviando, setEnviando] = useState(false);
	const [reenviado, setReenviado] = useState(false);

	/* Sin `?volver=` se cae a `/cuenta`, no a la portada.
	
	   Quien entra por su cuenta viene a ver sus pedidos, no a mirar el escaparate
	   otra vez; devolverlo a la portada lo obliga a buscar el enlace de su
	   cuenta justo después de identificarse. Cuando SÍ hay `volver` —el
	   candado del carrito, un enlace a un pedido— manda ése, que es de donde lo
	   sacamos. */
	const volver = params.get("volver") ?? "/cuenta";

	const listo =
		modo === "entrar"
			? email.trim().length > 0 && password.length > 0
			: modo === "registro"
				? nombre.trim().length > 0 &&
					email.trim().length > 0 &&
					password.length >= 10
				: codigo.trim().length >= 6;

	function traducir(error: unknown): Fallo {
		if (!(error instanceof ErrorEntrada)) return "red";

		// El tipo a la consola: sin él, un fallo de configuración se ve idéntico
		// a una contraseña mal y se busca el problema donde no está.
		console.error(
			`Cognito rechazó el acceso (${error.tipo}): ${error.message}`,
		);

		switch (error.tipo) {
			case "NotAuthorizedException":
			case "UserNotFoundException":
				return "credenciales";
			case "UsernameExistsException":
				return "yaExiste";
			case "InvalidPasswordException":
				return "contrasena";
			case "CodeMismatchException":
			case "ExpiredCodeException":
				return "codigo";
			case "LimitExceededException":
			case "TooManyRequestsException":
				return "limite";
			case "Config":
			case "ResourceNotFoundException":
			case "InvalidParameterException":
				return "configuracion";
			default:
				return "red";
		}
	}

	async function terminar() {
		// Sin esto el contexto sigue en null y la cabecera no se entera.
		refrescar();
		router.replace(volver);
	}

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (!listo || enviando) return;

		setFallo(null);
		setEnviando(true);
		const correo = email.trim().toLowerCase();

		try {
			if (modo === "entrar") {
				await entrarConCorreo(correo, password);
				await terminar();
				return;
			}

			if (modo === "registro") {
				const { confirmado } = await registrar(nombre.trim(), correo, password);

				// Con el correo autoverificado esto casi siempre pide código; si
				// alguna vez no lo pidiera, entrar directo es lo correcto.
				if (confirmado) {
					await entrarConCorreo(correo, password);
					await terminar();
					return;
				}

				setModo("codigo");
				setEnviando(false);
				return;
			}

			await confirmarRegistro(correo, codigo.trim());
			// Ya confirmada, se entra con lo que la persona acaba de teclear:
			// pedirle la contraseña otra vez sería un paso de más.
			await entrarConCorreo(correo, password);
			await terminar();
		} catch (error) {
			const traducido = traducir(error);

			// Cognito no deja entrar a quien no confirmó su correo. No es un
			// fallo: es que le falta el paso del código.
			if (
				error instanceof ErrorEntrada &&
				error.tipo === "UserNotConfirmedException"
			) {
				setModo("codigo");
				setEnviando(false);
				return;
			}

			setFallo(traducido);
			setEnviando(false);
		}
	}

	const titulo =
		modo === "entrar"
			? "Entra a lo tuyo"
			: modo === "registro"
				? "Crea tu cuenta"
				: "Revisa tu correo";

	const bajada =
		modo === "entrar"
			? "Tus diseños y tus pedidos, donde los dejaste."
			: modo === "registro"
				? "Para guardar tus diseños y seguir tus pedidos."
				: `Te mandamos un código de seis dígitos a ${email.trim().toLowerCase()}.`;

	return (
		<Marco>
			<form
				onSubmit={submit}
				className="relative flex w-full flex-col gap-6 rounded-2xl bg-white px-6 py-8 shadow-[0_12px_40px_0_rgba(43,40,18,0.08)] md:w-[456px] md:gap-7 md:px-11 md:py-10"
			>
				<div className="flex flex-col items-center gap-2.5">
					<Link
						href="/"
						className="font-brand text-[28px] font-semibold leading-none tracking-[-0.05em] text-tinta md:text-[32px]"
					>
						kustto
					</Link>
					<h1 className="text-center font-display text-[25px] font-semibold leading-8 tracking-[-0.032em] text-tinta md:text-[28px] md:leading-9">
						{titulo}
					</h1>
					<p className="text-center text-sm leading-[23px] text-tinta/70 md:max-w-[300px] md:text-[15px] md:leading-[25px]">
						{bajada}
					</p>
				</div>

				{modo !== "codigo" && (
					<>
						<button
							type="button"
							onClick={() => entrar({ proveedor: "Google", destino: volver })}
							className="flex h-[54px] items-center justify-center gap-3 rounded-lg border-[1.5px] border-tinta/18 bg-white text-[16px] font-semibold text-tinta hover:border-tinta/40"
						>
							<LogoGoogle />
							Continuar con Google
						</button>

						<div className="flex items-center gap-3">
							<span className="h-px flex-1 bg-tinta/12" />
							<span className="text-[13px] text-tinta/50">o con tu correo</span>
							<span className="h-px flex-1 bg-tinta/12" />
						</div>
					</>
				)}

				<div className="flex flex-col gap-4">
					{modo === "registro" && (
						<Campo
							etiqueta="Tu nombre"
							tipo="text"
							autoComplete="name"
							placeholder="Como quieres que te digamos"
							valor={nombre}
							cambiar={setNombre}
						/>
					)}

					{modo !== "codigo" && (
						<>
							<Campo
								etiqueta="Correo"
								tipo="email"
								autoComplete="username"
								placeholder="tu@correo.com"
								valor={email}
								cambiar={setEmail}
							/>

							<label className="flex flex-col gap-2">
								<span className="text-sm font-semibold text-tinta">
									Contraseña
								</span>
								<span
									className={`flex items-center gap-3 ${CAMPO} focus-within:border-tinta focus-within:shadow-[0_0_0_3px_rgba(174,255,110,0.55)]`}
								>
									<input
										type={verPassword ? "text" : "password"}
										autoComplete={
											modo === "registro" ? "new-password" : "current-password"
										}
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										className="min-w-0 flex-1 bg-transparent text-base text-tinta outline-none"
									/>
									<button
										type="button"
										onClick={() => setVerPassword((v) => !v)}
										aria-label={
											verPassword ? "Ocultar contraseña" : "Mostrar contraseña"
										}
										className="shrink-0 text-tinta/55 hover:text-tinta"
									>
										<Ojo tachado={verPassword} />
									</button>
								</span>
							</label>

							{modo === "registro" && (
								<span className="text-[13px] leading-[21px] text-tinta/60">
									Mínimo 10 caracteres, con una letra y un número.
								</span>
							)}
						</>
					)}

					{modo === "codigo" && (
						<>
							<Campo
								etiqueta="Código"
								tipo="text"
								autoComplete="one-time-code"
								placeholder="000000"
								valor={codigo}
								cambiar={setCodigo}
								modoTexto="numeric"
							/>
							<button
								type="button"
								onClick={async () => {
									try {
										await reenviarCodigo(email.trim().toLowerCase());
										setReenviado(true);
									} catch (error) {
										setFallo(traducir(error));
									}
								}}
								className="self-start text-[13px] font-semibold text-tinta underline underline-offset-2"
							>
								{reenviado
									? "Código reenviado"
									: "No me llegó, mándalo otra vez"}
							</button>
						</>
					)}

					{fallo && <Aviso fallo={fallo} />}

					<button
						type="submit"
						disabled={!listo || enviando}
						className="flex h-[54px] items-center justify-center gap-[11px] rounded-lg bg-tinta text-[17px] font-semibold text-lima disabled:bg-tinta/14 disabled:text-tinta/40"
					>
						{enviando && <Spinner />}
						{enviando
							? "Un momento…"
							: modo === "entrar"
								? "Iniciar sesión"
								: modo === "registro"
									? "Crear cuenta"
									: "Confirmar y entrar"}
					</button>
				</div>

				{modo !== "codigo" && (
					<span className="text-center text-sm leading-[23px] text-tinta/65">
						{modo === "entrar"
							? "¿Todavía no tienes cuenta? "
							: "¿Ya tienes cuenta? "}
						<button
							type="button"
							onClick={() => {
								setModo(modo === "entrar" ? "registro" : "entrar");
								setFallo(null);
							}}
							className="font-semibold text-tinta underline underline-offset-2"
						>
							{modo === "entrar" ? "Créala" : "Entra"}
						</button>
					</span>
				)}
			</form>
		</Marco>
	);
}

function Marco({ children }: { children: React.ReactNode }) {
	return (
		<div className="font-brand flex min-h-screen flex-col items-center justify-center gap-[22px] bg-hueso px-5 py-10 text-tinta">
			{children}
			<div className="flex items-center gap-4 md:gap-[22px]">
				<span className="text-xs text-tinta/50 md:text-[13px]">
					© 2026 kustto
				</span>
				<Link href="/catalogo" className="text-xs text-tinta/50 md:text-[13px]">
					Ver el catálogo
				</Link>
				<Link
					href="/proveedores"
					className="text-xs text-tinta/50 md:text-[13px]"
				>
					Soy proveedor
				</Link>
			</div>
		</div>
	);
}

/** El campo: mismo alto y borde en todos, con el halo lima al enfocar. */
const CAMPO =
	"h-[52px] rounded-lg border-[1.5px] border-tinta/18 bg-white px-4 text-base text-tinta outline-none placeholder:text-tinta/45 focus:border-tinta focus:shadow-[0_0_0_3px_rgba(174,255,110,0.55)]";

function Campo({
	etiqueta,
	tipo,
	autoComplete,
	placeholder,
	valor,
	cambiar,
	modoTexto,
}: {
	etiqueta: string;
	tipo: string;
	autoComplete: string;
	placeholder?: string;
	valor: string;
	cambiar: (v: string) => void;
	modoTexto?: "numeric";
}) {
	return (
		<label className="flex flex-col gap-2">
			<span className="text-sm font-semibold text-tinta">{etiqueta}</span>
			<input
				type={tipo}
				inputMode={modoTexto}
				autoComplete={autoComplete}
				placeholder={placeholder}
				value={valor}
				onChange={(e) => cambiar(e.target.value)}
				className={CAMPO}
			/>
		</label>
	);
}

function Aviso({ fallo }: { fallo: Fallo }) {
	const { titulo, texto } = MENSAJES[fallo];

	return (
		<div
			role="alert"
			className="flex items-start gap-[11px] rounded-lg border border-[rgba(192,57,43,0.35)] bg-[rgba(192,57,43,0.07)] p-4"
		>
			<svg
				width="19"
				height="19"
				viewBox="0 0 24 24"
				fill="none"
				aria-hidden="true"
				className="mt-px shrink-0 text-[#c0392b]"
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

function LogoGoogle() {
	return (
		<svg width="19" height="19" viewBox="0 0 48 48" aria-hidden="true">
			<path
				fill="#4285F4"
				d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17Z"
			/>
			<path
				fill="#34A853"
				d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46Z"
			/>
			<path
				fill="#FBBC05"
				d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7Z"
			/>
			<path
				fill="#EA4335"
				d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07Z"
			/>
		</svg>
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
					d="M4 4l16 16"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
				/>
			)}
		</svg>
	);
}
