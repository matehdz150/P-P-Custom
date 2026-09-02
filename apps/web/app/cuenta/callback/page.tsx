"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useComprador } from "@/Contexts/CompradorContext";
import { completarEntrada, ErrorEntrada } from "@/lib/auth/comprador";

/**
 * La vuelta de Cognito.
 *
 * Cognito manda aquí con `?code=…&state=…`. Se cambia el código por los
 * tokens y se devuelve al comprador a donde estaba.
 *
 * Va envuelta en <Suspense> porque `useSearchParams` lo exige: sin él revienta
 * el pre-renderizado, y el sitio se compila estático.
 */
export default function CallbackPage() {
	return (
		<Suspense fallback={<Estado texto="Entrando…" />}>
			<Callback />
		</Suspense>
	);
}

function Callback() {
	const params = useSearchParams();
	const router = useRouter();
	const { refrescar } = useComprador();
	const [fallo, setFallo] = useState<string | null>(null);

	/**
	 * El código de autorización sirve UNA vez: si se canjea dos veces Cognito
	 * rechaza la segunda y la pantalla se queda en un error que no es real.
	 * En modo estricto React monta el efecto dos veces, así que hace falta el
	 * guardia — y por eso mismo aquí no hay temporizador ni limpieza que
	 * cancele nada: esa combinación ya dejó una pantalla girando para siempre
	 * en `Designer/SalidaAPedir.tsx`.
	 */
	const yaCorrio = useRef(false);

	useEffect(() => {
		if (yaCorrio.current) return;
		yaCorrio.current = true;

		const code = params.get("code");
		const estado = params.get("state");
		const errorDeCognito =
			params.get("error_description") ?? params.get("error");

		if (errorDeCognito) {
			setFallo(errorDeCognito);
			return;
		}

		if (!code) {
			setFallo("Llegaste aquí sin un código de acceso.");
			return;
		}

		completarEntrada(code, estado)
			.then((destino) => {
				refrescar();
				// replace y no push: el código ya se gastó, y volver atrás a esta
				// URL sólo daría un error.
				router.replace(destino);
			})
			.catch((error) => {
				setFallo(
					error instanceof ErrorEntrada
						? error.message
						: "No pudimos completar el acceso.",
				);
			});
	}, [params, router, refrescar]);

	if (fallo) {
		return (
			<Estado texto="No pudimos entrar">
				<p className="mt-2 max-w-sm text-[15px] text-tinta/60">{fallo}</p>
				<Link
					href="/"
					className="mt-6 inline-flex h-11 items-center rounded-full bg-tinta px-5 text-[15px] font-semibold text-hueso-suave"
				>
					Volver al inicio
				</Link>
			</Estado>
		);
	}

	return <Estado texto="Entrando…" />;
}

function Estado({
	texto,
	children,
}: {
	texto: string;
	children?: React.ReactNode;
}) {
	return (
		<main className="flex min-h-screen flex-col items-center justify-center bg-hueso px-6 text-center">
			<p className="font-display text-2xl font-semibold tracking-[-0.032em] text-tinta">
				{texto}
			</p>
			{children}
		</main>
	);
}
