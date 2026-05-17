"use client";

import { X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { registerUser } from "@/lib/api/api";

export default function RegisterPage() {
	const router = useRouter();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function handleRegister(e: React.FormEvent) {
		e.preventDefault();
		setError(null);

		if (!email.trim() || !password) {
			setError("Ingresa tu correo y contraseña");
			return;
		}
		if (password.length < 6) {
			setError("La contraseña debe tener al menos 6 caracteres");
			return;
		}
		if (password !== confirm) {
			setError("Las contraseñas no coinciden");
			return;
		}

		setLoading(true);
		try {
			await registerUser({
				email: email.trim(),
				password,
				name: name.trim() || undefined,
			});
			window.location.href = "/catalogo";
		} catch {
			setError("No se pudo crear la cuenta (¿correo ya registrado?)");
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
						Crea tu cuenta
						<br />y empieza a diseñar.
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
					<h2 className="text-3xl font-black text-black text-center">
						CREA TU CUENTA
					</h2>

					<form onSubmit={handleRegister} className="space-y-3">
						<input
							placeholder="Nombre (opcional)"
							value={name}
							onChange={(e) => setName(e.target.value)}
							className="w-full border rounded-[0.2rem] px-3 py-3 bg-white outline-none focus:border-[#fe6241]"
						/>
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
						<input
							placeholder="Confirmar contraseña"
							type="password"
							value={confirm}
							onChange={(e) => setConfirm(e.target.value)}
							className="w-full border rounded-[0.2rem] px-3 py-3 bg-white outline-none focus:border-[#fe6241]"
						/>

						{error && (
							<p className="text-sm text-red-600">{error}</p>
						)}

						<button
							type="submit"
							disabled={loading}
							className="w-full py-3 rounded-[0.2rem] bg-[#fe6241] text-white font-semibold hover:opacity-80 disabled:opacity-50"
						>
							{loading ? "Creando cuenta…" : "Crear cuenta"}
						</button>
					</form>

					<p className="text-sm text-center text-gray-600">
						¿Ya tienes cuenta?{" "}
						<Link
							href="/login"
							className="font-semibold text-[#fe6241] hover:underline"
						>
							Inicia sesión
						</Link>
					</p>

					<p className="text-xs text-gray-500 text-center">
						Al continuar aceptas nuestros Términos y Política de
						Privacidad
					</p>
				</div>
			</div>
		</div>
	);
}
