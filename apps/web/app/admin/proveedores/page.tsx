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
	const [form, setForm] = useState({ name: "", email: "" });
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	/** El alta devuelve la contraseña temporal una sola vez; se enseña hasta
	    que el admin la copie y cree al siguiente. */
	const [recienCreado, setRecienCreado] = useState<{
		email: string;
		contrasenaTemporal: string;
	} | null>(null);

	async function load() {
		setLoading(true);
		try {
			setProviders(await getProviders());
			setError(null);
		} catch (e) {
			setError(
				e instanceof Error
					? e.message
					: "No se pudieron cargar los proveedores",
			);
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

		if (!form.email.trim() || !form.name.trim()) {
			setError("Hacen falta el nombre del taller y su correo");
			return;
		}

		setSaving(true);
		try {
			const creado = await createProvider({
				email: form.email.trim(),
				name: form.name.trim(),
			});
			setRecienCreado({
				email: creado.email,
				contrasenaTemporal: creado.contrasenaTemporal,
			});
			setForm({ name: "", email: "" });
			load();
		} catch (e) {
			// La Lambda contesta con el motivo ("Ya hay un proveedor con el
			// correo…"); enseñarlo evita adivinar por qué falló.
			setError(
				e instanceof Error ? e.message : "No se pudo crear el proveedor",
			);
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="max-w-3xl space-y-8">
			<div>
				<h1 className="text-2xl font-bold">Proveedores</h1>
				<p className="text-sm text-muted-foreground">
					Crea cuentas para que los talleres entren a su panel y suban sus
					productos.
				</p>
			</div>

			<form
				onSubmit={submit}
				className="border rounded-lg p-5 space-y-3 bg-background"
			>
				<h2 className="font-semibold">Nuevo proveedor</h2>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<Input
						placeholder="Nombre del taller"
						value={form.name}
						onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
					/>
					<Input
						type="email"
						placeholder="correo@proveedor.com"
						value={form.email}
						onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
					/>
				</div>
				<p className="text-xs text-muted-foreground">
					No se pone contraseña: Cognito genera una temporal y el taller la
					cambia en su primer ingreso.
				</p>
				{error && <p className="text-sm text-red-600">{error}</p>}
				<Button type="submit" disabled={saving}>
					{saving ? "Creando…" : "Crear proveedor"}
				</Button>
			</form>

			{recienCreado && (
				<div className="border border-amber-300 bg-amber-50 rounded-lg p-5 space-y-2">
					<h2 className="font-semibold">Contraseña temporal</h2>
					<p className="text-sm">
						Pásasela a <strong>{recienCreado.email}</strong>. Se muestra{" "}
						<strong>una sola vez</strong>: no queda guardada en ningún lado.
					</p>
					<code className="block select-all bg-white border rounded px-3 py-2 font-mono text-sm">
						{recienCreado.contrasenaTemporal}
					</code>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => setRecienCreado(null)}
					>
						Ya la copié
					</Button>
				</div>
			)}

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
									<p className="font-medium">{p.name || "Sin nombre"}</p>
									<p className="text-sm text-muted-foreground">{p.email}</p>
								</div>
								<span className="text-xs text-muted-foreground">
									{p.createdAt
										? new Date(p.createdAt).toLocaleDateString()
										: ""}
								</span>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
