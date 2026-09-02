"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
	ETIQUETA_ESTADO_PRODUCTO,
	misProductos,
	type ProductoDeTaller,
} from "@/lib/api/proveedores";

export default function MisProductosPage() {
	const [productos, setProductos] = useState<ProductoDeTaller[]>([]);
	const [cargando, setCargando] = useState(true);

	useEffect(() => {
		misProductos()
			.then(setProductos)
			.catch(() => setProductos([]))
			.finally(() => setCargando(false));
	}, []);

	return (
		<div className="flex flex-col">
			<div className="flex items-center justify-between gap-6">
				<h1 className="font-display text-[30px] font-semibold leading-[38px] tracking-[-0.032em] text-tinta">
					Mis productos
				</h1>
				<Link
					href="/proveedor/productos/nuevo"
					className="flex h-[46px] items-center gap-2.5 rounded-lg bg-tinta px-5 text-[15px] font-semibold text-lima"
				>
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						aria-hidden="true"
					>
						<path
							d="M12 5v14M5 12h14"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
						/>
					</svg>
					Nuevo producto
				</Link>
			</div>

			{cargando ? (
				<p className="pt-8 text-[15px] text-tinta/60">Cargando…</p>
			) : productos.length === 0 ? (
				<div className="mt-7 flex flex-col items-start gap-3 rounded-xl border border-tinta/12 bg-hueso px-8 py-12">
					<h2 className="font-display text-[22px] font-semibold leading-7 tracking-[-0.032em] text-tinta">
						Todavía no publicas nada
					</h2>
					<p className="max-w-[520px] text-[15px] leading-[26px] text-tinta/70">
						Da de alta tu primer producto con sus colores, tallas y lados de
						impresión. Cuando lo mandes a revisión lo aprobamos y entra al
						catálogo.
					</p>
					<Link
						href="/proveedor/productos/nuevo"
						className="mt-2 flex h-12 items-center rounded-lg border-[1.5px] border-tinta px-5 text-[15px] font-semibold text-tinta"
					>
						Dar de alta un producto
					</Link>
				</div>
			) : (
				<>
					<div className="flex flex-col pt-7">
						<div className="flex items-center gap-5 pb-[11px]">
							<Columna className="flex-1">PRODUCTO</Columna>
							<Columna className="w-[160px]">TÉCNICA</Columna>
							<Columna className="w-[110px]">PRECIO BASE</Columna>
							<Columna className="w-[110px]">ESTADO</Columna>
						</div>

						{productos.map((p) => (
							// La fila entera lleva a editar: cuando un producto vuelve
							// rechazado, corregirlo es lo único que el taller quiere hacer.
							<Link
								key={p.id}
								href={`/proveedor/productos/editar?id=${p.id}`}
								className="flex items-center gap-5 border-t border-tinta/12 py-3.5 transition-colors hover:bg-hueso"
							>
								<div className="flex flex-1 items-center gap-3.5">
									<div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-lg bg-gris">
										{p.images?.[0]?.url ? (
											<Image
												src={p.images[0].url}
												alt=""
												width={80}
												height={100}
												className="max-h-[84%] w-auto max-w-[74%] object-contain"
											/>
										) : null}
									</div>
									<div className="flex min-w-0 flex-col gap-[3px]">
										<span className="truncate text-[15px] font-semibold text-tinta">
											{p.name}
										</span>
										{/* Si lo regresaron, el motivo pesa más que la dirección:
										    es lo único que le dice al taller qué corregir. */}
										{p.estado === "rechazado" && p.notaRevision ? (
											<span className="truncate text-xs text-[#c0392b]">
												{p.notaRevision}
											</span>
										) : (
											<span className="font-mono truncate text-xs text-tinta/55">
												{p.slug}
											</span>
										)}
									</div>
								</div>

								<span className="w-[160px] text-sm text-tinta">—</span>
								<span className="font-mono w-[110px] text-sm text-tinta">
									{p.pricing ? `$${p.pricing.basePrice}` : "—"}
								</span>
								<span className="w-[110px]">
									<span
										className={`inline-flex rounded-lg px-3 py-[5px] text-xs font-semibold ${
											p.estado === "activo"
												? "bg-lima text-tinta"
												: p.estado === "rechazado"
													? "border-[1.5px] border-[rgba(192,57,43,0.4)] text-[#c0392b]"
													: "border-[1.5px] border-tinta/20 text-tinta"
										}`}
									>
										{ETIQUETA_ESTADO_PRODUCTO[p.estado] ?? p.estado}
									</span>
								</span>
							</Link>
						))}

						<div className="border-t border-tinta/12" />
					</div>

					<span className="pt-4 text-[13px] text-tinta/55">
						Un producto entra al catálogo cuando lo mandas a revisión y lo
						aprobamos. Si le cambias algo después, vuelve a revisión.
					</span>
				</>
			)}
		</div>
	);
}

function Columna({
	children,
	className,
}: {
	children: string;
	className?: string;
}) {
	return (
		<span
			className={`font-mono text-[11px] tracking-[0.7px] text-tinta/50 ${className ?? ""}`}
		>
			{children}
		</span>
	);
}
