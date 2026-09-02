import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

type Props = {
	price: string;
	provider: string;
	onStartDesign: () => void;
};

export function ProductPricingCard({ price, provider, onStartDesign }: Props) {
	return (
		<div className="mt-6 bg-green-100 rounded-lg p-4 space-y-2">
			<p className="font-semibold">{provider}</p>

			<p className="text-sm flex items-center gap-1">
				<Check /> Desde <strong className="text-lg">{price}</strong>
			</p>

			<p className="text-sm flex items-center gap-1">
				<Check /> Proveedor confiable P&P Custom
			</p>

			<Button
				size="lg"
				className="mt-4 w-full font-semibold"
				onClick={onStartDesign}
			>
				Comienza a diseñar
			</Button>
		</div>
	);
}
