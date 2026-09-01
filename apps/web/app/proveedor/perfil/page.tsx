"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useProviderAuth } from "@/Contexts/ProviderAuthContext";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { actualizarMiPerfil } from "@/lib/api/proveedores";
import { uploadImage } from "@/lib/api/uploads";

export default function ProviderProfilePage() {
	const { provider, loading, refresh } = useProviderAuth();

	const [displayName, setDisplayName] = useState("");
	// Sólo de lectura: el slug es la URL pública y cambiarlo rompe los
	// enlaces que ya circulan. Por eso la API no lo deja tocar desde aquí.
	const [slug, setSlug] = useState("");
	const [bio, setBio] = useState("");
	const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
	const [bannerUrl, setBannerUrl] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [msg, setMsg] = useState<string | null>(null);

	useEffect(() => {
		if (provider) {
			setDisplayName(provider.displayName ?? provider.name ?? "");
			setSlug(provider.slug ?? "");
			setBio(provider.bio ?? "");
			setAvatarUrl(provider.avatarUrl ?? null);
			setBannerUrl(provider.bannerUrl ?? null);
		}
	}, [provider]);

	async function handleUpload(file: File, set: (u: string) => void) {
		const res = await uploadImage(file);
		set(res.url);
	}

	async function save() {
		setSaving(true);
		setMsg(null);
		try {
			await actualizarMiPerfil({
				displayName: displayName.trim(),
				bio: bio.trim(),
				avatarUrl: avatarUrl ?? undefined,
				bannerUrl: bannerUrl ?? undefined,
			});
			await refresh();
			setMsg("Perfil guardado");
		} catch {
			setMsg("No se pudo guardar");
		} finally {
			setSaving(false);
		}
	}

	if (loading) return <p className="text-muted-foreground">Cargando…</p>;

	return (
		<div className="max-w-3xl">
			{/* HEADER */}
			<div className="flex items-center justify-between mb-8">
				<div>
					<h1 className="text-2xl font-bold">Perfil público</h1>
					<p className="text-sm text-muted-foreground">
						Así te verán los clientes en tu página de proveedor.
					</p>
				</div>
				<button
					type="button"
					onClick={save}
					disabled={saving}
					className="px-6 py-2.5 rounded-lg bg-[#fe6241] text-black text-sm font-bold hover:bg-[#e5573a] transition disabled:opacity-40"
				>
					{saving ? "Guardando…" : "Guardar"}
				</button>
			</div>

			{msg && <p className="mb-4 text-sm text-[#fe6241] font-medium">{msg}</p>}

			{/* BANNER */}
			<section className="border rounded-xl p-5 mb-5">
				<h2 className="font-semibold mb-3">Imagen de portada</h2>
				<div className="relative w-full aspect-[4/1] rounded-lg overflow-hidden bg-[#f5f5f3] mb-3">
					{bannerUrl && (
						<Image
							src={bannerUrl}
							alt="Portada"
							fill
							className="object-cover"
						/>
					)}
				</div>
				<Input
					type="file"
					accept="image/*"
					onChange={(e) => {
						const f = e.target.files?.[0];
						if (f) handleUpload(f, setBannerUrl);
					}}
				/>
			</section>

			{/* AVATAR + DATOS */}
			<section className="border rounded-xl p-5 mb-5 space-y-4">
				<h2 className="font-semibold">Información del proveedor</h2>

				<div className="flex items-center gap-4">
					<div className="relative w-20 h-20 rounded-full overflow-hidden bg-[#f5f5f3] shrink-0">
						{avatarUrl && (
							<Image
								src={avatarUrl}
								alt="Avatar"
								fill
								className="object-cover"
							/>
						)}
					</div>
					<Input
						type="file"
						accept="image/*"
						onChange={(e) => {
							const f = e.target.files?.[0];
							if (f) handleUpload(f, setAvatarUrl);
						}}
					/>
				</div>

				<div>
					<label className="text-sm font-semibold">Nombre público</label>
					<Input
						value={displayName}
						onChange={(e) => setDisplayName(e.target.value)}
						placeholder="Mi Marca"
					/>
				</div>

				<div>
					<label className="text-sm font-semibold">URL pública</label>
					<div className="flex items-center gap-1 mt-1">
						<span className="text-sm text-muted-foreground">/proveedores/</span>
						<Input value={slug} readOnly disabled placeholder="mi-marca" />
					</div>
				</div>

				<div>
					<label className="text-sm font-semibold">Descripción</label>
					<Textarea
						value={bio}
						onChange={(e) => setBio(e.target.value)}
						placeholder="Cuéntale a tus clientes sobre tu marca…"
						rows={4}
					/>
				</div>
			</section>

			{slug && (
				<a
					href={`/proveedores/${slug}`}
					target="_blank"
					rel="noreferrer"
					className="text-sm text-[#fe6241] font-medium underline"
				>
					Ver mi página pública →
				</a>
			)}
		</div>
	);
}
