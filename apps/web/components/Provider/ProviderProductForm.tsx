"use client";

import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ColorsSection } from "@/components/Admin/productos/FormCreate/ColorsSection";
import { CustomizationRulesSection } from "@/components/Admin/productos/FormCreate/CustomizationRulesSection";
import { GeneralInfoSection } from "@/components/Admin/productos/FormCreate/GeneralInfoSection";
import { ImagesSection } from "@/components/Admin/productos/FormCreate/ImageSection";
import { PricingSection } from "@/components/Admin/productos/FormCreate/PricingSection";
import { PrintSidesSection } from "@/components/Admin/productos/FormCreate/PrintSidesSection";
import { SizesSection } from "@/components/Admin/productos/FormCreate/SizesSection";
import { createProviderProduct } from "@/lib/api/providers";
import { getTemplates, type ProductTemplate } from "@/lib/api/templates";
import { ProviderTemplateSelector } from "./ProviderTemplateSelector";

// biome-ignore lint/suspicious/noExplicitAny: form mirrors admin product shape
type AnyVal = any;

const STEPS = [
	{ id: "mockup", label: "Mockup" },
	{ id: "info", label: "Información" },
	{ id: "images", label: "Imágenes" },
	{ id: "pricing", label: "Precio" },
	{ id: "variants", label: "Variantes" },
	{ id: "print", label: "Impresión" },
	{ id: "rules", label: "Personalización" },
	{ id: "review", label: "Revisar" },
] as const;

export function ProviderProductForm() {
	const router = useRouter();
	const [templates, setTemplates] = useState<ProductTemplate[]>([]);
	const [selectedTemplate, setSelectedTemplate] = useState<ProductTemplate | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [step, setStep] = useState(0);

	const [form, setForm] = useState({
		slug: "",
		name: "",
		internalName: "",
		sku: "",
		description: "",
		brand: "",
		categoryIds: [] as AnyVal[],
		status: "active" as "draft" | "active" | "archived",
		templateId: "",
		isCustomizable: true,
		images: [] as AnyVal[],
		pricing: { basePrice: 0 } as AnyVal,
		sizes: [] as AnyVal[],
		colors: [] as AnyVal[],
		printSides: [] as AnyVal[],
		customizationRules: {} as AnyVal,
	});

	function update<K extends keyof typeof form>(key: K, value: AnyVal) {
		setForm((prev) => ({ ...prev, [key]: value }));
	}

	useEffect(() => {
		getTemplates().then(setTemplates);
	}, []);

	const current = STEPS[step];
	const isLast = step === STEPS.length - 1;

	const canContinue = useMemo(() => {
		switch (current.id) {
			case "mockup":
				return !!selectedTemplate;
			case "info":
				return Boolean(form.name.trim() && form.slug.trim() && form.sku.trim());
			case "images":
				return form.images.length >= 2;
			case "pricing":
				return Number(form.pricing?.basePrice) > 0;
			case "print":
				return form.printSides.length > 0;
			default:
				return true;
		}
	}, [current.id, selectedTemplate, form]);

	async function submit() {
		if (!selectedTemplate) return;
		const payload = {
			...form,
			templateId: selectedTemplate.id,
			templateSides: form.printSides.map((s: AnyVal) => s.sideKey),
		};
		try {
			setSubmitting(true);
			await createProviderProduct(payload);
			router.push("/proveedor");
		} catch {
			alert("Error al crear el producto");
		} finally {
			setSubmitting(false);
		}
	}

	function handleNext() {
		if (!canContinue) return;
		if (isLast) return submit();
		setStep((s) => Math.min(s + 1, STEPS.length - 1));
	}

	return (
		<div className="min-h-screen bg-[#f7f7f5]">
			{/* ── TOP BAR ── */}
			<div className="sticky top-[52px] z-20 border-b border-[#e7e7e2] bg-white px-8 py-4">
				<div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
					{/* back */}
					<button
						type="button"
						onClick={() => router.push("/proveedor")}
						className="flex shrink-0 items-center gap-1.5 text-sm text-[#77776f] hover:text-[#171717]"
					>
						<ChevronLeft className="h-4 w-4" />
						Mis productos
					</button>

					{/* stepper — dots + label del paso actual */}
					<div className="flex items-center gap-1.5 overflow-x-auto">
						{STEPS.map((s, i) => (
							<button
								key={s.id}
								type="button"
								disabled={i > step}
								onClick={() => i <= step && setStep(i)}
								className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors disabled:cursor-default ${
									i < step
										? "bg-[#171717] text-white"
										: i === step
											? "border-2 border-[#171717] text-[#171717] bg-white"
											: "border-2 border-[#d9d9d2] text-[#aaa]"
								}`}
							>
								{i < step ? <Check className="h-3 w-3" /> : i + 1}
							</button>
						))}
						<span className="ml-2 hidden shrink-0 text-sm font-semibold text-[#171717] sm:block">
							{current.label}
						</span>
					</div>

					{/* nav buttons */}
					<div className="flex shrink-0 items-center gap-2">
						<button
							type="button"
							onClick={() => setStep((s) => s - 1)}
							disabled={step === 0}
							className="flex items-center gap-1 rounded-lg border border-[#d9d9d2] px-4 py-2 text-sm font-semibold text-[#171717] hover:bg-[#f4f4f1] disabled:pointer-events-none disabled:opacity-40"
						>
							<ChevronLeft className="h-4 w-4" />
							Atrás
						</button>
						<button
							type="button"
							onClick={handleNext}
							disabled={!canContinue || submitting}
							className="flex items-center gap-1 rounded-lg bg-[#171717] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2a2a2a] disabled:pointer-events-none disabled:opacity-40"
						>
							{isLast ? (submitting ? "Creando…" : "Crear") : "Siguiente"}
							{!isLast && <ChevronRight className="h-4 w-4" />}
						</button>
					</div>
				</div>
			</div>

			{/* ── CONTENT ── */}
			<div className="mx-auto max-w-3xl px-4 py-8">
				<div className="mb-6">
					<p className="text-xs font-semibold uppercase tracking-wide text-[#aaa]">
						Paso {step + 1} de {STEPS.length}
					</p>
					<h2 className="mt-1 text-2xl font-bold text-[#171717]">{current.label}</h2>
					<p className="mt-1 text-sm text-[#77776f]">{STEP_DESCRIPTIONS[current.id]}</p>
				</div>

				<div className="rounded-2xl border border-[#e7e7e2] bg-white p-6">
					{current.id === "mockup" && (
						<ProviderTemplateSelector
							templates={templates}
							value={form.templateId}
							onChange={(tpl) => {
								setSelectedTemplate(tpl);
								update("templateId", tpl.id);
								update("printSides", []);
							}}
						/>
					)}

					{current.id === "info" && (
						<GeneralInfoSection value={form} onChange={update} />
					)}

					{current.id === "images" && (
						<ImagesSection
							value={form.images}
							onChange={(v) => update("images", v)}
						/>
					)}

					{current.id === "pricing" && (
						<PricingSection
							value={form.pricing}
							onChange={(v) => update("pricing", v)}
						/>
					)}

					{current.id === "variants" && (
						<div className="space-y-6">
							<SizesSection value={form.sizes} onChange={(v) => update("sizes", v)} />
							<ColorsSection value={form.colors} onChange={(v) => update("colors", v)} />
						</div>
					)}

					{current.id === "print" && (
						selectedTemplate ? (
							<PrintSidesSection
								templateData={selectedTemplate.data}
								value={form.printSides}
								onChange={(v) => update("printSides", v)}
							/>
						) : (
							<p className="text-sm text-[#77776f]">Selecciona un mockup primero.</p>
						)
					)}

					{current.id === "rules" && (
						<CustomizationRulesSection
							value={form.customizationRules}
							onChange={(v) => update("customizationRules", v)}
						/>
					)}

					{current.id === "review" && (
						<ReviewStep form={form} template={selectedTemplate} />
					)}
				</div>

			</div>
		</div>
	);
}

/* ─── Review step ────────────────────────────────────────── */

function ReviewStep({ form, template }: { form: AnyVal; template: ProductTemplate | null }) {
	return (
		<div className="divide-y divide-[#f0f0ec]">
			<ReviewRow label="Mockup" value={template?.name ?? "—"} />
			<ReviewRow label="Nombre" value={form.name || "—"} />
			<ReviewRow label="Slug" value={form.slug || "—"} />
			<ReviewRow label="SKU" value={form.sku || "—"} />
			<ReviewRow label="Estado" value={form.status} />
			<ReviewRow label="Precio base" value={`$${form.pricing?.basePrice ?? 0}`} />
			<ReviewRow label="Tallas" value={String(form.sizes.length)} />
			<ReviewRow label="Colores" value={String(form.colors.length)} />
			<ReviewRow label="Lados de impresión" value={String(form.printSides.length)} />
			<ReviewRow label="Imágenes" value={String(form.images.length)} />
		</div>
	);
}

function ReviewRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-center justify-between py-3">
			<span className="text-sm text-[#77776f]">{label}</span>
			<span className="text-sm font-semibold text-[#171717]">{value}</span>
		</div>
	);
}

/* ─── Step descriptions ──────────────────────────────────── */

const STEP_DESCRIPTIONS: Record<string, string> = {
	mockup: "Elige la base sobre la que tus clientes van a diseñar.",
	info: "Nombre, slug, SKU y datos generales del producto.",
	images: "Sube al menos 2 imágenes del producto.",
	pricing: "Define el precio base.",
	variants: "Agrega las tallas y colores disponibles.",
	print: "Selecciona qué lados del producto admiten diseño.",
	rules: "Configura qué puede personalizar el cliente.",
	review: "Revisa todo antes de publicar.",
};
