"use client";

import {
	ArrowRight,
	CheckCircle,
	Edit3,
	FolderOpen,
	History,
	Trash2,
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

export default function DashboardPage() {
	const { user, loading: authLoading } = useAuth();
	const router = useRouter();

	const [designs, setDesigns] = useState<UserDesign[]>([]);
	const [loading, setLoading] = useState(true);
	const [deletingId, setDeletingId] = useState<string | null>(null);

	// Redirigir a login si no está autenticado
	useEffect(() => {
		if (!authLoading && !user) {
			router.push("/login");
		}
	}, [user, authLoading, router]);

	// Cargar diseños del usuario
	useEffect(() => {
		if (user) {
			setLoading(true);
			getUserDesigns()
				.then(setDesigns)
				.catch((err) => console.error("Error cargando diseños:", err))
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
						<div className="w-12 h-12 bg-[#fe6241]/20 rounded-full border-2 border-[#fe6241]/35 animate-spin"></div>
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

	return (
		<div className="min-h-screen bg-[#f5f5f1] flex flex-col font-sans">
			<Header />

			<main className="flex-grow max-w-7xl w-full mx-auto px-6 py-10 space-y-12">
				{/* HEADER DE BIENVENIDA */}
				<section className="bg-gradient-to-r from-[#1a1a1a] to-[#3a3a3a] text-white rounded-2xl p-8 shadow-xl relative overflow-hidden flex flex-col justify-center min-h-[160px]">
					<div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-64 h-64 bg-[#fe6241]/10 rounded-full blur-3xl pointer-events-none"></div>
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
