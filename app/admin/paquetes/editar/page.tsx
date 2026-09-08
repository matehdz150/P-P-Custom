"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PackageForm } from "@/components/Admin/paquetes/PackageForm";
import { getPackage, updatePackage } from "@/lib/api/packages";

/**
 * EL ID VA EN LA QUERY Y NO EN LA RUTA.
 *
 * El backoffice se publica como export estático, y una ruta dinámica exige
 * conocer todas sus URLs en el build: los paquetes se crean después de
 * desplegar, así que `/admin/paquetes/[id]` no se puede pre-renderizar nunca y
 * el build falla. Es la misma razón por la que el seguimiento de un pedido es
 * `/pedido?id=…`.
 *
 * Se lee de `window` y no con `useSearchParams` porque ese hook obliga a un
 * límite de Suspense en el export, y Next abandona el prerender de todo lo que
 * hay dentro.
 */
export default function EditPackagePage() {
	const router = useRouter();
	const [id, setId] = useState<string | null>(null);

	const [pkg, setPkg] = useState<any>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		setId(new URLSearchParams(window.location.search).get("id"));
	}, []);

	useEffect(() => {
		if (!id) return;

		getPackage(id).then((data) => {
			setPkg(data);
			setLoading(false);
		});
	}, [id]);

	if (!id) return <div className="p-8">A este enlace le falta el paquete.</div>;
	if (loading) return <div className="p-8">Cargando paquete…</div>;
	if (!pkg) return <div className="p-8">Paquete no encontrado</div>;

	return (
		<div className="p-8 max-w-4xl">
			<h1 className="text-2xl font-bold mb-6">Editar paquete</h1>

			<PackageForm
				initialValue={pkg}
				onSubmit={async (data) => {
					await updatePackage(id, data);
					router.push("/admin/paquetes");
				}}
			/>
		</div>
	);
}
