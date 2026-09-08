import { clasesDeFuentes } from "@/app/design/fuentes";
import { DesignerProvider } from "@/Contexts/DesignerContext";
import { HistoryProvider } from "@/Contexts/HistoryContext";
import ProductDesigner from "@/components/Designer/ProductDesigner";
import { idsDeProductos } from "@/lib/build/parametros";

export default async function Page({
	params,
}: {
	params: Promise<{ productId: string }>;
}) {
	const { productId } = await params;

	return (
		<div className={clasesDeFuentes}>
			<DesignerProvider>
				<HistoryProvider>
					<ProductDesigner productId={productId} />
				</HistoryProvider>
			</DesignerProvider>
		</div>
	);
}

/**
 * Las URLs de esta ruta, resueltas al construir. Ver lib/build/parametros.ts:
 * un producto aprobado no aparece hasta el siguiente despliegue.
 */
export async function generateStaticParams() {
	return (await idsDeProductos()).map((productId) => ({ productId }));
}
