import Casos from "@/components/Kustto/Casos";
import Catalogo from "@/components/Kustto/Catalogo";
import Cierre from "@/components/Kustto/Cierre";
import Footer from "@/components/Kustto/Footer";
import Franja from "@/components/Kustto/Franja";
import Header from "@/components/Kustto/Header";
import Hero from "@/components/Kustto/Hero";
import Motor from "@/components/Kustto/Motor";
import Pasos from "@/components/Kustto/Pasos";
import Proveedores from "@/components/Kustto/Proveedores";

export default function Page() {
	return (
		<div className="font-brand min-h-screen bg-white text-tinta">
			<Header variante="centrado" />
			<main>
				<Hero />
				{/* El editor va justo después del hero: es lo que nadie más tiene y
				    lo que separa a Kustto de una tienda de playeras. Enseñarlo antes
				    de las ocasiones evita que la landing prometa "diseña en el
				    navegador" tres veces sin enseñarlo ni una. */}
				<Motor />
				{/* `Casos` va TERCERO, no quinto. Es lo que en un marketplace hace
				    de categorías —boda, graduación, empresa—, y ahí es donde se
				    reconoce quien llega con una ocasión en la cabeza en vez de un
				    producto. Estaba después de tres secciones. */}
				<Casos />
				<Franja />
				<Catalogo />
				<Pasos />
				<Proveedores />
				<Cierre />
			</main>
			<Footer />
		</div>
	);
}
