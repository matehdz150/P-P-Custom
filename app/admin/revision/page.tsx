"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { EstadoProducto } from "@/lib/api/proveedores";
import {
	aprobarProducto,
	getProductosEnRevision,
	type ProductoEnRevision,
	rechazarProducto,
} from "@/lib/api/revision";

const PESTANAS: { estado: EstadoProducto; etiqueta: string }[] = [
	{ estado: "en_revision", etiqueta: "Esperando" },
	{ estado: "activo", etiqueta: "Publicados" },
	{ estado: "rechazado", etiqueta: "Regresados" },
];

export default function RevisionAdminPage() {
	const [estado, setEstado] = useState<EstadoProducto>("en_revision");
	const [productos, setProductos] = useState<ProductoEnRevision[]>([]);
	const [cargando, setCargando] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const cargar = useCallback(async (cual: EstadoProducto) => {
		setCargando(true);
		setError(null);
		try {
			setProductos(await getProductosEnRevision(cual));
		} catch (e) {
			setError(e instanceof Error ? e.message : "No se pudo cargar la lista");
			setProductos([]);
		} finally {
			setCargando(false);
		}
	}, []);

	useEffect(() => {
		cargar(estado);
	}, [estado, cargar]);

	return (
		<div className="max-w-4xl space-y-6">
			<div>
				<h1 className="text-2xl font-bold">Revisión de productos</h1>
				<p className="text-sm text-muted-foreground">
					Lo que los talleres mandaron. Aprobar lo pone en el catálogo;
					regresarlo se lo devuelve con tu nota.
				</p>
			</div>

			<div className="flex gap-2">
				{PESTANAS.map((p) => (
					<button
						key={p.estado}
						type="button"
						onClick={() => setEstado(p.estado)}
						className={`rounded-md px-3 py-1.5 text-sm ${
							estado === p.estado
								? "bg-foreground text-background"
								: "border text-muted-foreground hover:bg-muted"
						}`}
					>
						{p.etiqueta}
					</button>
				))}
			</div>

			{error && <p className="text-sm text-red-600">{error}</p>}

			{cargando ? (
				<p className="text-sm text-muted-foreground">Cargando…</p>
			) : productos.length === 0 ? (
				<p className="rounded-lg border p-6 text-sm text-muted-foreground">
					{estado === "en_revision"
						? "No hay nada esperando revisión."
						: "Nada por aquí."}
				</p>
			) : (
				<div className="space-y-4">
					{productos.map((p) => (
						<Tarjeta
							key={p.id}
							producto={p}
							onResuelto={() => cargar(estado)}
						/>
					))}
				</div>
			)}
		</div>
	);
}

function Tarjeta({
	producto,
	onResuelto,
}: {
	producto: ProductoEnRevision;
	onResuelto: () => void;
}) {
	const [nota, setNota] = useState("");
	const [escribiendoNota, setEscribiendoNota] = useState(false);
	const [ocupado, setOcupado] = useState(false);
	const [fallo, setFallo] = useState<string | null>(null);

	const pendiente = producto.estado === "en_revision";

	async function resolver(accion: () => Promise<unknown>) {
		setOcupado(true);
		setFallo(null);
		try {
			await accion();
			onResuelto();
		} catch (e) {
			// El 409 llega cuando alguien más lo resolvió o el taller lo movió:
			// el mensaje de la Lambda ya lo explica, y recargar lo resuelve.
			setFallo(e instanceof Error ? e.message : "No se pudo guardar");
			setOcupado(false);
		}
	}

	return (
		<div className="flex gap-4 rounded-lg border bg-background p-4">
			<div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
				{producto.images?.[0]?.url ? (
					<Image
						src={producto.images[0].url}
						alt=""
						width={96}
						height={96}
						className="h-full w-full object-cover"
					/>
				) : (
					<span className="text-xs text-muted-foreground">sin foto</span>
				)}
			</div>

			<div className="flex min-w-0 flex-1 flex-col gap-2">
				<div>
					<p className="font-semibold">{producto.name}</p>
					<p className="text-sm text-muted-foreground">
						{producto.proveedorNombre} · ${producto.pricing?.basePrice} ·{" "}
						{producto.templateId}
					</p>
				</div>

				<p className="text-sm text-muted-foreground">
					{producto.sizes?.length ?? 0} tallas · {producto.colors?.length ?? 0}{" "}
					colores · {producto.printSides?.length ?? 0} lados ·{" "}
					{producto.images?.length ?? 0} fotos
				</p>

				{producto.description && (
					<p className="line-clamp-2 text-sm">{producto.description}</p>
				)}

				{producto.notaRevision && (
					<p className="rounded-md bg-muted px-3 py-2 text-sm">
						<span className="font-medium">Se regresó con esta nota:</span>{" "}
						{producto.notaRevision}
					</p>
				)}

				{fallo && <p className="text-sm text-red-600">{fallo}</p>}

				{pendiente &&
					(escribiendoNota ? (
						<div className="space-y-2">
							<Textarea
								autoFocus
								placeholder="Qué tiene que corregir el taller. Es lo único que va a ver."
								value={nota}
								onChange={(e) => setNota(e.target.value)}
							/>
							<div className="flex gap-2">
								<Button
									size="sm"
									variant="destructive"
									disabled={ocupado || nota.trim().length === 0}
									onClick={() =>
										resolver(() => rechazarProducto(producto.id, nota.trim()))
									}
								>
									{ocupado ? "Enviando…" : "Regresar al taller"}
								</Button>
								<Button
									size="sm"
									variant="ghost"
									disabled={ocupado}
									onClick={() => setEscribiendoNota(false)}
								>
									Cancelar
								</Button>
							</div>
						</div>
					) : (
						<div className="flex gap-2 pt-1">
							<Button
								size="sm"
								disabled={ocupado}
								onClick={() => resolver(() => aprobarProducto(producto.id))}
							>
								{ocupado ? "Guardando…" : "Aprobar y publicar"}
							</Button>
							<Button
								size="sm"
								variant="outline"
								disabled={ocupado}
								onClick={() => setEscribiendoNota(true)}
							>
								Regresar con nota
							</Button>
						</div>
					))}
			</div>
		</div>
	);
}
