"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import {
	getMyPackage,
	updateProviderPackage,
} from "@/lib/api/providers";
import PackageWizard, {
	type PackageFormData,
	type PackageWizardSubmit,
	type SelectedItem,
} from "../../_components/PackageWizard";

export default function EditProviderPackagePage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
	const router = useRouter();

	const [initialForm, setInitialForm] = useState<PackageFormData | undefined>();
	const [initialSelected, setInitialSelected] = useState<
		SelectedItem[] | undefined
	>();
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		getMyPackage(id)
			.then((pkg) => {
				if (cancelled) return;
				setInitialForm({
					name: pkg.name ?? "",
					description: pkg.description ?? "",
					basePrice:
						pkg.pricing?.basePrice != null ? String(pkg.pricing.basePrice) : "",
				});
				setInitialSelected(
					(pkg.items ?? []).map((it) => ({
						product: it.product,
						quantity: it.quantity ?? 1,
					})),
				);
			})
			.catch(() => {
				if (!cancelled) setError("No se pudo cargar el paquete.");
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [id]);

	async function handleSubmit({ form, selected }: PackageWizardSubmit) {
		try {
			await updateProviderPackage(id, {
				name: form.name.trim(),
				description: form.description.trim() || undefined,
				pricing: { basePrice: Number(form.basePrice) },
				items: selected.map((s) => ({
					productId: s.product.id,
					quantity: s.quantity,
				})),
			});
			router.push("/proveedor/paquetes");
		} catch {
			alert("Error al actualizar el paquete");
		}
	}

	if (error) {
		return (
			<div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#f7f7f5] px-4 text-center">
				<p className="text-sm font-semibold text-[#171717]">{error}</p>
				<button
					type="button"
					onClick={() => router.push("/proveedor/paquetes")}
					className="rounded-lg bg-[#171717] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2a2a2a]"
				>
					Volver a mis paquetes
				</button>
			</div>
		);
	}

	return (
		<PackageWizard
			title="Editar paquete"
			submitLabel="Guardar cambios"
			loadingInitial={loading}
			initialForm={initialForm}
			initialSelected={initialSelected}
			onSubmit={handleSubmit}
		/>
	);
}
