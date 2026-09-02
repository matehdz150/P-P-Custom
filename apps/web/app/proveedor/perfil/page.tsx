"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useProviderAuth } from "@/Contexts/ProviderAuthContext";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { actualizarMiPerfil } from "@/lib/api/proveedores";
import { uploadImage } from "@/lib/api/uploads";
import { ESTADOS_MX } from "@/lib/mexico";

const DIRECCION_VACIA = {
	calle: "",
	numero: "",
	interior: "",
	colonia: "",
	ciudad: "",
	estado: "",
	cp: "",
	referencias: "",
};

/** Los que la paquetería necesita sí o sí. Interior y referencias, no. */
const OBLIGATORIOS = [
	"calle",
	"numero",
	"colonia",
	"ciudad",
	"estado",
	"cp",
] as const;

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

	/** Todo en cadenas: el formulario edita texto, la API recibe la dirección. */
	const [dir, setDir] = useState(DIRECCION_VACIA);
	const ponDir = (campo: keyof typeof DIRECCION_VACIA, valor: string) =>
		setDir((d) => ({ ...d, [campo]: valor }));

	useEffect(() => {
		if (provider) {
			setDisplayName(provider.displayName ?? provider.name ?? "");
			setSlug(provider.slug ?? "");
			setBio(provider.bio ?? "");
			setAvatarUrl(provider.avatarUrl ?? null);
			setBannerUrl(provider.bannerUrl ?? null);

			const r = provider.recoleccion;
			setDir(
				r
					? {
							calle: r.calle ?? "",
							numero: r.numero ?? "",
							interior: r.interior ?? "",
							colonia: r.colonia ?? "",
							ciudad: r.ciudad ?? "",
							estado: r.estado ?? "",
							cp: r.cp ?? "",
							referencias: r.referencias ?? "",
						}
					: DIRECCION_VACIA,
			);
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
			// La dirección se manda ENTERA o no se manda. A medias, la API la
			// rechaza y con ella el resto del perfil; y una dirección incompleta
			// no sirve para cotizar, así que guardarla no aportaría nada.
			const completa = OBLIGATORIOS.every((c) => dir[c].trim() !== "");
			const vacia = OBLIGATORIOS.every((c) => dir[c].trim() === "");

			if (!completa && !vacia) {
				setMsg(
					"Completa toda la dirección de recolección, o déjala en blanco.",
				);
				setSaving(false);
				return;
			}

			await actualizarMiPerfil({
				displayName: displayName.trim(),
				bio: bio.trim(),
				avatarUrl: avatarUrl ?? undefined,
				bannerUrl: bannerUrl ?? undefined,
				recoleccion: completa
					? {
							calle: dir.calle.trim(),
							numero: dir.numero.trim(),
							interior: dir.interior.trim() || null,
							colonia: dir.colonia.trim(),
							ciudad: dir.ciudad.trim(),
							estado: dir.estado.trim(),
							cp: dir.cp.trim(),
							referencias: dir.referencias.trim() || null,
						}
					: null,
			});
			await refresh();
			toast.success("Perfil guardado", {
				description: completa
					? "Ya podemos cotizar envíos desde tu dirección."
					: undefined,
			});
			setMsg(null);
		} catch (error) {
			// El mensaje de la API dice qué campo falta; repetirlo es más útil
			// que un "no se pudo" genérico.
			toast.error("No se pudo guardar", {
				description:
					error instanceof Error ? error.message : "Inténtalo otra vez.",
			});
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

			{/* La dirección va en su propia sección, separada del perfil público,
			    porque no es lo mismo: lo de arriba lo ve cualquiera que entre a
			    tu página; esto se imprime en la guía. */}
			<section className="mt-8 flex flex-col gap-4 rounded-xl border border-tinta/12 p-6">
				<div className="flex flex-col gap-1">
					<h2 className="font-display text-[18px] font-semibold tracking-[-0.028em] text-tinta">
						Dirección de recolección
					</h2>
					<p className="text-[13px] leading-[20px] text-tinta/65">
						De aquí sale el paquete. Sin ella no podemos cotizar envíos de tus
						productos, así que sólo se podrían recoger contigo. Se imprime en la
						guía, o sea que la ve el comprador.
					</p>
				</div>

				<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
					<div className="md:col-span-2">
						<label className="text-sm font-semibold">Calle</label>
						<Input
							value={dir.calle}
							onChange={(e) => ponDir("calle", e.target.value)}
							placeholder="Av. Chapultepec"
						/>
					</div>
					<div>
						<label className="text-sm font-semibold">Número</label>
						<Input
							value={dir.numero}
							onChange={(e) => ponDir("numero", e.target.value)}
							placeholder="120"
						/>
					</div>
					<div>
						<label className="text-sm font-semibold">
							Interior <span className="font-normal text-tinta/50">(opcional)</span>
						</label>
						<Input
							value={dir.interior}
							onChange={(e) => ponDir("interior", e.target.value)}
							placeholder="Local 3"
						/>
					</div>
					<div>
						<label className="text-sm font-semibold">Colonia</label>
						<Input
							value={dir.colonia}
							onChange={(e) => ponDir("colonia", e.target.value)}
							placeholder="Americana"
						/>
					</div>
					<div>
						<label className="text-sm font-semibold">Código postal</label>
						<Input
							value={dir.cp}
							inputMode="numeric"
							maxLength={5}
							onChange={(e) =>
								ponDir("cp", e.target.value.replace(/\D/g, "").slice(0, 5))
							}
							placeholder="44160"
						/>
					</div>
					<div>
						<label className="text-sm font-semibold">Ciudad</label>
						<Input
							value={dir.ciudad}
							onChange={(e) => ponDir("ciudad", e.target.value)}
							placeholder="Guadalajara"
						/>
					</div>
					<div>
						<label className="text-sm font-semibold">Estado</label>
						{/* Lista cerrada y no texto libre: la paquetería no acepta
						    "Jal." ni "CDMX", y un estado mal escrito tumba la
						    cotización con un error que no dice qué pasó. */}
						<select
							value={dir.estado}
							onChange={(e) => ponDir("estado", e.target.value)}
							className="mt-1 h-9 w-full rounded-md border border-tinta/20 bg-white px-3 text-sm text-tinta outline-none focus:border-tinta"
						>
							<option value="">Elige…</option>
							{ESTADOS_MX.map((e) => (
								<option key={e} value={e}>
									{e}
								</option>
							))}
						</select>
					</div>
					<div className="md:col-span-2">
						<label className="text-sm font-semibold">
							Referencias{" "}
							<span className="font-normal text-tinta/50">(opcional)</span>
						</label>
						<Input
							value={dir.referencias}
							onChange={(e) => ponDir("referencias", e.target.value)}
							placeholder="Portón negro, entre Libertad y Morelos"
						/>
					</div>
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
