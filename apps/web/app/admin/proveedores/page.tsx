"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	createProvider,
	getProviders,
	type Provider,
} from "@/lib/api/providers";

export default function AdminProvidersPage() {
	const [providers, setProviders] = useState<Provider[]>([]);
	const [loading, setLoading] = useState(true);
	const [form, setForm] = useState({ name: "", email: "", password: "" });
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function load() {
		setLoading(true);
		try {
			setProviders(await getProviders());
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		load();
	}, []);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		if (!form.email.trim() || form.password.length < 6) {
			setError("Correo válido y contraseña de mínimo 6 caracteres");
			return;
		}
		setSaving(true);
		try {
			await createProvider({
				email: form.email.trim(),
				password: form.password,
				name: form.name.trim() || undefined,
			});
			setForm({ name: "", email: "", password: "" });
			load();
		} catch {
			setError("No se pudo crear (¿correo duplicado?)");
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="max-w-3xl space-y-8">
			<div>
				<h1 className="text-2xl font-bold">Proveedores</h1>
				<p className="text-sm text-muted-foreground">
					Crea cuentas para que los proveedores suban sus productos.
				</p>
			</div>

			<form
				onSubmit={submit}
				className="border rounded-lg p-5 space-y-3 bg-background"
			>
				<h2 className="font-semibold">Nuevo proveedor</h2>
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
					<Input
						placeholder="Nombre (opcional)"
						value={form.name}
						onChange={(e) =>
							setForm((f) => ({ ...f, name: e.target.value }))
						}
					/>
					<Input
						type="email"
						placeholder="correo@proveedor.com"
						value={form.email}
						onChange={(e) =>
							setForm((f) => ({ ...f, email: e.target.value }))
						}
					/>
					<Input
						type="password"
						placeholder="Contraseña"
						value={form.password}
						onChange={(e) =>
							setForm((f) => ({ ...f, password: e.target.value }))
						}
					/>
				</div>
				{error && <p className="text-sm text-red-600">{error}</p>}
				<Button type="submit" disabled={saving}>
					{saving ? "Creando…" : "Crear proveedor"}
				</Button>
			</form>

			<div className="space-y-2">
				<h2 className="font-semibold">Proveedores existentes</h2>
				{loading ? (
					<p className="text-sm text-muted-foreground">Cargando…</p>
				) : providers.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						Aún no hay proveedores.
					</p>
				) : (
					<div className="border rounded-lg divide-y">
						{providers.map((p) => (
							<div
								key={p.id}
								className="flex items-center justify-between px-4 py-3"
							>
								<div>
									<p className="font-medium">
										{p.name || "Sin nombre"}
									</p>
									<p className="text-sm text-muted-foreground">
										{p.email}
									</p>
								</div>
								<span className="text-xs text-muted-foreground">
									{new Date(p.createdAt).toLocaleDateString()}
								</span>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
