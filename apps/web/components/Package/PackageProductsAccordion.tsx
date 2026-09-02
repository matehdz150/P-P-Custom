"use client";

import {
	Truck,
	Layers,
	Palette,
	Ruler,
	SlidersHorizontal,
	PencilRuler,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { MeasurementsTable } from "../Product/MesurementsTable";

type ProductTemplateData = {
	sideLabels?: Record<string, string>;
};

type PackageItem = {
	id: string;
	quantity: number;
	/* Opcional porque la API lo devuelve así: un renglón puede haber quedado
     apuntando a un producto que ya no está. */
	product?: {
		id: string;
		name: string;
		images?: {
			url: string;
		}[];
		pricing?: { basePrice: number };
		colors?: { name: string; hex?: string }[];
		sizes?: {
			size: string;
			widthIn: number | string;
			lengthIn: number | string;
		}[];
		printSides?: {
			id: string;
			productId: string;
			sideKey: string;
			widthCm: number;
			heightCm: number;
			dpi: number;
			enabled: boolean;
		}[];
		productTemplateData?: ProductTemplateData;
	};
};

type Props = {
	items: PackageItem[];
};

export function PackageProductsAccordion({ items = [] }: Props) {
	if (items.length === 0) {
		return (
			<p className="text-sm text-muted-foreground">
				Este paquete no tiene productos.
			</p>
		);
	}

	return (
		<Accordion type="single" collapsible className="space-y-2">
			{items.map((item) => {
				const product = item.product;

				// Un renglón sin producto no se pinta: es un dato roto, no un hueco
				// que el cliente tenga que interpretar.
				if (!product) return null;

				const sideLabels = product.productTemplateData?.sideLabels ?? {};

				const printSideLabels = product.printSides?.map(
					(s) => sideLabels[s.sideKey] ?? s.sideKey,
				);

				const price =
					product.pricing?.basePrice != null
						? `${product.pricing.basePrice} MXN`
						: "—";

				const normalizedSizes =
					product.sizes?.map((s) => ({
						size: s.size,
						widthIn: Number(s.widthIn),
						lengthIn: Number(s.lengthIn),
					})) ?? [];

				return (
					<AccordionItem
						key={item.id}
						value={item.id}
						className="border rounded-[0.2rem] bg-[#f5f5f1]"
					>
						<AccordionTrigger className="px-6 py-4 text-left">
							<div className="w-full flex items-center justify-between gap-6">
								{/* LEFT: image + info */}
								<div className="flex items-center gap-4 min-w-0">
									{/* IMAGE */}
									<div className="w-16 h-16 rounded-md bg-[#f5f5f1] flex items-center justify-center overflow-hidden shrink-0">
										{product.images?.[0]?.url ? (
											<img
												src={product.images[0].url}
												alt={product.name}
												className="w-full h-full object-contain"
											/>
										) : (
											<span className="text-xs text-muted-foreground">
												Sin imagen
											</span>
										)}
									</div>

									{/* TEXT */}
									<div className="min-w-0">
										<p className="text-lg font-semibold truncate">
											{product.name}
										</p>
										<p className="text-xs text-muted-foreground">
											Cantidad: {item.quantity}
										</p>
									</div>
								</div>

								{/* RIGHT: price */}
								<div className="text-right shrink-0">
									<p className="text-xs text-muted-foreground">Desde</p>
									<p className="text-lg font-bold">{price}</p>
								</div>
							</div>
						</AccordionTrigger>

						{/* ================= CONTENT ================= */}
						<AccordionContent className="px-6 pb-6 space-y-8">
							{/* META */}
							<div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
								<MetaItem
									icon={<Truck size={16} />}
									label="Producción 1–3 días"
								/>
								<MetaItem
									icon={<Layers size={16} />}
									label="Impresión DTG / Bordado"
								/>
								<MetaItem
									icon={<Palette size={16} />}
									label={`${product.colors?.length ?? 0} colores`}
								/>
								<MetaItem
									icon={<Ruler size={16} />}
									label={`${product.sizes?.length ?? 0} tallas`}
								/>
							</div>

							{/* CAPABILITIES */}
							<div className="flex border-t pt-6 items-center gap-2">
								<div className="w-9 h-9 rounded-[0.2rem] bg-[#e0e0d7] border flex items-center justify-center">
									<SlidersHorizontal size={20} />
								</div>
								<h3 className="text-sm font-bold">Opciones del producto</h3>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
								<Capability title="Colores" count={product.colors?.length}>
									<ColorRow colors={product.colors} />
								</Capability>

								<Capability title="Tallas" count={product.sizes?.length}>
									<TextRow values={product.sizes?.map((s) => s.size)} />
								</Capability>

								<Capability
									title="Lados de impresión"
									count={product.printSides?.length}
								>
									<TextRow values={printSideLabels} capitalize />
								</Capability>
							</div>

							{/* MEASUREMENTS */}
							{normalizedSizes.length > 0 && (
								<div className="pt-8 border-t">
									<div className="flex items-center gap-2 mb-4">
										<div className="w-9 h-9 rounded-[0.2rem] bg-[#e0e0d7] border flex items-center justify-center">
											<PencilRuler size={18} />
										</div>
										<h3 className="text-sm font-bold">Medidas del producto</h3>
									</div>

									<MeasurementsTable sizes={normalizedSizes} />
								</div>
							)}
						</AccordionContent>
					</AccordionItem>
				);
			})}
		</Accordion>
	);
}

/* ================= SUB COMPONENTS ================= */

function MetaItem({ icon, label }: { icon: React.ReactNode; label: string }) {
	return (
		<div className="flex items-center gap-2">
			{icon}
			<span>{label}</span>
		</div>
	);
}

function Capability({
	title,
	count,
	children,
}: {
	title: string;
	count?: number;
	children: React.ReactNode;
}) {
	return (
		<div>
			<div className="flex items-center gap-1 mb-2">
				<p className="text-sm font-black">{title}</p>
				<div className="w-1.5 h-1.5 bg-black rounded-full" />
				{typeof count === "number" && (
					<span className="text-sm font-black">{count}</span>
				)}
			</div>
			{children}
		</div>
	);
}

function ColorRow({ colors }: { colors?: { name: string; hex?: string }[] }) {
	if (!colors?.length) return <Empty />;

	return (
		<div className="flex gap-2 flex-wrap">
			{colors.map((c) => (
				<span
					key={c.name}
					className="w-6 h-6 rounded-full border"
					style={{ backgroundColor: c.hex ?? "#ccc" }}
					title={c.name}
				/>
			))}
		</div>
	);
}

function TextRow({
	values,
	capitalize,
}: {
	values?: string[];
	capitalize?: boolean;
}) {
	if (!values?.length) return <Empty />;

	return (
		<div className="flex flex-wrap gap-2">
			{values.map((value) => (
				<span
					key={value}
					className={`px-4 py-1 text-xs font-semibold rounded-[0.2rem] bg-[#e0e0d7] ${
						capitalize ? "capitalize" : ""
					}`}
				>
					{value}
				</span>
			))}
		</div>
	);
}

function Empty() {
	return <p className="text-sm text-muted-foreground">No disponible</p>;
}
