import Footer from "@/components/Kustto/Footer";
import Header from "@/components/Kustto/Header";

/**
 * El checkout lleva el mismo marco que el resto de la tienda.
 *
 * Quitarle la cabecera para "no distraer" es lo que hacen los checkouts que
 * parecen una estafa: quien está a punto de dar su dirección necesita ver que
 * sigue en el mismo sitio donde diseñó.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
	return (
		<div className="font-brand min-h-screen bg-hueso text-tinta">
			<Header />
			<main>{children}</main>
			<Footer />
		</div>
	);
}
