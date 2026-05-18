"use client";

import { Camera, ExternalLink, Package, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useProviderAuth } from "@/Contexts/ProviderAuthContext";
import { getMyProducts, updateMyProfile, type ProviderProduct } from "@/lib/api/providers";
import { uploadImage } from "@/lib/api/uploads";

export default function ProviderProfilePage() {
	const { provider, loading, refresh } = useProviderAuth();

	const [displayName, setDisplayName] = useState("");
	const [slug, setSlug] = useState("");
	const [bio, setBio] = useState("");
	const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
	const [bannerUrl, setBannerUrl] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
	const [products, setProducts] = useState<ProviderProduct[]>([]);

	const bannerRef = useRef<HTMLInputElement>(null);
	const avatarRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (provider) {
			setDisplayName(provider.displayName ?? provider.name ?? "");
			setSlug(provider.slug ?? "");
			setBio(provider.bio ?? "");
			setAvatarUrl(provider.avatarUrl ?? null);
			setBannerUrl(provider.bannerUrl ?? null);
		}
	}, [provider]);

	useEffect(() => {
		getMyProducts().then(setProducts);
	}, []);

	async function handleUpload(file: File, set: (u: string) => void) {
		const res = await uploadImage(file);
		set(res.url);
	}

	async function save() {
		setSaving(true);
		setMsg(null);
		try {
			await updateMyProfile({
				displayName: displayName.trim(),
				slug: slug.trim(),
				bio: bio.trim(),
				avatarUrl: avatarUrl ?? undefined,
				bannerUrl: bannerUrl ?? undefined,
			});
			await refresh();
			setMsg({ text: "Perfil guardado correctamente", ok: true });
		} catch {
			setMsg({ text: "No se pudo guardar (¿slug en uso?)", ok: false });
		} finally {
			setSaving(false);
		}
	}

	if (loading) return <p className="p-8 text-[13px] text-[#888]">Cargando…</p>;

	const previewName = displayName || provider?.name || "Tu marca";

	return (
		<div className="flex min-h-screen bg-white">
			{/* ── LEFT: FORM ── */}
			<div className="w-full max-w-sm shrink-0 border-r border-[#ebebeb] px-6 py-6 overflow-y-auto">
				<div className="mb-5 flex items-center justify-between">
					<h2 className="text-[15px] font-bold text-[#1a1a1a]">Perfil público</h2>
					<button
						type="button"
						onClick={save}
						disabled={saving}
						className="rounded-md bg-[#1a1a1a] px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-[#333] disabled:opacity-50 transition-colors"
					>
						{saving ? "Guardando…" : "Guardar"}
					</button>
				</div>

				{msg && (
					<p className={`mb-4 rounded-lg px-3 py-2 text-[13px] font-medium ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
						{msg.text}
					</p>
				)}

				<div className="space-y-5">
					{/* Banner */}
					<div>
						<label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-[#aaa]">Portada</label>
						<button
							type="button"
							onClick={() => bannerRef.current?.click()}
							className="group relative flex w-full items-center justify-center overflow-hidden rounded-xl bg-[#f3f3f1] aspect-[3/1] hover:bg-[#ebebea] transition-colors"
						>
							{bannerUrl ? (
								<Image src={bannerUrl} alt="Portada" fill className="object-cover" />
							) : null}
							<div className={`absolute inset-0 flex flex-col items-center justify-center gap-1 ${bannerUrl ? "bg-black/30 opacity-0 group-hover:opacity-100" : ""} transition-opacity`}>
								<Camera className="h-5 w-5 text-white" />
								<span className="text-[11px] font-semibold text-white">Cambiar portada</span>
							</div>
						</button>
						<input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f, setBannerUrl); }} />
					</div>

					{/* Avatar */}
					<div>
						<label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-[#aaa]">Logo / Avatar</label>
						<div className="flex items-center gap-3">
							<button
								type="button"
								onClick={() => avatarRef.current?.click()}
								className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-[#f3f3f1]"
							>
								{avatarUrl ? (
									<Image src={avatarUrl} alt="Avatar" fill className="object-cover" />
								) : (
									<div className="flex h-full items-center justify-center bg-[#1a1a1a] text-white text-xl font-bold">
										{previewName.charAt(0).toUpperCase()}
									</div>
								)}
								<div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
									<Camera className="h-4 w-4 text-white" />
								</div>
							</button>
							<p className="text-[12px] text-[#888]">Recomendado: imagen cuadrada, mínimo 200×200px</p>
						</div>
						<input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f, setAvatarUrl); }} />
					</div>

					{/* Name */}
					<div>
						<label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-[#aaa]">Nombre público</label>
						<input
							value={displayName}
							onChange={(e) => setDisplayName(e.target.value)}
							placeholder="Mi Marca"
							className="w-full rounded-lg border border-[#e0e0e0] px-3 py-2 text-[13px] outline-none focus:border-[#1a1a1a] focus:ring-1 focus:ring-[#1a1a1a]"
						/>
					</div>

					{/* Slug */}
					<div>
						<label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-[#aaa]">URL pública</label>
						<div className="flex items-center overflow-hidden rounded-lg border border-[#e0e0e0] focus-within:border-[#1a1a1a] focus-within:ring-1 focus-within:ring-[#1a1a1a]">
							<span className="shrink-0 bg-[#f3f3f1] px-2.5 py-2 text-[12px] text-[#888] border-r border-[#e0e0e0]">/proveedores/</span>
							<input
								value={slug}
								onChange={(e) => setSlug(e.target.value)}
								placeholder="mi-marca"
								className="flex-1 px-3 py-2 text-[13px] outline-none"
							/>
						</div>
					</div>

					{/* Bio */}
					<div>
						<label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-[#aaa]">Descripción</label>
						<textarea
							value={bio}
							onChange={(e) => setBio(e.target.value)}
							placeholder="Cuéntale a tus clientes sobre tu marca…"
							rows={4}
							className="w-full resize-none rounded-lg border border-[#e0e0e0] px-3 py-2 text-[13px] outline-none focus:border-[#1a1a1a] focus:ring-1 focus:ring-[#1a1a1a]"
						/>
					</div>

					{/* Link */}
					{slug && (
						<Link
							href={`/proveedores/${slug}`}
							target="_blank"
							className="flex items-center gap-1.5 text-[13px] text-[#1a1a1a] font-medium underline underline-offset-2"
						>
							<ExternalLink className="h-3.5 w-3.5" />
							Ver página pública
						</Link>
					)}
				</div>
			</div>

			{/* ── RIGHT: LIVE PREVIEW ── */}
			<div className="flex-1 overflow-y-auto bg-[#f7f7f5]">
				<div className="flex items-center gap-2 border-b border-[#ebebeb] bg-white px-6 py-3">
					<div className="flex gap-1.5">
						<div className="h-3 w-3 rounded-full bg-[#ff5f57]" />
						<div className="h-3 w-3 rounded-full bg-[#febc2e]" />
						<div className="h-3 w-3 rounded-full bg-[#28c840]" />
					</div>
					<div className="flex-1 mx-4 rounded-md bg-[#f3f3f1] px-3 py-1 text-[11px] text-[#999]">
						pyp.com/proveedores/{slug || "tu-marca"}
					</div>
				</div>

				{/* Simulated public page */}
				<div className="bg-white min-h-full">
					{/* Banner */}
					<div className="relative h-40 bg-[#e8e8e6] sm:h-52">
						{bannerUrl ? (
							<Image src={bannerUrl} alt="Portada" fill className="object-cover" />
						) : (
							<div className="h-full w-full bg-gradient-to-br from-[#e8e8e6] to-[#d0d0ce]" />
						)}
					</div>

					<div className="mx-auto max-w-4xl px-6">
						{/* Provider header */}
						<div className="flex items-end gap-4 -mt-10 pb-4">
							<div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-4 border-white bg-white shadow-sm">
								{avatarUrl ? (
									<Image src={avatarUrl} alt={previewName} fill className="object-cover" />
								) : (
									<div className="flex h-full items-center justify-center bg-[#1a1a1a] text-white text-2xl font-bold">
										{previewName.charAt(0).toUpperCase()}
									</div>
								)}
							</div>
							<div className="pb-1">
								<h1 className="text-xl font-bold text-[#1a1a1a]">{previewName}</h1>
								<div className="mt-0.5 flex items-center gap-1 text-[12px] text-[#999]">
									<Star className="h-3.5 w-3.5" />
									<span>Sin reseñas · {products.length} producto{products.length !== 1 ? "s" : ""}</span>
								</div>
							</div>
						</div>

						{/* Bio */}
						{bio && (
							<p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[#555]">{bio}</p>
						)}

						{/* Products */}
						<div className="mt-8">
							<h2 className="mb-4 text-[15px] font-bold text-[#1a1a1a]">Productos</h2>
							{products.length === 0 ? (
								<div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#e0e0e0] py-12 text-center">
									<Package className="h-8 w-8 text-[#ccc]" />
									<p className="mt-3 text-[13px] text-[#aaa]">Tus productos aparecerán aquí</p>
								</div>
							) : (
								<div className="grid grid-cols-2 gap-3 pb-10 sm:grid-cols-3 lg:grid-cols-4">
									{products.map((p) => {
										const img = p.images?.[0]?.url;
										return (
											<div key={p.id} className="overflow-hidden rounded-xl border border-[#ebebeb] bg-white">
												<div className="relative aspect-square bg-[#f5f5f3]">
													{img ? (
														<Image src={img} alt={p.name} fill className="object-cover" sizes="25vw" />
													) : (
														<div className="flex h-full items-center justify-center">
															<Package className="h-6 w-6 text-[#ccc]" />
														</div>
													)}
												</div>
												<div className="p-2.5">
													<p className="truncate text-[12px] font-semibold text-[#1a1a1a]">{p.name}</p>
													<p className="text-[11px] text-[#888]">
														{p.pricing ? `$${p.pricing.basePrice}` : ""}
													</p>
												</div>
											</div>
										);
									})}
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
