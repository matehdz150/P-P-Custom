"use client";

import { useEffect, useState } from "react";
import { TemplatesTable } from "@/components/Admin/templates/TemplatesTable";
import { TemplateWizard } from "@/components/Admin/templates/TemplateWizard";
import { Button } from "@/components/ui/button";
import type { CreateTemplateInput, ProductTemplate } from "@/lib/api/templates";
import {
	createTemplate,
	deleteTemplate,
	getTemplates,
	updateTemplate,
} from "@/lib/api/templates";

export default function AdminTemplatesPage() {
	const [templates, setTemplates] = useState<ProductTemplate[]>([]);
	const [creating, setCreating] = useState(false);
	const [editing, setEditing] = useState<ProductTemplate | null>(null);
	const [loading, setLoading] = useState(true);

	async function load() {
		setLoading(true);
		const data = await getTemplates();
		setTemplates(data);
		setLoading(false);
	}

	useEffect(() => {
		load();
	}, []);

	async function onCreate(data: CreateTemplateInput) {
		await createTemplate(data);
		setCreating(false);
		load();
	}

	async function onUpdate(data: CreateTemplateInput) {
		await updateTemplate(data.id, { name: data.name, data: data.data });
		setEditing(null);
		load();
	}

	async function onDelete(id: string) {
		if (!confirm("¿Eliminar este mockup?")) return;
		await deleteTemplate(id);
		load();
	}

	if (creating) {
		return (
			<TemplateWizard
				onCancel={() => setCreating(false)}
				onSubmit={onCreate}
			/>
		);
	}

	if (editing) {
		return (
			<TemplateWizard
				initial={editing}
				onCancel={() => setEditing(null)}
				onSubmit={onUpdate}
			/>
		);
	}

	if (loading) {
		return <div className="p-8">Cargando mockups…</div>;
	}

	return (
		<div className="p-8 max-w-6xl space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold">Mockups</h1>
				<Button onClick={() => setCreating(true)}>Nuevo mockup</Button>
			</div>

			<TemplatesTable
				templates={templates}
				onDelete={onDelete}
				onEdit={(tpl) => setEditing(tpl)}
			/>
		</div>
	);
}
