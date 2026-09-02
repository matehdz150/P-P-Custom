"use client";

import {
	ArrowLeft,
	CheckCircle2,
	Loader2,
	Package,
	ShoppingBag,
	XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { use, useEffect, useMemo, useState } from "react";
import {
	createPackageOrder,
	type PackageOrder,
} from "@/lib/api/package-orders";
import {
	getPackageDesign,
	type PackageDesign,
	type PackageDesignUnit,
} from "@/lib/api/package-designs";

type Props = { params: Promise<{ id: string }> };
type CheckoutState = "idle" | "loading" | "success" | "error";

function money(n: number) {
	return new Intl.NumberFormat("es-MX", {
		style: "currency",
		currency: "MXN",
		maximumFractionDigits: 2,
	}).format(n);
}

function firstSnapshot(
	snapshots: Record<string, string> | null | undefined,
): string | null {
	if (!snapshots) return null;
	const values = Object.values(snapshots);
	return values.length > 0 ? values[0] : null;
}

export default function PackageOrderSummaryPage({ params }: Props) {
	const { id: packageId } = use(params);
	const router = useRouter();
	const searchParams = useSearchParams();
	const designId = searchParams.get("designId");

	const [design, setDesign] = useState<PackageDesign | null>(null);
	const [loading, setLoading] = useState(true);
	const [checkoutState, setCheckoutState] = useState<CheckoutState>("idle");
	const [errorMsg, setErrorMsg] = useState("");
	const [order, setOrder] = useState<PackageOrder["id"] | null>(null);

	useEffect(() => {
		if (!designId) {
			setLoading(false);
			return;
		}
		let cancelled = false;
		getPackageDesign(designId)
			.then((d) => {
				if (!cancelled) setDesign(d);
			})
			.catch(() => {
				if (!cancelled) setDesign(null);
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [designId]);

	// Mapa packageItemId -> units
	const unitsByItem = useMemo(() => {
		const map = new Map<string, PackageDesignUnit[]>();
		for (const u of design?.units ?? []) {
			const arr = map.get(u.packageItemId) ?? [];
			arr.push(u);
			map.set(u.packageItemId, arr);
		}
		for (const arr of map.values())
			arr.sort((a, b) => a.unitIndex - b.unitIndex);
		return map;
	}, [design]);

	const items = design?.package?.items ?? [];
	const total = design?.package?.pricing?.basePrice ?? 0;

	const totalUnits = items.reduce((acc, it) => acc + it.quantity, 0);
	const assignedUnits = (design?.units ?? []).filter((u) => u.designId).length;
	const allAssigned = totalUnits > 0 && assignedUnits === totalUnits;

	async function handleConfirm() {
		if (!designId) return;
		setCheckoutState("loading");
		setErrorMsg("");
		try {
			const res = await createPackageOrder({ packageDesignId: designId });
			setOrder(res.id);
			setCheckoutState("success");
		} catch (err) {
			setErrorMsg(
				err instanceof Error
					? err.message
					: "Ocurrió un error al confirmar el pedido.",
			);
			setCheckoutState("error");
		}
	}

	// ── Éxito ──
	if (checkoutState === "success") {
		return (
			<div className="flex min-h-[70vh] flex-col items-center justify-center bg-[#f7f7f5] px-4">
				<div className="w-full max-w-sm rounded-2xl border border-[#e8e8e8] bg-white p-8 text-center shadow-sm">
					<div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
						<CheckCircle2 className="h-9 w-9 text-emerald-600" />
					</div>
					<h1 className="mt-5 text-[20px] font-black text-[#1a1a1a]">
						¡Pedido confirmado!
					</h1>
					<p className="mt-2 text-[13px] text-[#888]">
						Tu paquete fue enviado al proveedor. Puedes seguir su estado desde tu
						dashboard.
					</p>
					{order && (
						<p className="mt-3 rounded-lg bg-[#f3f3f1] px-3 py-2 text-[11px] font-mono text-[#555]">
							ID: {order}
						</p>
					)}
					<button
						type="button"
						onClick={() => router.push("/dashboard")}
						className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a1a1a] py-3 text-[14px] font-bold text-white transition-colors hover:bg-[#333]"
					>
						Ver mis pedidos
					</button>
					<Link
						href="/catalogo"
						className="mt-3 block text-center text-[13px] text-[#888] underline underline-offset-2 hover:text-[#1a1a1a]"
					>
						Seguir comprando
					</Link>
				</div>
			</div>
		);
	}

	if (loading) {
		return (
			<div className="flex min-h-[60vh] items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-[#fe6241]" />
			</div>
		);
	}

	if (!design) {
		return (
			<div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
				<Package className="h-12 w-12 text-[#ccc]" />
				<p className="text-[15px] font-semibold text-[#1a1a1a]">
					No se encontró el diseño del paquete
				</p>
				<Link
					href={`/package/${packageId}/disenar`}
					className="inline-flex items-center gap-1.5 text-sm text-[#555] underline"
				>
					<ArrowLeft className="h-4 w-4" /> Volver a diseñar
				</Link>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-[#f7f7f5]">
			{/* Sub-nav */}
			<header className="sticky top-0 z-20 border-b border-[#e8e8e8] bg-white px-6 py-4">
				<div className="mx-auto flex max-w-6xl items-center justify-between">
					<Link
						href={`/package/${packageId}/disenar`}
						className="flex items-center gap-1.5 text-[13px] text-[#555] hover:text-[#1a1a1a]"
					>
						<ArrowLeft className="h-4 w-4" />
						Editar diseños
					</Link>
					<p className="text-[13px] font-semibold text-[#1a1a1a]">
						Resumen del paquete
					</p>
					<div className="w-24" />
				</div>
			</header>

			<div className="mx-auto max-w-6xl px-4 py-8">
				<div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
					{/* ── LEFT: items + designs ── */}
					<div className="space-y-5">
						<div className="overflow-hidden rounded-2xl border border-[#e8e8e8] bg-white">
							<div className="border-b border-[#f0f0f0] px-6 py-4">
								<h2 className="text-[15px] font-bold text-[#1a1a1a]">
									{design.package?.name ?? "Tu paquete"}
								</h2>
								<p className="mt-0.5 text-[12px] text-[#888]">
									{totalUnits} unidad{totalUnits !== 1 ? "es" : ""} ·{" "}
									{items.length} artículo{items.length !== 1 ? "s" : ""}
								</p>
							</div>

							<div className="space-y-6 p-6">
								{items.map((item) => {
									const units = unitsByItem.get(item.id) ?? [];
									const productImage =
										[...(item.product?.images ?? [])].sort(
											(a, b) => a.order - b.order,
										)[0]?.url ?? null;
									return (
										<div key={item.id} className="space-y-3">
											<div className="flex items-center gap-3">
												{productImage && (
													// biome-ignore lint/performance/noImgElement: thumbnail remota
													<img
														src={productImage}
														alt={item.product?.name ?? ""}
														className="h-10 w-10 rounded-md object-cover"
													/>
												)}
												<div>
													<p className="text-[14px] font-semibold text-[#1a1a1a]">
														{item.product?.name}
													</p>
													<p className="text-[11px] text-[#888]">
														{item.quantity} unidad
														{item.quantity !== 1 ? "es" : ""}
													</p>
												</div>
											</div>
											<div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
												{units.map((unit) => {
													const thumb = firstSnapshot(unit.design?.snapshots);
													return (
														<div
															key={unit.id}
															className="relative overflow-hidden rounded-lg border border-[#eee] bg-[#f5f5f1]"
														>
															<div className="relative aspect-square">
																{thumb ? (
																	// biome-ignore lint/performance/noImgElement: thumbnail remota
																	<img
																		src={thumb}
																		alt={`Unidad ${unit.unitIndex + 1}`}
																		className="h-full w-full object-contain"
																	/>
																) : (
																	<div className="flex h-full items-center justify-center text-[10px] text-gray-400">
																		Sin diseño
																	</div>
																)}
																<span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white">
																	#{unit.unitIndex + 1}
																</span>
															</div>
														</div>
													);
												})}
											</div>
										</div>
									);
								})}
							</div>
						</div>
					</div>

					{/* ── RIGHT: resumen ── */}
					<div className="space-y-5">
						<div className="rounded-2xl border border-[#e8e8e8] bg-white p-6">
							<h2 className="mb-5 text-[16px] font-bold text-[#1a1a1a]">
								Resumen
							</h2>

							<div className="space-y-3">
								{items.map((item) => (
									<div
										key={item.id}
										className="flex items-start justify-between gap-3"
									>
										<p className="text-[13px] text-[#1a1a1a]">
											{item.product?.name}{" "}
											<span className="text-[#999]">× {item.quantity}</span>
										</p>
									</div>
								))}
							</div>

							<div className="my-5 border-t border-[#f0f0f0]" />

							<div className="flex items-center justify-between">
								<p className="text-[15px] font-bold text-[#1a1a1a]">Total</p>
								<p className="text-[20px] font-black text-[#1a1a1a]">
									{money(total)}
								</p>
							</div>
							<p className="mt-2 text-[11px] text-[#bbb]">
								Precio del paquete · IVA no incluido
							</p>

							{!allAssigned && (
								<div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
									<XCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
									<p className="text-[12px] text-amber-700">
										Faltan unidades por diseñar ({assignedUnits}/{totalUnits}).
									</p>
								</div>
							)}

							{checkoutState === "error" && (
								<div className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
									<XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
									<p className="text-[12px] text-red-700">{errorMsg}</p>
								</div>
							)}

							<button
								type="button"
								disabled={checkoutState === "loading" || !allAssigned}
								onClick={handleConfirm}
								className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a1a1a] py-3.5 text-[14px] font-bold text-white transition-colors hover:bg-[#333] disabled:cursor-not-allowed disabled:opacity-60"
							>
								{checkoutState === "loading" ? (
									<>
										<Loader2 className="h-4 w-4 animate-spin" />
										Confirmando pedido…
									</>
								) : (
									<>
										<ShoppingBag className="h-4 w-4" />
										Confirmar pedido
									</>
								)}
							</button>

							<p className="mt-3 text-center text-[11px] text-[#bbb]">
								Al confirmar aceptas los términos del servicio
							</p>
						</div>

						<div className="rounded-2xl border border-[#e8e8e8] bg-white p-5">
							<p className="text-[13px] font-semibold text-[#1a1a1a]">
								¿Quieres cambiar algo?
							</p>
							<p className="mt-1 text-[12px] text-[#888]">
								Vuelve al diseñador del paquete para ajustar las unidades.
							</p>
							<Link
								href={`/package/${packageId}/disenar`}
								className="mt-3 flex items-center gap-1 text-[13px] font-semibold text-[#1a1a1a] underline underline-offset-2"
							>
								<ArrowLeft className="h-3.5 w-3.5" />
								Editar diseños
							</Link>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
