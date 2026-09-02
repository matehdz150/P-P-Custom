"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import {
	crearPedido,
	enlaceDeSeguimiento,
	subirArte,
} from "@/lib/api/pedir";
import type { DesignerProductTemplate } from "@/lib/api/products";
import {
	type ArteDeLado,
	exportarArteDeLado,
} from "@/lib/designer/exportarArte";

/**
 * La salida del editor: de un diseño terminado a un pedido.
 *
 * Aquí es donde el arte se convierte en archivos de producción. El diseño se
 * exporta lado por lado en el momento de mandar, no antes: mientras el
 * cliente siga tocando el lienzo, cualquier archivo ya generado estaría
 * viejo.
 */
export default function PanelPedido({
	producto,
	onCerrar,
}: {
	producto: DesignerProductTemplate;
	onCerrar: () => void;
}) {
	const router = useRouter();
	const { sides, colorPrenda } = useDesigner();

	const tallas = producto.sizes?.length
		? producto.sizes.map((t) => t.size)
		: ["S", "M", "L", "XL"];

	const [cantidades, setCantidades] = useState<Record<string, number>>({});
	const [comprador, setComprador] = useState({
		nombre: "",
		email: "",
		whatsapp: "",
		notas: "",
	});
	const [enviando, setEnviando] = useState(false);
	const [fallo, setFallo] = useState<string | null>(null);

	/** Los lados que de verdad llevan algo dibujado. */
	const ladosConDiseno = useMemo(
		() =>
			Object.entries(sides)
				.filter(([, estado]) => {
					const canvas = estado.canvas;
					if (!canvas) return false;
					return canvas
						.getObjects()
						.some((o) => !estado.editableAreas.includes(o));
				})
				.map(([lado]) => lado),
		[sides],
	);

	const piezas = Object.values(cantidades).reduce((n, v) => n + (v || 0), 0);

	const total = useMemo(() => {
		const base = producto.pricing?.basePrice ?? 0;
		const porLado = producto.pricing?.perSidePrice ?? 0;
		// El primer lado va incluido; los demás se cobran si el taller lo puso.
		const extra = Math.max(0, ladosConDiseno.length - 1) * porLado;
		return (base + extra) * piezas;
	}, [producto.pricing, ladosConDiseno.length, piezas]);

	const listo =
		piezas > 0 &&
		ladosConDiseno.length > 0 &&
		comprador.nombre.trim().length > 0 &&
		/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(comprador.email.trim());

	async function mandar() {
		if (!listo || enviando) return;

		setFallo(null);
		setEnviando(true);

		try {
			// 1. El arte, lado por lado, a la resolución que pidió el taller.
			const artes: ArteDeLado[] = [];

			for (const lado of ladosConDiseno) {
				const estado = sides[lado];
				const medidas = producto.printSides?.find((s) => s.sideKey === lado);

				const arte = exportarArteDeLado(
					lado,
					estado.canvas!,
					estado.editableAreas,
					{
						widthCm: medidas?.widthCm ?? 28,
						heightCm: medidas?.heightCm ?? 35,
						dpi: medidas?.dpi,
					},
				);

				if (arte) artes.push(arte);
			}

			if (artes.length === 0) {
				throw new Error("No encontramos nada dibujado que mandar");
			}

			// 2. El pedido. El precio real lo calcula la API leyendo el producto;
			//    lo de arriba es lo que se le enseña al cliente mientras decide.
			const pedido = await crearPedido({
				comprador: {
					nombre: comprador.nombre.trim(),
					email: comprador.email.trim(),
					whatsapp: comprador.whatsapp.trim() || undefined,
					notas: comprador.notas.trim() || undefined,
				},
				lineas: [
					{
						productoId: producto.id,
						colorPrenda: colorPrenda?.name ?? null,
						lados: artes.map((a) => a.lado),
						tallas: Object.entries(cantidades)
							.filter(([, n]) => n > 0)
							.map(([size, n]) => ({ size, piezas: n })),
						diseno: Object.fromEntries(
							ladosConDiseno.map((lado) => [
								lado,
								sides[lado].canvas?.toJSON() ?? null,
							]),
						),
					},
				],
			});

			// 3. Los archivos, con los permisos que devolvió el pedido.
			const { fallidos } = await subirArte(pedido, artes);

			if (fallidos.length > 0) {
				// El pedido ya existe: fingir que no se hizo sería peor. Se avisa
				// y se sigue al seguimiento, donde puede pedir ayuda con su folio.
				alert(
					`Tu pedido ${pedido.folio} se registró, pero no pudimos subir el arte de: ${fallidos.join(", ")}. Escríbenos con tu folio.`,
				);
			}

			router.push(enlaceDeSeguimiento(pedido));
		} catch (error) {
			setFallo(
				error instanceof Error ? error.message : "No pudimos mandar el pedido",
			);
			setEnviando(false);
		}
	}

	return (
		<div className="fixed inset-0 z-50 flex items-end justify-center bg-tinta/40 p-0 md:items-center md:p-6">
			<div className="flex max-h-[92vh] w-full max-w-[560px] flex-col overflow-auto rounded-t-2xl bg-hueso p-6 md:rounded-2xl">
				<div className="flex items-start justify-between gap-4">
					<div>
						<h2 className="font-display text-[22px] font-semibold leading-7 tracking-[-0.032em] text-tinta">
							Pedir este diseño
						</h2>
						<p className="pt-1 text-sm leading-[22px] text-tinta/60">
							{ladosConDiseno.length > 0
								? `Vas a mandar ${ladosConDiseno.length} ${ladosConDiseno.length === 1 ? "lado" : "lados"} con diseño.`
								: "Todavía no has puesto nada en la prenda."}
						</p>
					</div>
					<button
						type="button"
						onClick={onCerrar}
						className="text-sm font-semibold text-tinta/60"
					>
						Cerrar
					</button>
				</div>

				<div className="flex flex-col gap-2 pt-5">
					<span className="text-[13px] font-semibold text-tinta">
						¿Cuántas piezas de cada talla?
					</span>
					<div className="grid grid-cols-4 gap-2">
						{tallas.map((talla) => (
							<label key={talla} className="flex flex-col gap-1">
								<span className="text-xs text-tinta/60">{talla}</span>
								<input
									type="number"
									min={0}
									inputMode="numeric"
									value={cantidades[talla] ?? ""}
									onChange={(e) =>
										setCantidades((c) => ({
											...c,
											[talla]: Math.max(0, Number(e.target.value) || 0),
										}))
									}
									className="h-11 rounded-lg border-[1.5px] border-tinta/20 bg-white px-3 text-[15px] text-tinta"
								/>
							</label>
						))}
					</div>
				</div>

				<div className="flex flex-col gap-2.5 pt-5">
					<Campo
						etiqueta="Tu nombre"
						valor={comprador.nombre}
						onChange={(v) => setComprador((c) => ({ ...c, nombre: v }))}
					/>
					<Campo
						etiqueta="Correo"
						tipo="email"
						ayuda="Ahí te mandamos el enlace para seguir tu pedido."
						valor={comprador.email}
						onChange={(v) => setComprador((c) => ({ ...c, email: v }))}
					/>
					<Campo
						etiqueta="WhatsApp (opcional)"
						valor={comprador.whatsapp}
						onChange={(v) => setComprador((c) => ({ ...c, whatsapp: v }))}
					/>
					<Campo
						etiqueta="Notas para el taller (opcional)"
						valor={comprador.notas}
						onChange={(v) => setComprador((c) => ({ ...c, notas: v }))}
					/>
				</div>

				<div className="mt-5 flex items-center justify-between rounded-lg border border-tinta/12 bg-gris px-4 py-3">
					<span className="text-sm text-tinta/70">
						{piezas} {piezas === 1 ? "pieza" : "piezas"}
					</span>
					<span className="font-display text-[19px] font-semibold text-tinta">
						${total.toLocaleString("es-MX")}
					</span>
				</div>

				<p className="pt-2 text-[13px] leading-[20px] text-tinta/55">
					El taller confirma el pedido y acuerda contigo el pago y la entrega.
					Todavía no se cobra nada aquí.
				</p>

				{fallo && (
					<p className="pt-3 text-sm text-[#c0392b]" role="alert">
						{fallo}
					</p>
				)}

				<button
					type="button"
					disabled={!listo || enviando}
					onClick={mandar}
					className="mt-4 flex h-12 items-center justify-center rounded-lg bg-tinta text-[15px] font-semibold text-lima disabled:bg-tinta/14 disabled:text-tinta/40"
				>
					{enviando ? "Mandando…" : "Mandar pedido"}
				</button>
			</div>
		</div>
	);
}

function Campo({
	etiqueta,
	valor,
	onChange,
	tipo = "text",
	ayuda,
}: {
	etiqueta: string;
	valor: string;
	onChange: (v: string) => void;
	tipo?: string;
	ayuda?: string;
}) {
	return (
		<label className="flex flex-col gap-1">
			<span className="text-[13px] font-semibold text-tinta">{etiqueta}</span>
			<input
				type={tipo}
				value={valor}
				onChange={(e) => onChange(e.target.value)}
				className="h-11 rounded-lg border-[1.5px] border-tinta/20 bg-white px-3 text-[15px] text-tinta"
			/>
			{ayuda && <span className="text-xs text-tinta/55">{ayuda}</span>}
		</label>
	);
}
