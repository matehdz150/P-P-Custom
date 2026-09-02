"use client";

import {
	Truck,
	Layers,
	Palette,
	Ruler,
	Proportions,
	SlidersHorizontal,
	PencilRuler,
} from "lucide-react";
import { MeasurementsTable } from "./MesurementsTable";
import { Button } from "../ui/button";

type Props = {
	product: {
		id: string;
		pricing?: { basePrice: number };
		colors?: { name: string; hex?: string }[];
		sizes?: {
			size: string;
			widthIn: number | string;
			lengthIn: number | string;
		}[];
		printSides?: string[];
		production?: { provider?: string };
	};
};

export function FulfillmentOptionCard({ product }: Props) {
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
		<section className="mt-12 rounded-[0.2rem] bg-[#f5f5f1] p-6 md:p-8 space-y-8">
			{/* TOP */}
			<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
				<div>
					<p className="text-sm text-muted-foreground">
						Producción y fulfillment
					</p>
					<h3 className="text-3xl font-bold tracking-tight">P&P Custom</h3>
				</div>

				<div className="text-right">
					<p className="text-sm text-muted-foreground">Desde</p>
					<p className="text-3xl font-bold">{price}</p>
				</div>
			</div>

			{/* META */}
			<div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
				<MetaItem icon={<Truck size={16} />} label="Producción 1–3 días" />
				<MetaItem icon={<Layers size={16} />} label="Impresión DTG / Bordado" />
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
					<SlidersHorizontal size={22} className="text-black" />
				</div>
				<h3 className="text-sm font-bold ">Opciones de Color y Tallas</h3>
			</div>
			<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
				<Capability title="Colores" count={product.colors?.length ?? 0}>
					<ColorRow colors={product.colors} />
				</Capability>

				<Capability title="Tallas" count={product.sizes?.length ?? 0}>
					<TextRow values={product.sizes?.map((s) => s.size)} />
				</Capability>

				<Capability
					title="Lados de impresión"
					count={product.printSides?.length ?? 0}
				>
					<TextRow values={product.printSides} capitalize />
				</Capability>
			</div>
			{/* MEASUREMENTS */}
			<div className="pt-8 border-t">
				<div className="flex items-center gap-2 mb-4">
					<div className="w-9 h-9 rounded-[0.2rem] bg-[#e0e0d7] border flex items-center justify-center">
						<PencilRuler size={20} />
					</div>
					<h3 className="text-sm font-bold">Medidas del producto</h3>
				</div>

				<MeasurementsTable sizes={normalizedSizes} />
			</div>
			<div className="flex justify-end pt-4">
				<Button
					variant="default"
					className="py-6 px-8 font-semibold rounded-[0.2rem]"
					onClick={() => {
						window.location.href = `/design/${product.id}`;
					}}
				>
					Comienza a diseñar
				</Button>
			</div>
		</section>
	);
}

/* -------------------------------- */

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

				{/* Dot */}
				<div className="w-1.5 h-1.5 bg-black rounded-full" />

				{/* Counter */}
				{typeof count === "number" && (
					<span className="text-sm font-black text-black">{count}</span>
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
					className={`
            px-4 py-1 text-xs font-semibold rounded-[0.2rem]
            bg-[#e0e0d7] text-black
            ${capitalize ? "capitalize" : ""}
          `}
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
