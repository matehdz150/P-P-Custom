"use client";

import {
	ArrowRight,
	CheckCircle,
	CheckCircle2,
	Clock,
	Edit3,
	FolderOpen,
	History,
	Package,
	PackageCheck,
	ShoppingBag,
	Trash2,
	Truck,
	X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/Contexts/AuthContext";
import { Header } from "@/components/Header/Header";
import {
	deleteUserDesign,
	getUserDesigns,
	type UserDesign,
} from "@/lib/api/user-designs";
import { getMyOrders, type Order, type OrderStatus } from "@/lib/api/orders";

// ---- Configuración de estados ----
const STATUS_CONFIG: Record<
	OrderStatus,
	{
		label: string;
		color: string;
		bg: string;
		border: string;
		icon: React.ComponentType<{ className?: string }>;
		step: number; // para la barra de progreso (0-4)
	}
> = {
	pending: {
		label: "Pendiente",
		color: "text-amber-700",
		bg: "bg-amber-50",
		border: "border-amber-200",
		icon: Clock,
		step: 0,
	},
	confirmed: {
		label: "Confirmado",
		color: "text-blue-700",
		bg: "bg-blue-50",
		border: "border-blue-200",
		icon: CheckCircle2,
		step: 1,
	},
	in_production: {
		label: "En producción",
		color: "text-violet-700",
		bg: "bg-violet-50",
		border: "border-violet-200",
		icon: Package,
		step: 2,
	},
	shipped: {
		label: "Enviado",
		color: "text-sky-700",
		bg: "bg-sky-50",
		border: "border-sky-200",
		icon: Truck,
		step: 3,
	},
	delivered: {
		label: "Entregado",
		color: "text-emerald-700",
		bg: "bg-emerald-50",
		border: "border-emerald-200",
		icon: PackageCheck,
		step: 4,
	},
	cancelled: {
		label: "Cancelado",
		color: "text-red-700",
		bg: "bg-red-50",
		border: "border-red-200",
		icon: X,
		step: -1,
	},
};

// Pasos del progreso (excluyendo cancelled)
const PROGRESS_STEPS: OrderStatus[] = [
	"pending",
	"confirmed",
	"in_production",
	"shipped",
	"delivered",
];

export default function DashboardPage() {
	const { user, loading: authLoading } = useAuth();
	const router = useRouter();

	const [designs, setDesigns] = useState<UserDesign[]>([]);
	const [orders, setOrders] = useState<Order[]>([]);
	const [loading, setLoading] = useState(true);
	const [deletingId, setDeletingId] = useState<string | null>(null);

	// Redirigir a login si no está autenticado
	useEffect(() => {
		if (!authLoading && !user) {
			router.push("/login");
		}
	}, [user, authLoading, router]);

	// Cargar diseños y pedidos del usuario
	useEffect(() => {
		if (user) {
			setLoading(true);
			Promise.all([
				getUserDesigns().catch(() => [] as UserDesign[]),
				getMyOrders().catch(() => [] as Order[]),
			])
				.then(([d, o]) => {
					setDesigns(d);
					setOrders(o);
				})
				.finally(() => setLoading(false));
		}
	}, [user]);

	const handleDelete = async (id: string) => {
		if (!confirm("¿Estás seguro de que deseas eliminar este diseño?")) return;
		setDeletingId(id);
		try {
			await deleteUserDesign(id);
			setDesigns((prev) => prev.filter((d) => d.id !== id));
		} catch (err) {
			console.error("Error al eliminar diseño:", err);
			alert("Hubo un error al eliminar el diseño.");
		} finally {
			setDeletingId(null);
		}
	};

	if (authLoading || loading) {
		return (
			<div className="min-h-screen bg-[#f5f5f1] flex flex-col">
				<Header />
				<div className="flex-1 flex items-center justify-center">
					<div className="animate-pulse flex flex-col items-center space-y-4">
						<div className="w-12 h-12 bg-[#fe6241]/20 rounded-full border-2 border-[#fe6241]/35 animate-spin" />
						<p className="text-sm font-bold text-gray-500 font-sora">
							Cargando tu panel de control…
						</p>
					</div>
				</div>
			</div>
		);
	}

	const drafts = designs.filter((d) => d.status === "draft");
	const completed = designs.filter((d) => d.status === "completed");
	const activeOrders = orders.filter((o) => o.status !== "cancelled");
	const cancelledOrders = orders.filter((o) => o.status === "cancelled");

	return (
		<div className="min-h-screen bg-[#f5f5f1] flex flex-col font-sans">
			<Header />

			<main className="flex-grow max-w-7xl w-full mx-auto px-6 py-10 space-y-12">
				{/* HEADER DE BIENVENIDA */}
				<section className="bg-gradient-to-r from-[#1a1a1a] to-[#3a3a3a] text-white rounded-2xl p-8 shadow-xl relative overflow-hidden flex flex-col justify-center min-h-[160px]">
					<div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-64 h-64 bg-[#fe6241]/10 rounded-full blur-3xl pointer-events-none" />
					<div className="relative space-y-2">
						<h1 className="text-3xl font-black tracking-tight font-sora">
							¡Hola, {user?.name || user?.email.split("@")[0]}!
						</h1>
						<p className="text-gray-300 text-sm max-w-lg">
							Bienvenido a tu panel de personalización. Aquí puedes continuar
							tus borradores guardados automáticamente o revisar tus diseños
							listos para ordenar.
						</p>
					</div>
				</section>

				{/* ── MIS PEDIDOS ── */}
				<section className="space-y-6">
					<div className="flex items-center gap-2 pb-2 border-b-2 border-gray-200">
						<ShoppingBag className="text-[#fe6241] w-5 h-5" />
						<h2 className="text-xl font-black text-gray-900 tracking-tight font-sora">
							Mis Pedidos ({orders.length})
						</h2>
					</div>

					{orders.length === 0 ? (
						<div className="bg-white rounded-xl border border-gray-200 p-8 text-center space-y-4 shadow-sm">
							<ShoppingBag className="text-gray-300 w-12 h-12 mx-auto" />
							<div className="space-y-1">
								<p className="text-base font-bold text-gray-700">
									Aún no tienes pedidos
								</p>
								<p className="text-xs text-gray-500">
									Cuando confirmes un pedido desde el diseñador aparecerá aquí con su estado en tiempo real.
								</p>
							</div>
							<Link
								href="/catalogo"
								className="inline-flex items-center bg-[#fe6241] hover:bg-[#e5573a] text-white font-bold text-xs px-5 py-2.5 rounded-lg transition-all shadow-sm"
							>
								Ir al Catálogo <ArrowRight size={14} className="ml-1.5" />
							</Link>
						</div>
					) : (
						<div className="space-y-4">
							{activeOrders.map((order) => (
								<OrderCard key={order.id} order={order} />
							))}
							{cancelledOrders.length > 0 && (
								<details className="group">
									<summary className="cursor-pointer text-[12px] font-semibold text-gray-400 hover:text-gray-600 list-none flex items-center gap-1.5 select-none">
										<span className="transition-transform group-open:rotate-90">▶</span>
										{cancelledOrders.length} pedido{cancelledOrders.length !== 1 ? "s" : ""} cancelado{cancelledOrders.length !== 1 ? "s" : ""}
									</summary>
									<div className="mt-3 space-y-3 opacity-60">
										{cancelledOrders.map((order) => (
											<OrderCard key={order.id} order={order} />
										))}
									</div>
								</details>
							)}
						</div>
					)}
				</section>

				{/* BORRADORES */}
				<section className="space-y-6">
					<div className="flex items-center gap-2 pb-2 border-b-2 border-gray-200">
						<FolderOpen className="text-[#fe6241] w-5 h-5" />
						<h2 className="text-xl font-black text-gray-900 tracking-tight font-sora">
							Borradores en Progreso ({drafts.length})
						</h2>
					</div>

					{drafts.length === 0 ? (
						<div className="bg-white rounded-xl border border-gray-200 p-8 text-center space-y-4 shadow-sm">
							<History className="text-gray-400 w-12 h-12 mx-auto" />
							<div className="space-y-1">
								<p className="text-base font-bold text-gray-700">
									No tienes borradores activos
								</p>
								<p className="text-xs text-gray-500">
									Todo tu progreso en el editor se guarda de manera automática
									aquí.
								</p>
							</div>
							<Link
								href="/catalogo"
								className="inline-flex items-center bg-[#fe6241] hover:bg-[#e5573a] text-white font-bold text-xs px-5 py-2.5 rounded-lg transition-all shadow-sm"
							>
								Ir al Catálogo <ArrowRight size={14} className="ml-1.5" />
							</Link>
						</div>
					) : (
						<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
							{drafts.map((design) => {
								const snapshotUrl =
									design.snapshots?.front || design.snapshots?.back || null;
								const productImage = design.product?.images?.[0]?.url || null;

								return (
									<div
										key={design.id}
										className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow group"
									>
										{/* PREVIEW CONTAINER */}
										<div className="relative aspect-4/3 bg-[#f2f3ea] flex items-center justify-center p-4 border-b">
											{snapshotUrl ? (
												<img
													src={snapshotUrl}
													alt={design.name || "Borrador"}
													className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
												/>
											) : productImage ? (
												<div className="relative w-full h-full opacity-60">
													<img
														src={productImage}
														alt="Producto base"
														className="w-full h-full object-contain filter grayscale"
													/>
													<div className="absolute inset-0 flex items-center justify-center">
														<span className="bg-black/50 text-white text-[10px] font-bold px-2 py-1 rounded">
															Boceto sin previsualización
														</span>
													</div>
												</div>
											) : (
												<span className="text-xs text-gray-400">
													Sin vista previa
												</span>
											)}
											<span className="absolute top-3 left-3 bg-[#fe6241]/10 border border-[#fe6241]/25 text-[#fe6241] text-[10px] font-black uppercase px-2 py-0.5 rounded-md">
												Borrador
											</span>
										</div>

										{/* CARD INFO */}
										<div className="p-5 flex-grow flex flex-col justify-between space-y-4">
											<div className="space-y-1">
												<h3 className="font-bold text-gray-900 line-clamp-1 text-sm font-sora">
													{design.name || "Diseño sin nombre"}
												</h3>
												<p className="text-[11px] text-gray-400">
													Producto:{" "}
													<span className="font-medium text-gray-600">
														{design.product?.name || "No especificado"}
													</span>
												</p>
												<p className="text-[10px] text-gray-400">
													Editado:{" "}
													{new Date(design.updatedAt).toLocaleDateString()}{" "}
													{new Date(design.updatedAt).toLocaleTimeString([], {
														hour: "2-digit",
														minute: "2-digit",
													})}
												</p>
											</div>

											{/* CARD ACTIONS */}
											<div className="flex gap-2 pt-2 border-t border-gray-100">
												<button
													type="button"
													onClick={() =>
														router.push(
															`/design/${design.productId}?draftId=${design.id}`,
														)
													}
													className="flex-grow flex items-center justify-center gap-1.5 bg-[#1a1a1a] hover:bg-[#333] text-white text-xs font-bold py-2 rounded-lg transition-colors cursor-pointer"
												>
													<Edit3 size={13} />
													Retomar
												</button>
												<button
													type="button"
													disabled={deletingId === design.id}
													onClick={() => handleDelete(design.id)}
													className="px-3 border border-red-200 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50 cursor-pointer"
													title="Eliminar borrador"
												>
													<Trash2 size={13} />
												</button>
											</div>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</section>

				{/* COMPLETADOS */}
				<section className="space-y-6">
					<div className="flex items-center gap-2 pb-2 border-b-2 border-gray-200">
						<CheckCircle className="text-green-600 w-5 h-5" />
						<h2 className="text-xl font-black text-gray-900 tracking-tight font-sora">
							Diseños Listos ({completed.length})
						</h2>
					</div>

					{completed.length === 0 ? (
						<div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500 shadow-sm text-sm">
							No tienes diseños completados listos. Completa tu diseño en el
							editor para que aparezca aquí.
						</div>
					) : (
						<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
							{completed.map((design) => {
								const snapshotUrl =
									design.snapshots?.front || design.snapshots?.back || null;

								return (
									<div
										key={design.id}
										className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col shadow-sm"
									>
										<div className="relative aspect-4/3 bg-[#f2f3ea] flex items-center justify-center p-4 border-b">
											{snapshotUrl ? (
												<img
													src={snapshotUrl}
													alt={design.name || "Diseño Listo"}
													className="w-full h-full object-contain"
												/>
											) : (
												<span className="text-xs text-gray-400">
													Sin vista previa
												</span>
											)}
											<span className="absolute top-3 left-3 bg-green-50 border border-green-200 text-green-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-md">
												Listo
											</span>
										</div>

										<div className="p-5 space-y-4">
											<div className="space-y-1">
												<h3 className="font-bold text-gray-900 line-clamp-1 text-sm font-sora">
													{design.name || "Diseño sin nombre"}
												</h3>
												<p className="text-[11px] text-gray-400">
													Producto:{" "}
													<span className="font-medium text-gray-600">
														{design.product?.name || "No especificado"}
													</span>
												</p>
												<p className="text-[10px] text-gray-400">
													Finalizado:{" "}
													{new Date(design.updatedAt).toLocaleDateString()}
												</p>
											</div>

											<div className="flex gap-2 pt-2 border-t border-gray-100">
												<button
													type="button"
													onClick={() =>
														router.push(
															`/design/${design.productId}?draftId=${design.id}`,
														)
													}
													className="flex-grow flex items-center justify-center gap-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-bold py-2 rounded-lg transition-colors cursor-pointer"
												>
													<Edit3 size={13} />
													Editar copia
												</button>
												<button
													type="button"
													disabled={deletingId === design.id}
													onClick={() => handleDelete(design.id)}
													className="px-3 border border-red-200 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50 cursor-pointer"
													title="Eliminar diseño"
												>
													<Trash2 size={13} />
												</button>
											</div>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</section>
			</main>
		</div>
	);
}

// ── Tarjeta de pedido con barra de progreso ──
function OrderCard({ order }: { order: Order }) {
	const cfg = STATUS_CONFIG[order.status];
	const Icon = cfg.icon;
	const isCancelled = order.status === "cancelled";
	const img = order.product?.images?.[0]?.url;

	const date = new Date(order.createdAt).toLocaleDateString("es-MX", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	});

	return (
		<div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
			<div className="flex items-start gap-4 p-5">
				{/* Thumbnail */}
				<div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[#f5f5f3]">
					{img ? (
						<img
							src={img}
							alt={order.product?.name ?? ""}
							className="h-full w-full object-cover"
						/>
					) : (
						<div className="flex h-full items-center justify-center">
							<Package className="h-7 w-7 text-[#ccc]" />
						</div>
					)}
				</div>

				{/* Info */}
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-start justify-between gap-2">
						<div>
							<p className="font-bold text-[13px] text-gray-900 leading-tight">
								{order.product?.name ?? "Producto personalizado"}
							</p>
							<p className="text-[11px] text-gray-400 mt-0.5">
								{order.quantity} unidad{order.quantity !== 1 ? "es" : ""} · {date}
							</p>
						</div>

						{/* Status badge */}
						<span
							className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold border ${cfg.color} ${cfg.bg} ${cfg.border}`}
						>
							<Icon className="h-3 w-3" />
							{cfg.label}
						</span>
					</div>

					{/* Precio */}
					{order.totalPrice && (
						<p className="mt-1.5 text-[13px] font-black text-gray-900">
							${order.totalPrice}{" "}
							<span className="font-normal text-gray-400 text-[11px]">MXN</span>
						</p>
					)}

					{/* Nota del proveedor */}
					{order.providerNote && (
						<p className="mt-1.5 text-[11px] text-gray-500 italic">
							Proveedor: &ldquo;{order.providerNote}&rdquo;
						</p>
					)}
				</div>
			</div>

			{/* Barra de progreso — solo para pedidos activos */}
			{!isCancelled && (
				<div className="px-5 pb-5">
					<div className="flex items-center gap-0">
						{PROGRESS_STEPS.map((step, idx) => {
							const stepCfg = STATUS_CONFIG[step];
							const StepIcon = stepCfg.icon;
							const currentStep = STATUS_CONFIG[order.status].step;
							const isCompleted = idx < currentStep;
							const isActive = idx === currentStep;

							return (
								<div key={step} className="flex items-center flex-1">
									{/* Dot */}
									<div className="flex flex-col items-center">
										<div
											className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all ${
												isCompleted
													? "bg-[#1a1a1a] border-[#1a1a1a]"
													: isActive
														? `${cfg.bg} ${cfg.border} border-2`
														: "bg-white border-gray-200"
											}`}
										>
											<StepIcon
												className={`h-3.5 w-3.5 ${
													isCompleted
														? "text-white"
														: isActive
															? cfg.color
															: "text-gray-300"
												}`}
											/>
										</div>
										<span
											className={`mt-1 text-[9px] font-semibold hidden sm:block ${
												isActive ? cfg.color : isCompleted ? "text-gray-500" : "text-gray-300"
											}`}
										>
											{stepCfg.label}
										</span>
									</div>

									{/* Conector */}
									{idx < PROGRESS_STEPS.length - 1 && (
										<div
											className={`flex-1 h-0.5 mx-1 transition-colors ${
												idx < currentStep ? "bg-[#1a1a1a]" : "bg-gray-200"
											}`}
										/>
									)}
								</div>
							);
						})}
					</div>
				</div>
			)}

			{/* Historial colapsable */}
			{order.statusHistory && order.statusHistory.length > 0 && (
				<details className="border-t border-gray-100">
					<summary className="cursor-pointer px-5 py-2.5 text-[11px] font-semibold text-gray-400 hover:text-gray-600 list-none flex items-center gap-1 select-none">
						<span className="transition-transform group-open:rotate-90">▶</span>
						Ver historial de estados
					</summary>
					<div className="px-5 pb-4 space-y-2">
						{order.statusHistory.map((h) => {
							const toCfg = STATUS_CONFIG[h.toStatus];
							const ToIcon = toCfg.icon;
							return (
								<div key={h.id} className="flex items-start gap-2 text-[11px]">
									<div
										className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${toCfg.bg}`}
									>
										<ToIcon className={`h-3 w-3 ${toCfg.color}`} />
									</div>
									<div>
										<p className="font-semibold text-gray-700">
											{h.fromStatus
												? `${STATUS_CONFIG[h.fromStatus].label} → ${toCfg.label}`
												: toCfg.label}
										</p>
										{h.note && (
											<p className="text-gray-500">&ldquo;{h.note}&rdquo;</p>
										)}
										<p className="text-gray-400">
											{new Date(h.createdAt).toLocaleString("es-MX")}
										</p>
									</div>
								</div>
							);
						})}
					</div>
				</details>
			)}
		</div>
	);
}
