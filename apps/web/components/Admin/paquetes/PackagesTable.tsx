"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Props = {
	packages: {
		id: string;
		name: string;
		description?: string | null;
		image?: string | null;
	}[];
	onDelete: (id: string) => void;
};

export function PackagesTable({ packages, onDelete }: Props) {
	return (
		<div className="space-y-3">
			{packages.map((pkg) => (
				<div
					key={pkg.id}
					className="p-4 flex items-center justify-between gap-4 border rounded-[0.2rem] bg-[#f5f5f1]"
				>
					{/* LEFT: IMAGE */}
					<div className="flex items-center gap-4">
						<div className="relative w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
							{pkg.image ? (
								<Image
									src={pkg.image}
									alt={pkg.name}
									fill
									className="object-cover"
								/>
							) : (
								<div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
									Sin imagen
								</div>
							)}
						</div>

						{/* INFO */}
						<div>
							<div className="font-medium">{pkg.name}</div>
							<div className="text-sm text-muted-foreground">
								{pkg.description || "—"}
							</div>
						</div>
					</div>

					{/* ACTIONS */}
					<div className="flex gap-2 ">
						<Link href={`/admin/paquetes/${pkg.id}`}>
							<Button variant="outline" className="shadown-none">
								Editar
							</Button>
						</Link>

						<Button variant="default" onClick={() => onDelete(pkg.id)}>
							Eliminar
						</Button>
					</div>
				</div>
			))}
		</div>
	);
}
