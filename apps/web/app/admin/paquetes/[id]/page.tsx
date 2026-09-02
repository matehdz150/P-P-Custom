"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getPackage, updatePackage } from "@/lib/api/packages";
import { PackageForm } from "@/components/Admin/paquetes/PackageForm";

export default function EditPackagePage() {
	const params = useParams();
	const router = useRouter();
	const id = params.id as string;

	const [pkg, setPkg] = useState<any>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		getPackage(id).then((data) => {
			setPkg(data);
			setLoading(false);
		});
	}, [id]);

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
