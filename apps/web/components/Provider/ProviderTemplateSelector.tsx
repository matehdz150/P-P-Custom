"use client";

import Image from "next/image";
import type { ProductTemplate } from "@/lib/api/templates";

type Props = {
	templates: ProductTemplate[];
	value?: string;
	onChange: (tpl: ProductTemplate) => void;
};

export function ProviderTemplateSelector({
	templates,
	value,
	onChange,
}: Props) {
	if (!templates.length) {
		return (
			<section className="border p-4 rounded-lg">
				<h3 className="font-semibold">Mockup base</h3>
				<p className="text-sm text-muted-foreground">
					No hay mockups disponibles. Pide al administrador que cree uno.
				</p>
			</section>
		);
	}

	return (
		<section className="border p-4 rounded-lg space-y-3">
			<div>
				<h3 className="font-semibold">Selecciona un mockup</h3>
				<p className="text-sm text-muted-foreground">
					Elige la base sobre la que tus clientes van a diseñar.
				</p>
			</div>

			<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
				{templates.map((tpl) => {
					const firstMockup = Object.values(tpl.data.mockups ?? {})[0];
					const active = tpl.id === value;
					return (
						<button
							key={tpl.id}
							type="button"
							onClick={() => onChange(tpl)}
							className={`text-left rounded-xl border overflow-hidden transition ${
								active
									? "border-[#fe6241] ring-2 ring-[#fe6241]"
									: "border-gray-200 hover:border-gray-300"
							}`}
						>
							<div className="relative aspect-square bg-[#f5f5f3]">
								{firstMockup ? (
									<Image
										src={firstMockup}
										alt={tpl.name}
										fill
										className="object-contain p-3"
									/>
								) : (
									<div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400">
										Sin imagen
									</div>
								)}
							</div>
							<div className="p-2.5">
								<p className="text-sm font-medium truncate">
									{tpl.name}
								</p>
								<p className="text-xs text-muted-foreground">
									{tpl.data.sides.length} lado(s)
								</p>
							</div>
						</button>
					);
				})}
			</div>
		</section>
	);
}
