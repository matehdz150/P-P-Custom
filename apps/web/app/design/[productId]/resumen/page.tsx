"use client";

import { ArrowLeft, ChevronRight, Package, ShoppingBag } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { use, useEffect, useState } from "react";

type PriceLine = { label: string; detail: string; amount: number };

type OrderSummary = {
	productId: string;
	productName: string;
	productImage: string | null;
	mockups: Record<string, string>;
	snapshots: Record<string, string>;
	sides: string[];
	sideLabels: Record<string, string>;
	pricingLines: PriceLine[];
	total: number;
};

function money(n: number) {
	return new Intl.NumberFormat("es-MX", {
		style: "currency",
		currency: "MXN",
		maximumFractionDigits: 2,
	}).format(n);
}

export default function OrderSummaryPage({
	params,
}: {
	params: Promise<{ productId: string }>;
}) {
	const { productId } = use(params);
	const [summary, setSummary] = useState<OrderSummary | null>(null);
	const [activeSide, setActiveSide] = useState<string>("");

	useEffect(() => {
		const raw = sessionStorage.getItem("designer_order_summary");
		if (!raw) return;
		try {
			const data: OrderSummary = JSON.parse(raw);
			setSummary(data);
			setActiveSide(data.sides[0] ?? "");
		} catch {
			// malformed — ignore
		}
	}, []);

	if (!summary) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-white">
				<div className="text-center">
					<Package className="mx-auto h-12 w-12 text-[#ccc]" />
					<p className="mt-4 text-[15px] font-semibold text-[#1a1a1a]">No hay resumen disponible</p>
					<Link
						href={`/design/${productId}`}
						className="mt-4 inline-flex items-center gap-1.5 text-sm text-[#555] underline"
					>
						<ArrowLeft className="h-4 w-4" /> Volver al diseñador
					</Link>
				</div>
			</div>
		);
	}

	const sideLabel = (s: string) =>
		summary.sideLabels?.[s] ?? (s === "front" ? "Frente" : s === "back" ? "Espalda" : s);

	const activeSnapshot = summary.snapshots[activeSide];
	const activeMockup = summary.mockups[activeSide];

	return (
		<div className="min-h-screen bg-[#f7f7f5]">
			{/* Nav */}
			<header className="sticky top-0 z-20 border-b border-[#e8e8e8] bg-white px-6 py-4">
				<div className="mx-auto flex max-w-6xl items-center justify-between">
					<Link
						href={`/design/${productId}`}
						className="flex items-center gap-1.5 text-[13px] text-[#555] hover:text-[#1a1a1a]"
					>
						<ArrowLeft className="h-4 w-4" />
						Editar diseño
					</Link>
					<p className="text-[13px] font-semibold text-[#1a1a1a]">Resumen del pedido</p>
					<div className="w-24" />
				</div>
			</header>

			<div className="mx-auto max-w-6xl px-4 py-8">
				<div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">

					{/* ── LEFT: product + design ── */}
					<div className="space-y-5">
						{/* Product card */}
						<div className="overflow-hidden rounded-2xl border border-[#e8e8e8] bg-white">
							<div className="border-b border-[#f0f0f0] px-6 py-4">
								<h2 className="text-[15px] font-bold text-[#1a1a1a]">Tu producto</h2>
							</div>

							<div className="p-6">
								<div className="flex items-start gap-5">
									{/* Product image */}
									<div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-[#f3f3f1]">
										{summary.productImage ? (
											<Image
												src={summary.productImage}
												alt={summary.productName}
												fill
												className="object-cover"
												sizes="112px"
											/>
										) : (
											<div className="flex h-full items-center justify-center">
												<Package className="h-8 w-8 text-[#ccc]" />
											</div>
										)}
									</div>

									{/* Info */}
									<div className="flex-1">
										<p className="text-[16px] font-bold text-[#1a1a1a]">{summary.productName}</p>
										<p className="mt-1 text-[13px] text-[#888]">Producto personalizado</p>

										{/* Side selector */}
										{summary.sides.length > 1 && (
											<div className="mt-3 flex gap-2">
												{summary.sides.map((s) => (
													<button
														key={s}
														type="button"
														onClick={() => setActiveSide(s)}
														className={`rounded-full px-3 py-1 text-[12px] font-semibold transition-colors ${
															activeSide === s
																? "bg-[#1a1a1a] text-white"
																: "bg-[#f3f3f1] text-[#555] hover:bg-[#e8e8e8]"
														}`}
													>
														{sideLabel(s)}
													</button>
												))}
											</div>
										)}
									</div>
								</div>
							</div>
						</div>

						{/* Design preview */}
						<div className="overflow-hidden rounded-2xl border border-[#e8e8e8] bg-white">
							<div className="border-b border-[#f0f0f0] px-6 py-4">
								<h2 className="text-[15px] font-bold text-[#1a1a1a]">
									Vista previa del diseño
									{summary.sides.length > 1 && (
										<span className="ml-2 text-[13px] font-normal text-[#888]">— {sideLabel(activeSide)}</span>
									)}
								</h2>
							</div>

							<div className="p-6">
								{/* Main preview: design only (cropped to editable area) */}
								<div className="relative mx-auto aspect-square max-w-sm overflow-hidden rounded-xl bg-[#f3f3f1]">
									{activeSnapshot && (
										<Image
											src={activeSnapshot}
											alt="Diseño"
											fill
											className="object-contain"
											sizes="400px"
										/>
									)}
								</div>

								{/* Thumbnail strip if multiple sides */}
								{summary.sides.length > 1 && (
									<div className="mt-4 flex justify-center gap-3">
										{summary.sides.map((s) => (
											<button
												key={s}
												type="button"
												onClick={() => setActiveSide(s)}
												className={`relative h-16 w-16 overflow-hidden rounded-lg border-2 bg-[#e8e8e8] transition-colors ${
													activeSide === s ? "border-[#1a1a1a]" : "border-transparent hover:border-[#ccc]"
												}`}
											>
												{summary.snapshots[s] && (
													<Image src={summary.snapshots[s]} alt="design" fill className="object-contain" sizes="64px" />
												)}
												<span className="absolute bottom-0 left-0 right-0 bg-black/40 py-0.5 text-center text-[9px] font-semibold text-white">
													{sideLabel(s)}
												</span>
											</button>
										))}
									</div>
								)}
							</div>
						</div>
					</div>

					{/* ── RIGHT: summary ── */}
					<div className="space-y-5">
						<div className="rounded-2xl border border-[#e8e8e8] bg-white p-6">
							<h2 className="mb-5 text-[16px] font-bold text-[#1a1a1a]">Resumen</h2>

							{/* Price lines */}
							<div className="space-y-3">
								{summary.pricingLines.map((line) => (
									<div key={line.label} className="flex items-start justify-between gap-3">
										<div>
											<p className="text-[13px] text-[#1a1a1a]">{line.label}</p>
											{line.detail && (
												<p className="text-[11px] text-[#999]">{line.detail}</p>
											)}
										</div>
										<p className="shrink-0 text-[13px] font-semibold text-[#1a1a1a]">
											{money(line.amount)}
										</p>
									</div>
								))}
							</div>

							<div className="my-5 border-t border-[#f0f0f0]" />

							{/* Total */}
							<div className="flex items-center justify-between">
								<p className="text-[15px] font-bold text-[#1a1a1a]">Total</p>
								<p className="text-[20px] font-black text-[#1a1a1a]">{money(summary.total)}</p>
							</div>

							<p className="mt-2 text-[11px] text-[#bbb]">Precio estimado · IVA no incluido</p>

							{/* CTA */}
							<button
								type="button"
								className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a1a1a] py-3.5 text-[14px] font-bold text-white hover:bg-[#333] transition-colors"
							>
								<ShoppingBag className="h-4 w-4" />
								Confirmar pedido
							</button>

							<p className="mt-3 text-center text-[11px] text-[#bbb]">
								Al confirmar aceptas los términos del servicio
							</p>
						</div>

						{/* Edit link */}
						<div className="rounded-2xl border border-[#e8e8e8] bg-white p-5">
							<p className="text-[13px] font-semibold text-[#1a1a1a]">¿Quieres cambiar algo?</p>
							<p className="mt-1 text-[12px] text-[#888]">Puedes volver al diseñador y seguir editando tu producto.</p>
							<Link
								href={`/design/${productId}`}
								className="mt-3 flex items-center gap-1 text-[13px] font-semibold text-[#1a1a1a] underline underline-offset-2"
							>
								<ArrowLeft className="h-3.5 w-3.5" />
								Editar diseño
							</Link>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
