"use client";

import { Apple, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { loginUser } from "@/lib/api/api";

export default function LoginPage() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function handleLogin(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		if (!email.trim() || !password) {
			setError("Ingresa tu correo y contraseña");
			return;
		}
		setLoading(true);
		try {
			await loginUser(email.trim(), password);
			window.location.href = "/catalogo";
		} catch {
			setError("Correo o contraseña incorrectos");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="min-h-screen grid grid-cols-1 md:grid-cols-[40%_60%] bg-[#fbfaf6] font-sora">
			{/* LEFT – Visual */}
			<div className="relative hidden md:block">
				<Image
					src="/flyers/flyer2.png"
					alt="Create products people love"
					fill
					className="object-cover"
					priority
				/>
				<div className="absolute inset-0 bg-black/30" />
				<div className="absolute bottom-12 left-12 max-w-md text-white space-y-4">
					<h1 className="text-4xl font-bold leading-tight">
						Diseña productos
						<br />
						listos para vender.
					</h1>
					<p className="text-sm opacity-90">
						Personaliza, exporta y produce sin fricción.
					</p>
				</div>
			</div>

			{/* RIGHT – Auth */}
			<div className="relative flex items-center justify-center px-6">
				<button
					type="button"
					onClick={() => router.push("/catalogo")}
					className="absolute top-6 right-6 text-gray-400 hover:text-black"
				>
					<X size={22} />
				</button>

				<div className="w-full max-w-sm space-y-6">
					<h2 className="text-3xl font-black text-black text-center text-nowrap">
						BIENVENIDO DE NUEVO
					</h2>

					{/* OAuth */}
					<div className="space-y-3">
						<button
							type="button"
							className="w-full flex items-center justify-center gap-3 border rounded-[0.2rem] py-3 font-medium bg-white hover:bg-gray-50 cursor-pointer"
							onClick={() => {
								window.location.href = "http://localhost:8000/auth/google";
							}}
						>
							<img
								src="https://developers.google.com/identity/images/g-logo.png"
								className="w-5 h-5"
								alt="google"
							/>
							Continuar con Google
						</button>

						<button
							type="button"
							className="w-full flex items-center justify-center gap-3 border rounded-[0.2rem] py-3 font-medium bg-white hover:bg-gray-50 cursor-pointer"
						>
							<Apple size={20} />
							Continuar con Apple
						</button>
					</div>

					{/* Divider */}
					<div className="flex items-center gap-3">
						<div className="flex-1 h-px bg-gray-200" />
						<span className="text-xs text-gray-400">O</span>
						<div className="flex-1 h-px bg-gray-200" />
					</div>

					{/* Email form */}
					<form onSubmit={handleLogin} className="space-y-3">
						<input
							placeholder="Email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className="w-full border rounded-[0.2rem] px-3 py-3 bg-white outline-none focus:border-[#fe6241]"
						/>
						<input
							placeholder="Contraseña"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="w-full border rounded-[0.2rem] px-3 py-3 bg-white outline-none focus:border-[#fe6241]"
						/>

						{error && <p className="text-sm text-red-600">{error}</p>}

						<button
							type="submit"
							disabled={loading}
							className="w-full py-3 rounded-[0.2rem] bg-[#fe6241] text-white font-semibold hover:opacity-80 disabled:opacity-50"
						>
							{loading ? "Entrando…" : "Iniciar sesión"}
						</button>
					</form>

					<p className="text-sm text-center text-gray-600">
						¿No tienes cuenta?{" "}
						<Link
							href="/register"
							className="font-semibold text-[#fe6241] hover:underline"
						>
							Regístrate
						</Link>
					</p>

					<p className="text-xs text-gray-500 text-center">
						Al continuar aceptas nuestros Términos y Política de Privacidad
					</p>
				</div>
			</div>
		</div>
	);
}
