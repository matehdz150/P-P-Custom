import { Check } from "lucide-react";
import { Sora } from "next/font/google";
import type { ReactNode } from "react";
import { Header } from "@/components/Header/Header";
import ProductSample from "@/components/Landing/ProductSample";
import TutorialLanding from "@/components/Landing/TutorialLanding";

const sora = Sora({
	subsets: ["latin-ext"],
	weight: ["300", "400", "500", "600", "700", "800"],
	display: "swap",
});

// ⭐ Componente interno — modularizado sin archivo extra
function CheckItem({ children }: { children: ReactNode }) {
	return (
		<div className="flex items-center gap-2 text-sm font-light">
			<Check className="w-5 h-5 text-green-600" />
			<p>{children}</p>
		</div>
	);
}

export default function Landing() {
	return (
		<>
			<Header />
			<main>
				<div
					className={`${sora.className} flex flex-col items-center text-center text-5xl min-h-screen font-black mt-9 gap-6`}
				>
					<h1 className="tracking-tight">LO CREAS TÚ MISMO</h1>
					<h1 className="tracking-tight">PRODUCIMOS NOSOTROS.</h1>
					{/* Lista de checks modularizada */}
					<div className="flex flex-wrap justify-center gap-4 text-sm mt-2">
						<CheckItem>Diseña</CheckItem>
						<CheckItem>Elige productos</CheckItem>
						<CheckItem>Nosotros nos encargamos</CheckItem>
					</div>
					<button
						type="button"
						className="text-[1rem] px-10 py-6 bg-[#fe6241] rounded-[0.2rem] font-bold"
					>
						Empieza ahora
					</button>
					<ProductSample />
					<section className="w-full h-280 bg-[#f5f5f1]">
						<TutorialLanding />
					</section>
					<section className="w-full h-250"></section>
				</div>
			</main>
		</>
	);
}
