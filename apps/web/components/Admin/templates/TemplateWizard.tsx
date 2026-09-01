"use client";

import { ArrowLeft } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
	CreateTemplateInput,
	EditableArea,
	ProductTemplate,
} from "@/lib/api/templates";
import { EditableAreasSection } from "./TemplateForm/EditableAreasSection";
import {
	CANVAS_H,
	CANVAS_W,
} from "./TemplateForm/MockupAreaEditor";
import { SideMockupUploader } from "./TemplateForm/SideMockupUploader";

type SideDef = { key: string; label: string };

type Props = {
	onCancel: () => void;
	onSubmit: (data: CreateTemplateInput) => Promise<void> | void;
	/** si se pasa, el wizard entra en modo edición */
	initial?: ProductTemplate | null;
};

function slugify(s: string) {
	return s
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export function TemplateWizard({ onCancel, onSubmit, initial }: Props) {
	const isEdit = !!initial;

	const [step, setStep] = useState(0);
	const [saving, setSaving] = useState(false);

	const [id, setId] = useState(initial?.id ?? "");
	const [name, setName] = useState(initial?.name ?? "");
	const [sides, setSides] = useState<SideDef[]>(
		initial
			? initial.data.sides.map((k) => ({
					key: k,
					label: initial.data.sideLabels?.[k] ?? k,
				}))
			: [{ key: "front", label: "Delante" }],
	);
	const [mockups, setMockups] = useState<Record<string, string>>(
		initial?.data.mockups ?? {},
	);
	const [areas, setAreas] = useState<Record<string, EditableArea[]>>(
		initial?.data.editableAreas ?? {},
	);

	// pasos: 0 Identidad · 1 Lados · 2..(1+N) cada lado · último Revisar
	const totalSteps = 2 + sides.length + 1;
	const isIdentity = step === 0;
	const isSides = step === 1;
	const isReview = step === totalSteps - 1;
	const sideIndex = !isIdentity && !isSides && !isReview ? step - 2 : -1;
	const currentSide = sideIndex >= 0 ? sides[sideIndex] : null;

	// asegura un área por defecto al entrar a configurar un lado
	function ensureDefaultArea(key: string) {
		setAreas((prev) => {
			if (prev[key]?.length) return prev;
			const w = 360;
			const h = 360;
			return {
				...prev,
				[key]: [
					{
						id: `${key}-main`,
						type: "rect",
						left: Math.round(CANVAS_W / 2 - w / 2),
						top: Math.round(CANVAS_H / 2 - h / 2),
						width: w,
						height: h,
					},
				],
			};
		});
	}

	const canContinue = useMemo(() => {
		if (isIdentity) return id.trim().length > 0 && name.trim().length > 0;
		if (isSides)
			return (
				sides.length > 0 &&
				sides.every((s) => s.key.trim() && s.label.trim())
			);
		if (currentSide)
			return (
				!!mockups[currentSide.key] &&
				(areas[currentSide.key]?.length ?? 0) > 0
			);
		return true;
	}, [isIdentity, isSides, currentSide, id, name, sides, mockups, areas]);

	function goNext() {
		if (!canContinue) return;
		if (isReview) return submit();
		const next = step + 1;
		// al pasar a un step de lado, garantiza área por defecto
		const nextSideIdx =
			next >= 2 && next < 2 + sides.length ? next - 2 : -1;
		if (nextSideIdx >= 0) ensureDefaultArea(sides[nextSideIdx].key);
		setStep(next);
	}

	function goBack() {
		if (step === 0) return onCancel();
		setStep(step - 1);
	}

	async function submit() {
		setSaving(true);
		try {
			const sideKeys = sides.map((s) => s.key);
			const sideLabels: Record<string, string> = {};
			sides.forEach((s) => {
				sideLabels[s.key] = s.label;
			});
			await onSubmit({
				// en edición el id es la llave primaria → no se transforma
				id: isEdit ? (initial?.id ?? id) : slugify(id),
				name: name.trim(),
				data: {
					sides: sideKeys,
					sideLabels,
					mockups,
					editableAreas: areas,
				},
			});
		} finally {
			setSaving(false);
		}
	}

	// ── sides editing ──
	function addSide() {
		setSides((p) => [...p, { key: "", label: "" }]);
	}
	function updateSide(i: number, patch: Partial<SideDef>) {
		setSides((p) => p.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
	}
	function removeSide(i: number) {
		setSides((p) => p.filter((_, idx) => idx !== i));
	}

	return (
		<div className="fixed inset-0 z-50 bg-white flex flex-col">
			{/* TOP BAR */}
			<div className="flex items-center gap-4 px-6 pt-5">
				<div className="flex-1 flex gap-1.5">
					{Array.from({ length: totalSteps }).map((_, i) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: progress segments
							key={i}
							className={`h-1 flex-1 rounded-full transition-colors ${
								i <= step ? "bg-[#6c5ce7]" : "bg-gray-200"
							}`}
						/>
					))}
				</div>
				<Button
					type="button"
					onClick={goNext}
					disabled={!canContinue || saving}
					className="bg-black text-white hover:bg-black/90 rounded-lg px-6 h-11"
				>
					{saving
						? "Guardando…"
						: isReview
							? isEdit
								? "Guardar cambios"
								: "Crear mockup"
							: "Continuar"}
				</Button>
			</div>

			{/* BACK */}
			<div className="px-6 pt-4">
				<button
					type="button"
					onClick={goBack}
					className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-black transition"
				>
					<ArrowLeft size={16} />
					{step === 0 ? "Cancelar" : "Atrás"}
				</button>
			</div>

			{/* CONTENT */}
			<div className="flex-1 overflow-y-auto">
				<div className="max-w-2xl mx-auto px-6 py-10">
					{/* STEP 0 — IDENTIDAD */}
					{isIdentity && (
						<Section
							label="Configuración del mockup"
							title={
								isEdit
									? "Editar mockup"
									: "¿Cómo se llama este mockup?"
							}
							desc="El ID se usa internamente (ej. lentes-01). El nombre es el que verás en el listado."
						>
							<Field label="ID del mockup">
								<Input
									autoFocus={!isEdit}
									disabled={isEdit}
									placeholder="lentes-01"
									value={id}
									onChange={(e) => setId(e.target.value)}
								/>
								{isEdit ? (
									<p className="text-xs text-gray-400 mt-1">
										El ID no se puede cambiar.
									</p>
								) : (
									id && (
										<p className="text-xs text-gray-400 mt-1">
											Se guardará como: <b>{slugify(id)}</b>
										</p>
									)
								)}
							</Field>
							<Field label="Nombre">
								<Input
									placeholder="Lentes de sol modelo 01"
									value={name}
									onChange={(e) => setName(e.target.value)}
								/>
							</Field>
						</Section>
					)}

					{/* STEP 1 — LADOS */}
					{isSides && (
						<Section
							label="Configuración del mockup"
							title="¿Cuántos lados tiene?"
							desc="Cada lado es una vista editable del producto (ej. delante, detrás, lente izquierdo)."
						>
							<div className="space-y-3">
								{sides.map((s, i) => (
									<div
										// biome-ignore lint/suspicious/noArrayIndexKey: side rows
										key={i}
										className="flex items-end gap-3"
									>
										<Field label="ID lado">
											<Input
												placeholder="front"
												value={s.key}
												onChange={(e) =>
													updateSide(i, { key: slugify(e.target.value) })
												}
											/>
										</Field>
										<Field label="Nombre visible">
											<Input
												placeholder="Delante"
												value={s.label}
												onChange={(e) =>
													updateSide(i, { label: e.target.value })
												}
											/>
										</Field>
										<Button
											type="button"
											variant="outline"
											className="h-9"
											disabled={sides.length === 1}
											onClick={() => removeSide(i)}
										>
											Quitar
										</Button>
									</div>
								))}
							</div>
							<Button
								type="button"
								variant="outline"
								className="mt-4"
								onClick={addSide}
							>
								+ Agregar lado
							</Button>
						</Section>
					)}

					{/* STEPS 2..N — CONFIGURAR CADA LADO */}
					{currentSide && (
						<Section
							label={`Lado ${sideIndex + 1} de ${sides.length} · ${currentSide.label}`}
							title={`Ajusta el área editable de "${currentSide.label}"`}
							desc="Sube la imagen del mockup y arrastra el recuadro naranja hasta cubrir la zona imprimible."
						>
							<div className="space-y-6">
								<SideMockupUploader
									templateId={id || "sin-id"}
									side={currentSide.key}
									value={mockups[currentSide.key]}
									onChange={(url) =>
										setMockups((p) => ({ ...p, [currentSide.key]: url }))
									}
								/>
								<EditableAreasSection
									mockup={mockups[currentSide.key]}
									value={areas[currentSide.key] ?? []}
									onChange={(next) =>
										setAreas((p) => ({ ...p, [currentSide.key]: next }))
									}
								/>
							</div>
						</Section>
					)}

					{/* STEP FINAL — REVISAR */}
					{isReview && (
						<Section
							label="Casi listo"
							title="Revisa y crea el mockup"
							desc="Verifica que todo esté correcto antes de guardarlo."
						>
							<div className="rounded-lg border divide-y text-sm">
								<Row k="ID" v={slugify(id)} />
								<Row k="Nombre" v={name} />
								<Row
									k="Lados"
									v={sides.map((s) => s.label).join(", ")}
								/>
								{sides.map((s) => (
									<Row
										key={s.key}
										k={`Áreas · ${s.label}`}
										v={`${areas[s.key]?.length ?? 0} área(s) · mockup ${
											mockups[s.key] ? "✓" : "✗"
										}`}
									/>
								))}
							</div>
						</Section>
					)}
				</div>
			</div>
		</div>
	);
}

function Section({
	label,
	title,
	desc,
	children,
}: {
	label: string;
	title: string;
	desc: string;
	children: React.ReactNode;
}) {
	return (
		<div>
			<p className="text-sm text-gray-400 mb-2">{label}</p>
			<h1 className="text-4xl font-bold tracking-tight mb-3">{title}</h1>
			<p className="text-gray-500 mb-8 max-w-lg">{desc}</p>
			<div>{children}</div>
		</div>
	);
}

function Field({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<label className="flex flex-col gap-1.5 flex-1 mb-4">
			<span className="text-sm font-semibold">{label}</span>
			{children}
		</label>
	);
}

function Row({ k, v }: { k: string; v: string }) {
	return (
		<div className="flex justify-between px-4 py-3">
			<span className="text-gray-500">{k}</span>
			<span className="font-medium text-right">{v}</span>
		</div>
	);
}
