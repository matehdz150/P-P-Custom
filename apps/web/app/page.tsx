import Casos from "@/components/Kustto/Casos";
import Catalogo from "@/components/Kustto/Catalogo";
import Cierre from "@/components/Kustto/Cierre";
import Footer from "@/components/Kustto/Footer";
import Franja from "@/components/Kustto/Franja";
import Header from "@/components/Kustto/Header";
import Hero from "@/components/Kustto/Hero";
import Pasos from "@/components/Kustto/Pasos";
import Proveedores from "@/components/Kustto/Proveedores";

export default function Page() {
	return (
		<div className="font-brand min-h-screen bg-white text-tinta">
			<Header variante="centrado" />
			<main>
				<Hero />
				<Franja />
				<Pasos />
				<Catalogo />
				<Casos />
				<Proveedores />
				<Cierre />
			</main>
			<Footer />
		</div>
	);
}
