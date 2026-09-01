import type { Metadata } from "next";
import Footer from "@/components/Kustto/Footer";
import HeroProveedor from "@/components/Proveedores/HeroProveedor";
import {
	CierreProveedor,
	ComoEntras,
	PorQue,
	TuPanel,
} from "@/components/Proveedores/Secciones";

export const metadata: Metadata = {
	title: "kustto para proveedores — Recibe pedidos listos para máquina",
	description:
		"Publica lo que ya sabes producir. Cada pedido te llega pagado y con el diseño colocado, el lado, el color y las tallas.",
};

/**
 * Landing de captación de proveedores.
 *
 * No lleva el Header del comprador a propósito: tiene su propia navegación,
 * con "Soy comprador" como salida en vez de "Soy proveedor" como entrada.
 * El panel autenticado vive en /proveedor, en singular.
 */
export default function Page() {
	return (
		<div className="font-brand min-h-screen bg-hueso text-tinta">
			<main>
				<HeroProveedor />
				<PorQue />
				<TuPanel />
				<ComoEntras />
				<CierreProveedor />
			</main>
			<Footer />
		</div>
	);
}
