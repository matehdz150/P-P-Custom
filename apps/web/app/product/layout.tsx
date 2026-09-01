import Footer from "@/components/Kustto/Footer";
import Header from "@/components/Kustto/Header";

export default function Layout({ children }: { children: React.ReactNode }) {
	return (
		<div className="font-brand min-h-screen bg-hueso text-tinta">
			<Header />
			<main>{children}</main>
			<Footer />
		</div>
	);
}
