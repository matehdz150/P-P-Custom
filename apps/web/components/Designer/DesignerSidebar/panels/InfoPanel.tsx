"use client";

import { Check, ImageIcon, Type, X } from "lucide-react";
import { useDesigner } from "@/Contexts/DesignerContext";
import { usePriceBreakdown } from "@/components/Designer/hooks/useProductConfig";

function money(n: number) {
	return new Intl.NumberFormat("es-MX", {
		style: "currency",
		currency: "MXN",
		maximumFractionDigits: 2,
	}).format(n);
}

/**
 * La información real del producto, sin cabecera.
 *
 * La comparten los dos editores. En el teléfono esto estaba escrito a mano y
 * era de otro producto: precios en dólares, "Comfort Colors® 1717" y
 * "Fulfilled by Printify Choice", que no es ni la pasarela ni el catálogo de
 * Kustto. Enseñaba un costo inventado sobre el diseño que alguien iba a pagar.
 */
export function ContenidoDeInfo() {
	const { config } = useDesigner();
	const { lines, total, sidesEdited, designElements, colorsUsed } =
		usePriceBreakdown();

	const rules = config?.rules;

	return (
		<div className="flex flex-col gap-6">
			{/* NOMBRE */}
			<h3 className="font-semibold text-base text-tinta">
				{config?.name ?? "Producto"}
			</h3>

			{/* REGLAS DE PERSONALIZACIÓN */}
			<div className="flex flex-col gap-2">
				<span className="text-sm font-semibold">Personalización permitida</span>
				<div className="flex flex-col gap-2 text-sm">
					<RuleRow
						icon={<Type size={16} />}
						label="Texto"
						allowed={rules?.allowText ?? true}
					/>
					<RuleRow
						icon={<ImageIcon size={16} />}
						label="Imágenes"
						allowed={rules?.allowImages ?? true}
					/>
					{rules?.maxDesigns != null && (
						<p className="text-xs text-[#5b5b4a]">
							Máx. {rules.maxDesigns} elementos de diseño
						</p>
					)}
					{rules?.maxColorsPerDesign != null && (
						<p className="text-xs text-[#5b5b4a]">
							Máx. {rules.maxColorsPerDesign} colores
						</p>
					)}
				</div>
			</div>

			{/* DESGLOSE DE PRECIO */}
			<div className="bg-[#f4f4ee] rounded-lg p-4 flex flex-col gap-3">
				<span className="font-semibold text-sm text-tinta">
					Desglose de precio
				</span>

				<div className="flex flex-col gap-2 text-sm">
					{lines.map((l) => (
						<div key={l.label} className="flex justify-between items-baseline">
							<div className="flex flex-col">
								<span className="text-[#3b3b2f]">{l.label}</span>
								<span className="text-xs text-[#8a8a76]">{l.detail}</span>
							</div>
							<span className="font-medium">{money(l.amount)}</span>
						</div>
					))}
				</div>

				<div className="h-px bg-[#deded4]" />

				<div className="flex justify-between items-center">
					<span className="font-bold text-tinta">Total</span>
					<span className="font-bold text-lg text-tinta">{money(total)}</span>
				</div>

				<p className="text-xs text-[#8a8a76]">
					El precio se actualiza según tu diseño: {sidesEdited} lado(s) ·{" "}
					{designElements} elemento(s) · {colorsUsed} color(es).
				</p>
			</div>
		</div>
	);
}

/** La misma información con la cabecera que necesita la barra de escritorio. */
export default function InfoPanel({ close }: { close: () => void }) {
	return (
		<div className="h-full flex flex-col font-sora bg-white">
			<div className="p-6 pb-2 flex justify-between items-center">
				<h2 className="font-semibold text-lg text-tinta">
					Información del producto
				</h2>
				<button type="button" onClick={close}>
					<X size={22} />
				</button>
			</div>

			<div className="flex-1 overflow-y-auto p-6">
				<ContenidoDeInfo />
			</div>
		</div>
	);
}

function RuleRow({
	icon,
	label,
	allowed,
}: {
	icon: React.ReactNode;
	label: string;
	allowed: boolean;
}) {
	return (
		<div className="flex items-center justify-between">
			<span className="flex items-center gap-2 text-[#3b3b2f]">
				{icon}
				{label}
			</span>
			{allowed ? (
				<span className="flex items-center gap-1 text-xs font-semibold text-green-600">
					<Check size={14} /> Permitido
				</span>
			) : (
				<span className="flex items-center gap-1 text-xs font-semibold text-red-500">
					<X size={14} /> No permitido
				</span>
			)}
		</div>
	);
}
