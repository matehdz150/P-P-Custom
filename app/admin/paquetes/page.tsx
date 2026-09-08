"use client";

import { useEffect, useState } from "react";
import {
	getPackages,
	createPackage,
	deletePackage,
	CreatePackageInput,
} from "@/lib/api/packages";

import { Button } from "@/components/ui/button";
import { PackageForm } from "@/components/Admin/paquetes/PackageForm";
import { PackagesTable } from "@/components/Admin/paquetes/PackagesTable";

type Package = {
	id: string;
	name: string;
	description?: string | null;
};

export default function AdminPackagesPage() {
	const [packages, setPackages] = useState<Package[]>([]);
	const [loading, setLoading] = useState(true);
	const [creating, setCreating] = useState(false);

	async function load() {
		setLoading(true);
		const data = await getPackages();
		setPackages(data);
		setLoading(false);
	}

	useEffect(() => {
		let active = true;

		(async () => {
			setLoading(true);
			const data = await getPackages();
			if (!active) return;
			setPackages(data);
			setLoading(false);
		})();

		return () => {
			active = false;
		};
	}, []);

	async function onCreate(data: CreatePackageInput) {
		await createPackage(data);
		setCreating(false);
		load();
	}

	async function onDelete(id: string) {
		if (!confirm("¿Eliminar este paquete?")) return;
		await deletePackage(id);
		load();
	}

	if (loading) {
		return <div className="p-8">Cargando paquetes…</div>;
	}

	return (
		<div className="p-8 max-w-6xl space-y-6">
			{/* HEADER */}
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold">Paquetes</h1>

				{!creating && packages.length > 0 && (
					<Button onClick={() => setCreating(true)}>Nuevo paquete</Button>
				)}
			</div>

			{/* FORM */}
			{creating && (
				<div className="border rounded p-6">
					<div className="flex items-center justify-between mb-4">
						<h2 className="font-semibold">Crear paquete</h2>
						<Button variant="ghost" onClick={() => setCreating(false)}>
							Cancelar
						</Button>
					</div>

					<PackageForm onSubmit={onCreate} />
				</div>
			)}

			{/* EMPTY STATE */}
			{!creating && packages.length === 0 && (
				<div className="border border-dashed rounded-lg p-12 text-center space-y-4">
					<h2 className="text-lg font-semibold">No hay paquetes creados</h2>

					<p className="text-sm text-muted-foreground">
						Los paquetes agrupan productos para venderlos juntos. Crea tu primer
						paquete para empezar.
					</p>

					<Button onClick={() => setCreating(true)}>
						Crear primer paquete
					</Button>
				</div>
			)}

			{/* LIST */}
			{!creating && packages.length > 0 && (
				<PackagesTable packages={packages} onDelete={onDelete} />
			)}
		</div>
	);
}
