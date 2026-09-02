import Link from "next/link";
import Cierre from "@/components/Kustto/Cierre";
import type { CatalogProduct, Product } from "@/lib/api/products";
import BarraMovil from "./BarraMovil";
import { vistasDe } from "./datos";
import Desglose from "./Desglose";
import Escaparate from "./Escaparate";
import Especificaciones from "./Especificaciones";
import Limites from "./Limites";
import Medidas from "./Medidas";
import Proveedor from "./Proveedor";
import Recomendados from "./Recomendados";

export default function ProductoVista({
	product,
	recomendados,
}: {
	product: Product;
	recomendados: CatalogProduct[];
}) {
	return (
		<>
			<Escaparate product={product} vistas={vistasDe(product)} />

			<div className="pt-12 md:pt-0">
				<Limites product={product} />
			</div>

			<Especificaciones product={product} />
			<Desglose product={product} />
			<Medidas product={product} />
			<Proveedor product={product} />
			<Recomendados productos={recomendados} />

			<div className="pt-16 md:pt-24">
				<Cierre />
			</div>

			<BarraMovil product={product} />
		</>
	);
}
