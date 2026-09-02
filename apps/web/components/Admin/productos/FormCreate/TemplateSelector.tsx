"use client";

import { Button } from "@/components/ui/button";
import type { ProductTemplate } from "@/lib/api/templates";

type Props = {
	templates: ProductTemplate[];
	value?: string;
	onChange: (tpl: ProductTemplate) => void;
};

export function TemplateSelector({ templates, value, onChange }: Props) {
	if (!templates.length) {
		return (
			<section className="border p-4 rounded">
				<h3 className="font-semibold">Template base</h3>
				<p className="text-sm text-muted-foreground">
					No hay templates disponibles
				</p>
			</section>
		);
	}

	return (
		<section className="border p-4 rounded space-y-3">
			<h3 className="font-semibold">Template base</h3>

			<div className="flex gap-2 flex-wrap">
				{templates.map((tpl) => (
					<Button
						key={tpl.id}
						type="button"
						variant={tpl.id === value ? "default" : "outline"}
						onClick={() => {
							console.log("TEMPLATE SELECTED:", tpl); // 🔥 DEBUG
							onChange(tpl);
						}}
					>
						{tpl.name}
					</Button>
				))}
			</div>
		</section>
	);
}
