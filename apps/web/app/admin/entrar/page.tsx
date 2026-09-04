"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAdminAuth } from "@/Contexts/AdminAuthContext";
import {
	CambioDeContrasena,
	ErrorCognito,
	entrar,
	establecerContrasena,
} from "@/lib/auth/admin";

/**
 * Entrar al backoffice.
 *
 * El navegador habla directo con Cognito: no hay endpoint nuestro de login.
 * Son dos pasos porque las cuentas las creamos nosotros con una contraseña
 * temporal (`infra/crear-admin.sh`), y Cognito no entrega tokens hasta que la
 * persona elige la suya.
 *
 * NO DICE SI EL CORREO EXISTE. El pool tiene `PreventUserExistenceErrors`, así
 * que Cognito contesta igual a un correo desconocido y a una contraseña mala.
 * Esta pantalla lo respeta: un backoffice que confirma qué correos administran
 * el negocio es una lista de a quién atacar.
 */

const MENSAJES = {
	credenciales: {
		titulo: "Correo o contraseña incorrectos",
		texto:
			"Vuelve a intentarlo. Si perdiste el acceso, pídele a alguien del equipo que te lo reponga.",
	},
	red: {
		titulo: "No pudimos conectar",
		texto: "Revisa tu internet e inténtalo de nuevo.",
	},
	contrasena: {
		titulo: "Esa contraseña no se puede usar",
		texto:
			"Necesita 12 caracteres o más, con mayúscula, minúscula, número y símbolo.",
	},
	configuracion: {
		titulo: "El acceso está mal configurado",
		texto:
			"No es tu cuenta: el problema es nuestro. El detalle está en la consola del navegador.",
	},
} as const;

type Fallo = keyof typeof MENSAJES;

export default function EntrarAlBackoffice() {
	const router = useRouter();
	const { refrescar } = useAdminAuth();

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [fallo, setFallo] = useState<Fallo | null>(null);
	const [enviando, setEnviando] = useState(false);

	/* Cuando Cognito pide contraseña nueva, la pantalla cambia de paso sin
	   perder la sesión del reto: sin ella no se puede responder. */
	const [reto, setReto] = useState<CambioDeContrasena | null>(null);
	const [nueva, setNueva] = useState("");

	function interpretar(error: unknown): Fallo {
		if (!(error instanceof ErrorCognito)) return "red";
		if (error.esConfiguracion) return "configuracion";
		if (error.sonCredenciales) return "credenciales";
		if (error.tipo === "InvalidPasswordException") return "contrasena";
		return "red";
	}

	async function alEntrar(e: React.FormEvent) {
		e.preventDefault();
		if (enviando) return;

		setFallo(null);
		setEnviando(true);

		try {
			await entrar(email.trim().toLowerCase(), password);
			await refrescar();
			router.replace("/admin");
		} catch (error) {
			if (error instanceof CambioDeContrasena) {
				setReto(error);
				setEnviando(false);
				return;
			}

			setFallo(interpretar(error));
			setEnviando(false);
		}
	}

	async function alCambiar(e: React.FormEvent) {
		e.preventDefault();
		if (enviando || !reto) return;

		setFallo(null);
		setEnviando(true);

		try {
			await establecerContrasena(reto, nueva);
			await refrescar();
			router.replace("/admin");
		} catch (error) {
			setFallo(interpretar(error));
			setEnviando(false);
		}
	}

	const aviso = fallo ? MENSAJES[fallo] : null;

	return (
		<main className="flex min-h-screen items-center justify-center bg-muted/30 px-5">
			<div className="w-full max-w-[400px] rounded-xl border bg-background p-8 shadow-sm">
				<h1 className="text-2xl font-bold tracking-tight">Backoffice</h1>
				<p className="pt-1 text-sm text-muted-foreground">
					{reto
						? "Elige una contraseña para tu cuenta."
						: "Entra con tu cuenta de administrador."}
				</p>

				{aviso && (
					<div
						role="alert"
						className="mt-5 rounded-lg border border-destructive/30 bg-destructive/5 p-3"
					>
						<p className="text-sm font-semibold text-destructive">
							{aviso.titulo}
						</p>
						<p className="pt-0.5 text-[13px] leading-5 text-muted-foreground">
							{aviso.texto}
						</p>
					</div>
				)}

				{reto ? (
					<form onSubmit={alCambiar} className="mt-6 flex flex-col gap-4">
						<label className="flex flex-col gap-1.5">
							<span className="text-sm font-medium">Contraseña nueva</span>
							<input
								type="password"
								value={nueva}
								onChange={(e) => setNueva(e.target.value)}
								autoComplete="new-password"
								required
								minLength={12}
								className="h-11 rounded-lg border bg-background px-3 text-[15px] outline-none focus:border-foreground/40"
							/>
						</label>

						<button
							type="submit"
							disabled={enviando}
							className="h-11 rounded-lg bg-foreground text-[15px] font-semibold text-background disabled:opacity-60"
						>
							{enviando ? "Guardando…" : "Guardar y entrar"}
						</button>
					</form>
				) : (
					<form onSubmit={alEntrar} className="mt-6 flex flex-col gap-4">
						<label className="flex flex-col gap-1.5">
							<span className="text-sm font-medium">Correo</span>
							<input
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								autoComplete="username"
								required
								className="h-11 rounded-lg border bg-background px-3 text-[15px] outline-none focus:border-foreground/40"
							/>
						</label>

						<label className="flex flex-col gap-1.5">
							<span className="text-sm font-medium">Contraseña</span>
							<input
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								autoComplete="current-password"
								required
								className="h-11 rounded-lg border bg-background px-3 text-[15px] outline-none focus:border-foreground/40"
							/>
						</label>

						<button
							type="submit"
							disabled={enviando}
							className="h-11 rounded-lg bg-foreground text-[15px] font-semibold text-background disabled:opacity-60"
						>
							{enviando ? "Entrando…" : "Entrar"}
						</button>
					</form>
				)}
			</div>
		</main>
	);
}
