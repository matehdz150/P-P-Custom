"use client";

import {
	Check,
	ChevronLeft,
	ChevronRight,
	Minus,
	Package,
	Plus,
	X,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getMyProducts, type ProviderProduct } from "@/lib/api/providers";

/* ─── types ─────────────────────────────────────────────── */

export type SelectedItem = {
	product: ProviderProduct;
	quantity: number;
};

export type PackageFormData = {
	name: string;
	description: string;
	basePrice: string;
};

export type PackageWizardSubmit = {
	form: PackageFormData;
	selected: SelectedItem[];
};

const STEPS = ["Información", "Productos", "Revisar"];

/* ─── component ──────────────────────────────────────────── */

export default function PackageWizard({
	title,
	submitLabel,
	initialForm,
	initialSelected,
	loadingInitial = false,
	onSubmit,
}: {
	title: string;
	submitLabel: string;
	initialForm?: PackageFormData;
	initialSelected?: SelectedItem[];
	loadingInitial?: boolean;
	onSubmit: (data: PackageWizardSubmit) => Promise<void>;
}) {
	const router = useRouter();
	const [step, setStep] = useState(0);
	const [saving, setSaving] = useState(false);

	/* step 1 */
	const [form, setForm] = useState<PackageFormData>(
		initialForm ?? { name: "", description: "", basePrice: "" },
	);

	/* step 2 */
	const [myProducts, setMyProducts] = useState<ProviderProduct[]>([]);
	const [loadingProducts, setLoadingProducts] = useState(true);
	const [selected, setSelected] = useState<SelectedItem[]>(
		initialSelected ?? [],
	);

	/* hidratar cuando lleguen los datos iniciales (modo edición) */
	useEffect(() => {
		if (initialForm) setForm(initialForm);
	}, [initialForm]);

	useEffect(() => {
		if (initialSelected) setSelected(initialSelected);
	}, [initialSelected]);

	useEffect(() => {
		getMyProducts()
			.then(setMyProducts)
			.finally(() => setLoadingProducts(false));
	}, []);

	/* ─── helpers ─── */

	function isSelected(id: string) {
		return selected.some((s) => s.product.id === id);
	}

	function toggle(product: ProviderProduct) {
		if (isSelected(product.id)) {
			setSelected((prev) => prev.filter((s) => s.product.id !== product.id));
		} else {
			setSelected((prev) => [...prev, { product, quantity: 1 }]);
		}
	}

	function changeQty(id: string, delta: number) {
		setSelected((prev) =>
			prev.map((s) =>
				s.product.id === id
					? { ...s, quantity: Math.max(1, s.quantity + delta) }
					: s,
			),
		);
	}

	/* ─── validation ─── */

	function step1Valid() {
		return form.name.trim() && form.basePrice && Number(form.basePrice) > 0;
	}

	function step2Valid() {
		return selected.length > 0;
	}

	/* ─── submit ─── */

	async function handleSubmit() {
		setSaving(true);
		try {
			await onSubmit({ form, selected });
		} finally {
			setSaving(false);
		}
	}

	/* ─── render ─── */

	return (
		<div className="min-h-screen bg-[#f7f7f5]">
			{/* top bar */}
			<div className="sticky top-[52px] z-20 border-b border-[#e7e7e2] bg-white px-8 py-4">
				<div className="mx-auto flex max-w-3xl items-center justify-between">
					<button
						type="button"
						onClick={() => router.push("/proveedor/paquetes")}
						className="flex items-center gap-1.5 text-sm text-[#77776f] hover:text-[#171717]"
					>
						<ChevronLeft className="h-4 w-4" />
						Mis paquetes
					</button>

					{/* stepper */}
					<div className="flex items-center gap-2">
						{STEPS.map((label, i) => (
							<div key={label} className="flex items-center gap-2">
								<div className="flex items-center gap-1.5">
									<div
										className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
											i < step
												? "bg-[#171717] text-white"
												: i === step
													? "border-2 border-[#171717] text-[#171717]"
													: "border-2 border-[#d9d9d2] text-[#aaa]"
										}`}
									>
										{i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
									</div>
									<span
										className={`hidden text-sm sm:block ${
											i === step ? "font-semibold text-[#171717]" : "text-[#aaa]"
										}`}
									>
										{label}
									</span>
								</div>
								{i < STEPS.length - 1 && (
									<div
										className={`h-px w-8 ${i < step ? "bg-[#171717]" : "bg-[#d9d9d2]"}`}
									/>
								)}
							</div>
						))}
					</div>

					<div className="w-24" /> {/* spacer */}
				</div>
			</div>

			{/* content */}
			<div className="mx-auto max-w-3xl px-4 py-8">
				{loadingInitial ? (
					<div className="space-y-4">
						<div className="h-8 w-1/3 animate-pulse rounded bg-[#eeeeea]" />
						<div className="h-48 animate-pulse rounded-2xl bg-[#eeeeea]" />
					</div>
				) : (
					<>
						{step === 0 && (
							<>
								<div className="mb-6">
									<h1 className="text-2xl font-bold text-[#171717]">{title}</h1>
								</div>
								<StepInfo form={form} onChange={setForm} />
							</>
						)}
						{step === 1 && (
							<StepProducts
								products={myProducts}
								loading={loadingProducts}
								selected={selected}
								isSelected={isSelected}
								onToggle={toggle}
								onChangeQty={changeQty}
							/>
						)}
						{step === 2 && (
							<StepReview
								form={form}
								selected={selected}
								onRemove={(id) =>
									setSelected((p) => p.filter((s) => s.product.id !== id))
								}
							/>
						)}

						{/* nav buttons */}
						<div className="mt-8 flex items-center justify-between">
							<button
								type="button"
								onClick={() => setStep((s) => s - 1)}
								disabled={step === 0}
								className="flex items-center gap-1.5 rounded-lg border border-[#d9d9d2] px-5 py-2.5 text-sm font-semibold text-[#171717] hover:bg-[#f4f4f1] disabled:pointer-events-none disabled:opacity-40"
							>
								<ChevronLeft className="h-4 w-4" />
								Atrás
							</button>

							{step < STEPS.length - 1 ? (
								<button
									type="button"
									onClick={() => setStep((s) => s + 1)}
									disabled={step === 0 ? !step1Valid() : !step2Valid()}
									className="flex items-center gap-1.5 rounded-lg bg-[#171717] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#2a2a2a] disabled:pointer-events-none disabled:opacity-40"
								>
									Siguiente
									<ChevronRight className="h-4 w-4" />
								</button>
							) : (
								<button
									type="button"
									onClick={handleSubmit}
									disabled={saving}
									className="flex items-center gap-2 rounded-lg bg-[#171717] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#2a2a2a] disabled:opacity-60"
								>
									{saving ? "Guardando…" : submitLabel}
								</button>
							)}
						</div>
					</>
				)}
			</div>
		</div>
	);
}

/* ─── Step 1: Info ───────────────────────────────────────── */

function StepInfo({
	form,
	onChange,
}: {
	form: PackageFormData;
	onChange: (f: PackageFormData) => void;
}) {
	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-2xl font-bold text-[#171717]">
					Información del paquete
				</h2>
				<p className="mt-1 text-sm text-[#77776f]">
					Dale nombre, descripción y precio a tu paquete.
				</p>
			</div>

			<div className="rounded-2xl border border-[#e7e7e2] bg-white p-6 space-y-5">
				<div className="space-y-1.5">
					<label className="text-sm font-semibold text-[#171717]">
						Nombre del paquete *
					</label>
					<input
						type="text"
						placeholder="ej. Pack empresarial completo"
						value={form.name}
						onChange={(e) => onChange({ ...form, name: e.target.value })}
						className="w-full rounded-lg border border-[#d9d9d2] px-4 py-3 text-sm outline-none focus:border-[#171717] focus:ring-1 focus:ring-[#171717]"
					/>
				</div>

				<div className="space-y-1.5">
					<label className="text-sm font-semibold text-[#171717]">
						Descripción
					</label>
					<textarea
						placeholder="Describe qué incluye el paquete, para qué ocasión es ideal…"
						value={form.description}
						onChange={(e) => onChange({ ...form, description: e.target.value })}
						rows={4}
						className="w-full resize-none rounded-lg border border-[#d9d9d2] px-4 py-3 text-sm outline-none focus:border-[#171717] focus:ring-1 focus:ring-[#171717]"
					/>
				</div>

				<div className="space-y-1.5">
					<label className="text-sm font-semibold text-[#171717]">
						Precio base *
					</label>
					<div className="relative">
						<span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[#77776f]">
							$
						</span>
						<input
							type="number"
							min="0"
							step="0.01"
							placeholder="0.00"
							value={form.basePrice}
							onChange={(e) => onChange({ ...form, basePrice: e.target.value })}
							className="w-full rounded-lg border border-[#d9d9d2] py-3 pl-8 pr-4 text-sm outline-none focus:border-[#171717] focus:ring-1 focus:ring-[#171717]"
						/>
					</div>
				</div>
			</div>
		</div>
	);
}

/* ─── Step 2: Products ───────────────────────────────────── */

function StepProducts({
	products,
	loading,
	selected,
	isSelected,
	onToggle,
	onChangeQty,
}: {
	products: ProviderProduct[];
	loading: boolean;
	selected: SelectedItem[];
	isSelected: (id: string) => boolean;
	onToggle: (p: ProviderProduct) => void;
	onChangeQty: (id: string, delta: number) => void;
}) {
	return (
		<div className="space-y-6">
			<div className="flex items-end justify-between">
				<div>
					<h2 className="text-2xl font-bold text-[#171717]">
						Selecciona los productos
					</h2>
					<p className="mt-1 text-sm text-[#77776f]">
						Elige uno o más productos de tu catálogo para incluir en el paquete.
					</p>
				</div>
				{selected.length > 0 && (
					<span className="rounded-full bg-[#171717] px-3 py-1 text-xs font-bold text-white">
						{selected.length} seleccionado{selected.length > 1 ? "s" : ""}
					</span>
				)}
			</div>

			{loading ? (
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
					{Array.from({ length: 6 }).map((_, i) => (
						<div
							key={i}
							className="animate-pulse rounded-2xl border border-[#e7e7e2] bg-white"
						>
							<div className="aspect-square rounded-t-2xl bg-[#eeeeea]" />
							<div className="p-3 space-y-2">
								<div className="h-3.5 w-3/4 rounded bg-[#eeeeea]" />
								<div className="h-3 w-1/2 rounded bg-[#eeeeea]" />
							</div>
						</div>
					))}
				</div>
			) : products.length === 0 ? (
				<div className="rounded-2xl border-2 border-dashed border-[#d9d9d2] bg-white py-16 text-center">
					<Package className="mx-auto h-10 w-10 text-[#aaa]" />
					<p className="mt-3 text-sm font-semibold text-[#171717]">
						No tienes productos todavía
					</p>
					<p className="mt-1 text-sm text-[#77776f]">
						Primero crea productos para poder armar paquetes.
					</p>
				</div>
			) : (
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
					{products.map((product) => {
						const sel = isSelected(product.id);
						const item = selected.find((s) => s.product.id === product.id);
						const img = product.images?.[0]?.url;

						return (
							<div
								key={product.id}
								onClick={() => onToggle(product)}
								className={`group relative cursor-pointer overflow-hidden rounded-2xl border-2 bg-white transition-all ${
									sel
										? "border-[#171717] shadow-md"
										: "border-[#e7e7e2] hover:border-[#aaa]"
								}`}
							>
								{/* checkmark */}
								{sel && (
									<div className="absolute right-2.5 top-2.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[#171717]">
										<Check className="h-3.5 w-3.5 text-white" />
									</div>
								)}

								{/* image */}
								<div className="relative aspect-square bg-[#f4f4f1]">
									{img ? (
										<Image
											src={img}
											alt={product.name}
											fill
											className="object-cover"
											sizes="(min-width: 640px) 33vw, 50vw"
										/>
									) : (
										<div className="flex h-full items-center justify-center text-[#aaa]">
											<Package className="h-10 w-10" />
										</div>
									)}
									{!sel && (
										<div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/5" />
									)}
								</div>

								{/* info */}
								<div className="p-3">
									<p className="truncate text-sm font-semibold text-[#171717]">
										{product.name}
									</p>
									<p className="mt-0.5 text-xs text-[#77776f]">
										{product.pricing
											? `$${product.pricing.basePrice}`
											: "Sin precio"}
									</p>

									{/* quantity control — solo si está seleccionado */}
									{sel && item && (
										<div
											className="mt-2 flex items-center justify-between"
											onClick={(e) => e.stopPropagation()}
										>
											<span className="text-xs text-[#77776f]">Cantidad</span>
											<div className="flex items-center gap-1.5">
												<button
													type="button"
													onClick={() => onChangeQty(product.id, -1)}
													className="flex h-6 w-6 items-center justify-center rounded-full border border-[#d9d9d2] hover:bg-[#f4f4f1]"
												>
													<Minus className="h-3 w-3" />
												</button>
												<span className="w-5 text-center text-sm font-semibold">
													{item.quantity}
												</span>
												<button
													type="button"
													onClick={() => onChangeQty(product.id, 1)}
													className="flex h-6 w-6 items-center justify-center rounded-full border border-[#d9d9d2] hover:bg-[#f4f4f1]"
												>
													<Plus className="h-3 w-3" />
												</button>
											</div>
										</div>
									)}
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}

/* ─── Step 3: Review ─────────────────────────────────────── */

function StepReview({
	form,
	selected,
	onRemove,
}: {
	form: PackageFormData;
	selected: SelectedItem[];
	onRemove: (id: string) => void;
}) {
	const total = selected.reduce(
		(acc, s) => acc + (s.product.pricing?.basePrice ?? 0) * s.quantity,
		0,
	);

	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-2xl font-bold text-[#171717]">Revisa tu paquete</h2>
				<p className="mt-1 text-sm text-[#77776f]">
					Confirma los detalles antes de guardar.
				</p>
			</div>

			{/* info card */}
			<div className="rounded-2xl border border-[#e7e7e2] bg-white p-6 space-y-3">
				<div className="flex items-start justify-between">
					<div>
						<p className="text-xs font-semibold uppercase tracking-wide text-[#aaa]">
							Nombre
						</p>
						<p className="mt-0.5 text-lg font-bold text-[#171717]">
							{form.name}
						</p>
					</div>
					<div className="text-right">
						<p className="text-xs font-semibold uppercase tracking-wide text-[#aaa]">
							Precio
						</p>
						<p className="mt-0.5 text-lg font-bold text-[#171717]">
							${Number(form.basePrice).toFixed(2)}
						</p>
					</div>
				</div>

				{form.description && (
					<p className="text-sm text-[#77776f] leading-relaxed border-t border-[#f0f0ec] pt-3">
						{form.description}
					</p>
				)}
			</div>

			{/* products */}
			<div className="rounded-2xl border border-[#e7e7e2] bg-white divide-y divide-[#f0f0ec]">
				<div className="px-5 py-3">
					<p className="text-sm font-semibold text-[#171717]">
						{selected.length} producto{selected.length > 1 ? "s" : ""} incluido
						{selected.length > 1 ? "s" : ""}
					</p>
				</div>
				{selected.map((item) => {
					const img = item.product.images?.[0]?.url;
					return (
						<div
							key={item.product.id}
							className="flex items-center gap-4 px-5 py-4"
						>
							{/* thumbnail */}
							<div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#f4f4f1]">
								{img ? (
									<Image
										src={img}
										alt={item.product.name}
										fill
										className="object-cover"
										sizes="56px"
									/>
								) : (
									<div className="flex h-full items-center justify-center">
										<Package className="h-6 w-6 text-[#aaa]" />
									</div>
								)}
							</div>

							<div className="flex-1 min-w-0">
								<p className="truncate text-sm font-semibold text-[#171717]">
									{item.product.name}
								</p>
								<p className="text-xs text-[#77776f]">
									{item.product.pricing
										? `$${item.product.pricing.basePrice}`
										: "Sin precio"}{" "}
									· cantidad: {item.quantity}
								</p>
							</div>

							<button
								type="button"
								onClick={() => onRemove(item.product.id)}
								className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-[#f4f4f1] text-[#aaa] hover:text-[#171717]"
							>
								<X className="h-4 w-4" />
							</button>
						</div>
					);
				})}
				{total > 0 && (
					<div className="flex items-center justify-between px-5 py-3 bg-[#f7f7f5] rounded-b-2xl">
						<p className="text-xs text-[#77776f]">Suma de productos</p>
						<p className="text-sm font-semibold text-[#171717]">
							${total.toFixed(2)}
						</p>
					</div>
				)}
			</div>
		</div>
	);
}
