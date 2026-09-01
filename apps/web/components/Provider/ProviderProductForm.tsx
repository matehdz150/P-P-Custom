"use client";

import { Check } from "lucide-react";
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
	{ id: "pricing", label: "Precio y extras" },
	{ id: "variants", label: "Tallas y colores" },
	{ id: "print", label: "Lados de impresión" },
	{ id: "rules", label: "Personalización" },
	{ id: "review", label: "Revisar y crear" },
] as const;

export function ProviderProductForm() {
	const router = useRouter();
	const [templates, setTemplates] = useState<ProductTemplate[]>([]);
	const [selectedTemplate, setSelectedTemplate] =
		useState<ProductTemplate | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [step, setStep] = useState(0);

	const [form, setForm] = useState({
		slug: "",
		name: "",
		internalName: "",
		sku: "",
		description: "",
		brand: "",
		categoryIds: [] as string[],
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

	// validación por paso → habilita "Continuar"
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
			alert("✅ Producto creado");
			router.push("/proveedor/productos");
		} catch {
			alert("❌ Error al crear el producto");
		} finally {
			setSubmitting(false);
		}
	}

	function next() {
		if (!canContinue) return;
		if (isLast) return submit();
		setStep((s) => Math.min(s + 1, STEPS.length - 1));
	}

	const PrimaryBtn = (
		<button
			type="button"
			onClick={next}
			disabled={!canContinue || submitting}
			className="px-6 py-2.5 rounded-lg bg-[#fe6241] text-black text-sm font-bold hover:bg-[#e5573a] transition disabled:opacity-40"
		>
			{isLast ? (submitting ? "Creando…" : "Crear producto") : "Continuar"}
		</button>
	);

	return (
		<div>
			{/* HEADER */}
			<div className="flex items-center justify-between mb-8">
				<h1 className="text-2xl font-bold">Nuevo producto</h1>
				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={() => router.push("/proveedor/productos")}
						className="px-5 py-2.5 rounded-lg border text-sm font-medium hover:bg-muted transition"
					>
						Cancelar
					</button>
					{PrimaryBtn}
				</div>
			</div>

			<div className="flex gap-10">
				{/* STEPPER */}
				<div className="w-56 shrink-0">
					<div className="space-y-1">
						{STEPS.map((s, i) => {
							const active = i === step;
							const done = i < step;
							return (
								<button
									type="button"
									key={s.id}
									onClick={() => i <= step && setStep(i)}
									className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition ${
										active ? "bg-[#fe6241]/10" : "hover:bg-muted"
									} ${i > step ? "cursor-default" : ""}`}
								>
									<span
										className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
											active
												? "bg-[#fe6241] text-white"
												: done
													? "bg-[#fe6241]/20 text-[#fe6241]"
													: "border text-muted-foreground"
										}`}
									>
										{done ? <Check size={13} /> : i + 1}
									</span>
									<span
										className={`text-sm ${
											active
												? "font-semibold text-[#1a1a17]"
												: done
													? "text-[#1a1a17]"
													: "text-muted-foreground"
										}`}
									>
										{s.label}
									</span>
								</button>
							);
						})}
					</div>
				</div>

				{/* CONTENT */}
				<div className="flex-1 max-w-2xl">
					<p className="text-sm text-muted-foreground mb-1">
						Paso {step + 1} de {STEPS.length}
					</p>
					<h2 className="text-xl font-bold mb-6">{current.label}</h2>

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
							<SizesSection
								value={form.sizes}
								onChange={(v) => update("sizes", v)}
							/>
							<ColorsSection
								value={form.colors}
								onChange={(v) => update("colors", v)}
							/>
						</div>
					)}

					{current.id === "print" &&
						(selectedTemplate ? (
							<PrintSidesSection
								templateData={selectedTemplate.data}
								value={form.printSides}
								onChange={(v) => update("printSides", v)}
							/>
						) : (
							<p className="text-sm text-muted-foreground">
								Selecciona un mockup primero.
							</p>
						))}

					{current.id === "rules" && (
						<CustomizationRulesSection
							value={form.customizationRules}
							onChange={(v) => update("customizationRules", v)}
						/>
					)}

					{current.id === "review" && (
						<div className="rounded-xl border divide-y text-sm">
							<Row k="Mockup" v={selectedTemplate?.name ?? "—"} />
							<Row k="Nombre" v={form.name || "—"} />
							<Row k="Slug" v={form.slug || "—"} />
							<Row k="SKU" v={form.sku || "—"} />
							<Row k="Precio base" v={`$${form.pricing?.basePrice ?? 0}`} />
							<Row
								k="Tallas / Colores"
								v={`${form.sizes.length} / ${form.colors.length}`}
							/>
							<Row k="Lados de impresión" v={String(form.printSides.length)} />
							<Row k="Imágenes" v={String(form.images.length)} />
						</div>
					)}

					{/* NAV INFERIOR */}
					<div className="flex justify-between mt-10">
						<button
							type="button"
							onClick={() => setStep((s) => Math.max(0, s - 1))}
							disabled={step === 0}
							className="px-5 py-2.5 rounded-lg border text-sm font-medium hover:bg-muted transition disabled:opacity-30"
						>
							Atrás
						</button>
						{PrimaryBtn}
					</div>
				</div>
			</div>
		</div>
	);
}

function Row({ k, v }: { k: string; v: string }) {
	return (
		<div className="flex justify-between px-4 py-3">
			<span className="text-muted-foreground">{k}</span>
			<span className="font-medium text-right">{v}</span>
		</div>
	);
}
