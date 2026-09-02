"use client";

import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import {
	Check,
	Copy,
	Loader2,
	Pencil,
	Plus,
	Sparkles,
	Trash2,
	X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/Contexts/AuthContext";
import {
	ensurePackageDesign,
	setPackageDesignUnits,
	type PackageDesign,
	type PackageDesignItem,
	type PackageDesignUnit,
} from "@/lib/api/package-designs";

type Props = {
	params: Promise<{ id: string }>;
};

/** Devuelve la primera miniatura disponible de un diseño. */
function firstSnapshot(
	snapshots: Record<string, string> | null | undefined,
): string | null {
	if (!snapshots) return null;
	const values = Object.values(snapshots);
	return values.length > 0 ? values[0] : null;
}

export default function PackageDesignHubPage({ params }: Props) {
	const { id: packageId } = use(params);
	const router = useRouter();
	const { user, loading: authLoading } = useAuth();

	const [pkgDesign, setPkgDesign] = useState<PackageDesign | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [busyItemId, setBusyItemId] = useState<string | null>(null);
	const [finishing, setFinishing] = useState(false);

	// ── Cargar (o crear) el borrador de diseño del paquete ──
	useEffect(() => {
		if (authLoading) return;
		if (!user) {
			setLoading(false);
			return;
		}
		let cancelled = false;
		setLoading(true);
		ensurePackageDesign(packageId)
			.then((pd) => {
				if (!cancelled) setPkgDesign(pd);
			})
			.catch((e) => {
				if (!cancelled)
					setError(e instanceof Error ? e.message : "Error al cargar el paquete");
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [packageId, user, authLoading]);

	// Mapa packageItemId -> units[] ordenado por unitIndex
	const unitsByItem = useMemo(() => {
		const map = new Map<string, PackageDesignUnit[]>();
		for (const u of pkgDesign?.units ?? []) {
			const arr = map.get(u.packageItemId) ?? [];
			arr.push(u);
			map.set(u.packageItemId, arr);
		}
		for (const arr of map.values()) arr.sort((a, b) => a.unitIndex - b.unitIndex);
		return map;
	}, [pkgDesign]);

	const items = pkgDesign?.package?.items ?? [];

	const totalUnits = useMemo(
		() => items.reduce((acc, it) => acc + it.quantity, 0),
		[items],
	);
	const assignedUnits = useMemo(
		() => (pkgDesign?.units ?? []).filter((u) => u.designId).length,
		[pkgDesign],
	);
	const allAssigned = totalUnits > 0 && assignedUnits === totalUnits;

	// ── Navegar al diseñador para una unidad ──
	const designUnit = useCallback(
		(item: PackageDesignItem, unit: PackageDesignUnit) => {
			if (!pkgDesign) return;
			const sp = new URLSearchParams({
				packageDesignId: pkgDesign.id,
				packageItemId: item.id,
				units: String(unit.unitIndex),
				returnTo: `/package/${packageId}/disenar`,
			});
			if (unit.designId) sp.set("draftId", unit.designId);
			router.push(`/design/${item.productId}?${sp.toString()}`);
		},
		[pkgDesign, packageId, router],
	);

	// ── Asignar un designId a una o varias unidades de un artículo ──
	const assignDesign = useCallback(
		async (
			item: PackageDesignItem,
			designId: string | null,
			targetIndices: number[],
		) => {
			if (!pkgDesign || targetIndices.length === 0) return;
			setBusyItemId(item.id);
			try {
				const updated = await setPackageDesignUnits(
					pkgDesign.id,
					targetIndices.map((unitIndex) => ({
						packageItemId: item.id,
						unitIndex,
						designId,
					})),
				);
				setPkgDesign(updated);
			} catch (e) {
				setError(e instanceof Error ? e.message : "No se pudo aplicar el diseño");
			} finally {
				setBusyItemId(null);
			}
		},
		[pkgDesign],
	);

	const finishPackage = useCallback(() => {
		if (!pkgDesign) return;
		setFinishing(true);
		router.push(`/package/${packageId}/resumen?designId=${pkgDesign.id}`);
	}, [pkgDesign, packageId, router]);

	// ── Estados de carga / sin sesión ──
	if (authLoading || loading) {
		return (
			<main className="flex min-h-[60vh] items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-[#fe6241]" />
			</main>
		);
	}

	if (!user) {
		return (
			<main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
				<Sparkles className="h-10 w-10 text-[#fe6241]" />
				<h1 className="text-2xl font-bold">Inicia sesión para diseñar tu paquete</h1>
				<p className="max-w-md text-sm text-muted-foreground">
					Guardamos el progreso de tus diseños en tu cuenta para que puedas
					continuar desde cualquier dispositivo.
				</p>
				<Button
					size="lg"
					className="cursor-pointer"
					onClick={() => router.push("/login")}
				>
					Iniciar sesión
				</Button>
			</main>
		);
	}

	if (error) {
		return (
			<main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
				<p className="text-sm text-red-600">{error}</p>
				<Button variant="outline" onClick={() => router.refresh()}>
					Reintentar
				</Button>
			</main>
		);
	}

	return (
		<main className="mx-auto w-full max-w-5xl space-y-10 py-6">
			{/* ── Encabezado ── */}
			<header className="space-y-3">
				<div className="flex flex-wrap items-center justify-between gap-4">
					<div>
						<h1 className="text-2xl font-bold tracking-tight md:text-3xl">
							Diseña tu paquete
						</h1>
						<p className="text-sm text-muted-foreground">
							{pkgDesign?.package?.name}
						</p>
					</div>
					<div className="flex items-center gap-3">
						<span className="rounded-full bg-[#f1f1ea] px-3 py-1 text-xs font-semibold text-gray-700">
							{assignedUnits}/{totalUnits} unidades diseñadas
						</span>
						<Button
							className="cursor-pointer"
							disabled={!allAssigned || finishing}
							onClick={finishPackage}
						>
							{finishing ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<Check className="h-4 w-4" />
							)}
							Finalizar
						</Button>
					</div>
				</div>
				{/* Barra de progreso */}
				<div className="h-2 w-full overflow-hidden rounded-full bg-[#eceadf]">
					<div
						className="h-full rounded-full bg-[#fe6241] transition-all"
						style={{
							width: `${totalUnits ? (assignedUnits / totalUnits) * 100 : 0}%`,
						}}
					/>
				</div>
			</header>

			{/* ── Artículos del paquete ── */}
			<div className="space-y-12">
				{items.map((item) => {
					const units = unitsByItem.get(item.id) ?? [];
					return (
						<PackageItemSection
							key={item.id}
							item={item}
							units={units}
							busy={busyItemId === item.id}
							onDesign={(unit) => designUnit(item, unit)}
							onAssign={(designId, indices) =>
								assignDesign(item, designId, indices)
							}
						/>
					);
				})}
			</div>
		</main>
	);
}

/* ===================== Sección por artículo ===================== */

function PackageItemSection({
	item,
	units,
	busy,
	onDesign,
	onAssign,
}: {
	item: PackageDesignItem;
	units: PackageDesignUnit[];
	busy: boolean;
	onDesign: (unit: PackageDesignUnit) => void;
	onAssign: (designId: string | null, targetIndices: number[]) => void;
}) {
	const productImage =
		[...(item.product?.images ?? [])].sort((a, b) => a.order - b.order)[0]?.url ??
		null;

	const designedUnits = units.filter((u) => u.designId);

	// ── Modo "aplicar diseño a varias unidades" ──
	const [applyMode, setApplyMode] = useState(false);
	const [sourceIndex, setSourceIndex] = useState<number | null>(null);
	const [targets, setTargets] = useState<number[]>([]);

	const sourceUnit = units.find((u) => u.unitIndex === sourceIndex) ?? null;

	function openApply() {
		const first = designedUnits[0] ?? null;
		setSourceIndex(first?.unitIndex ?? null);
		setTargets([]);
		setApplyMode(true);
	}
	function closeApply() {
		setApplyMode(false);
		setSourceIndex(null);
		setTargets([]);
	}
	function toggleTarget(index: number) {
		setTargets((prev) =>
			prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
		);
	}
	function confirmApply() {
		if (sourceUnit?.designId && targets.length) {
			onAssign(sourceUnit.designId, targets);
		}
		closeApply();
	}

	const targetCandidates = units.filter((u) => u.unitIndex !== sourceIndex);

	return (
		<section className="space-y-4">
			{/* Encabezado del artículo */}
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex items-center gap-3">
					{productImage && (
						// biome-ignore lint/performance/noImgElement: thumbnail remota
						<img
							src={productImage}
							alt={item.product?.name ?? ""}
							className="h-11 w-11 rounded-md object-cover"
						/>
					)}
					<div>
						<h2 className="font-semibold">{item.product?.name}</h2>
						<p className="text-xs text-muted-foreground">
							{item.quantity} {item.quantity === 1 ? "unidad" : "unidades"}
						</p>
					</div>
				</div>

				{/* Botón notorio: reutilizar un diseño en varias unidades */}
				{designedUnits.length > 0 && units.length > 1 && !applyMode && (
					<button
						type="button"
						onClick={openApply}
						disabled={busy}
						className="inline-flex items-center gap-2 rounded-lg border-2 border-[#fe6241] bg-[#fe6241]/5 px-4 py-2 text-sm font-bold text-[#fe6241] transition-colors hover:bg-[#fe6241]/15 disabled:opacity-50"
					>
						<Copy className="h-4 w-4" />
						Aplicar un diseño a varias unidades
					</button>
				)}
			</div>

			{/* Panel de aplicar a varias unidades */}
			{applyMode && (
				<div className="space-y-5 rounded-2xl border-2 border-[#fe6241] bg-[#fff8f6] p-5">
					<div className="flex items-center justify-between">
						<h3 className="flex items-center gap-2 text-sm font-bold text-[#fe6241]">
							<Copy className="h-4 w-4" />
							Reutilizar un diseño
						</h3>
						<button
							type="button"
							onClick={closeApply}
							className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
							aria-label="Cerrar"
						>
							<X className="h-4 w-4" />
						</button>
					</div>

					{/* Paso 1: elegir diseño de origen */}
					<div className="space-y-2">
						<p className="text-xs font-semibold text-gray-700">
							1. Elige el diseño que quieres reutilizar
						</p>
						<div className="flex flex-wrap gap-3">
							{designedUnits.map((u) => {
								const thumb = firstSnapshot(u.design?.snapshots);
								const active = u.unitIndex === sourceIndex;
								return (
									<button
										key={u.id}
										type="button"
										onClick={() => {
											setSourceIndex(u.unitIndex);
											setTargets((prev) =>
												prev.filter((i) => i !== u.unitIndex),
											);
										}}
										className={`relative h-20 w-20 overflow-hidden rounded-lg border-2 transition-all ${
											active
												? "border-[#fe6241] ring-2 ring-[#fe6241]/30"
												: "border-gray-200 hover:border-[#fe6241]/60"
										}`}
									>
										{thumb ? (
											// biome-ignore lint/performance/noImgElement: thumbnail remota
											<img
												src={thumb}
												alt=""
												className="h-full w-full object-contain bg-[#f5f5f1]"
											/>
										) : (
											<div className="flex h-full items-center justify-center bg-[#f5f5f1] text-[10px] text-gray-400">
												#{u.unitIndex + 1}
											</div>
										)}
										{active && (
											<span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#fe6241] text-white">
												<Check className="h-3 w-3" />
											</span>
										)}
									</button>
								);
							})}
						</div>
					</div>

					{/* Paso 2: elegir unidades destino */}
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<p className="text-xs font-semibold text-gray-700">
								2. ¿En qué unidades quieres usarlo?
							</p>
							<button
								type="button"
								onClick={() =>
									setTargets(targetCandidates.map((u) => u.unitIndex))
								}
								className="text-xs font-bold text-[#fe6241] hover:underline"
							>
								Seleccionar todas
							</button>
						</div>
						<div className="flex flex-wrap gap-2">
							{targetCandidates.map((u) => {
								const isSel = targets.includes(u.unitIndex);
								return (
									<button
										key={u.unitIndex}
										type="button"
										onClick={() => toggleTarget(u.unitIndex)}
										className={`flex h-10 min-w-10 items-center justify-center rounded-lg border-2 px-3 text-sm font-bold transition-colors ${
											isSel
												? "border-[#fe6241] bg-[#fe6241] text-white"
												: "border-gray-200 bg-white text-gray-600 hover:border-[#fe6241]"
										}`}
									>
										#{u.unitIndex + 1}
									</button>
								);
							})}
						</div>
					</div>

					<div className="flex items-center justify-end gap-3 pt-1">
						<button
							type="button"
							onClick={closeApply}
							className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
						>
							Cancelar
						</button>
						<button
							type="button"
							onClick={confirmApply}
							disabled={!sourceUnit?.designId || targets.length === 0 || busy}
							className="inline-flex items-center gap-2 rounded-lg bg-[#fe6241] px-5 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#e5573a] disabled:opacity-50"
						>
							{busy ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<Copy className="h-4 w-4" />
							)}
							Aplicar a {targets.length}{" "}
							{targets.length === 1 ? "unidad" : "unidades"}
						</button>
					</div>
				</div>
			)}

			{/* Cuadrícula de unidades */}
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
				{units.map((unit) => (
					<UnitSlot
						key={unit.id}
						unit={unit}
						busy={busy}
						highlight={applyMode && targets.includes(unit.unitIndex)}
						onDesign={() => onDesign(unit)}
						onClear={() => onAssign(null, [unit.unitIndex])}
					/>
				))}
			</div>
		</section>
	);
}

/* ===================== Slot individual ===================== */

function UnitSlot({
	unit,
	busy,
	highlight,
	onDesign,
	onClear,
}: {
	unit: PackageDesignUnit;
	busy: boolean;
	highlight: boolean;
	onDesign: () => void;
	onClear: () => void;
}) {
	const thumb = firstSnapshot(unit.design?.snapshots);

	// ── Slot vacío ──
	if (!unit.designId) {
		return (
			<button
				type="button"
				onClick={onDesign}
				disabled={busy}
				className={`relative flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-[#faf9f4] text-gray-400 transition-colors hover:border-[#fe6241] hover:text-[#fe6241] disabled:opacity-50 ${
					highlight ? "border-[#fe6241] ring-2 ring-[#fe6241]/30" : "border-[#d9d8cd]"
				}`}
			>
				<Plus className="h-6 w-6" />
				<span className="text-xs font-medium">Diseñar</span>
				<span className="absolute left-2 top-2 text-[10px] font-semibold text-gray-300">
					#{unit.unitIndex + 1}
				</span>
			</button>
		);
	}

	// ── Slot con diseño ──
	return (
		<div
			className={`relative flex flex-col overflow-hidden rounded-xl border bg-white transition-all ${
				highlight ? "border-[#fe6241] ring-2 ring-[#fe6241]/30" : "border-[#e5e4d9]"
			}`}
		>
			<div className="relative aspect-square bg-[#f5f5f1]">
				{thumb ? (
					// biome-ignore lint/performance/noImgElement: thumbnail remota
					<img
						src={thumb}
						alt={unit.design?.name ?? "Diseño"}
						className="h-full w-full object-contain"
					/>
				) : (
					<div className="flex h-full items-center justify-center text-xs text-gray-400">
						Sin vista previa
					</div>
				)}
				<span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
					#{unit.unitIndex + 1}
				</span>
				{busy && (
					<div className="absolute inset-0 flex items-center justify-center bg-white/60">
						<Loader2 className="h-6 w-6 animate-spin text-[#fe6241]" />
					</div>
				)}
			</div>

			<div className="flex items-center justify-between gap-1 p-2">
				<button
					type="button"
					onClick={onDesign}
					disabled={busy}
					className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
				>
					<Pencil className="h-3.5 w-3.5" />
					Editar
				</button>
				<button
					type="button"
					onClick={onClear}
					disabled={busy}
					className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
					aria-label="Quitar diseño"
				>
					<Trash2 className="h-3.5 w-3.5" />
				</button>
			</div>
		</div>
	);
}
