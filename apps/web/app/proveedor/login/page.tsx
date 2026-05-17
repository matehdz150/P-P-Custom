"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { providerLogin } from "@/lib/api/providers";

export default function ProviderLoginPage() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setLoading(true);
		try {
			await providerLogin(email.trim(), password);
			router.push("/proveedor");
		} catch {
			setError("Correo o contraseña incorrectos");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="min-h-screen flex items-center justify-center bg-[#f9f8f5] px-6">
			<form
				onSubmit={submit}
				className="w-full max-w-sm bg-white border rounded-2xl p-8 space-y-5 shadow-sm"
			>
				<div>
					<h1 className="text-2xl font-bold">Portal de proveedores</h1>
					<p className="text-sm text-muted-foreground mt-1">
						Inicia sesión para gestionar tus productos.
					</p>
				</div>

				<div className="space-y-3">
					<Input
						type="email"
						placeholder="correo@proveedor.com"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
					/>
					<Input
						type="password"
						placeholder="Contraseña"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
					/>
				</div>

				{error && <p className="text-sm text-red-600">{error}</p>}

				<Button
					type="submit"
					disabled={loading}
					className="w-full bg-[#fe6241] text-black hover:bg-[#e5573a]"
				>
					{loading ? "Entrando…" : "Iniciar sesión"}
				</Button>

				<p className="text-xs text-center text-muted-foreground">
					¿No tienes cuenta? Pídela al administrador.
				</p>
			</form>
		</div>
	);
}
