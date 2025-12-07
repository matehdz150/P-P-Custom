"use client";

import {
	Anton,
	Bebas_Neue,
	Cormorant_Garamond,
	Great_Vibes,
	Inter,
	Montserrat,
	Pacifico,
	Playfair_Display,
	Poppins,
	Sora,
} from "next/font/google";
import ProductDesigner from "@/components/Designer/ProductDesigner";
import { DesignerProvider } from "../../Contexts/DesignerContext";

// --- Instagram-level typefaces ---
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const poppins = Poppins({
	subsets: ["latin"],
	variable: "--font-poppins",
	weight: "100",
});
const montserrat = Montserrat({
	subsets: ["latin"],
	variable: "--font-montserrat",
});
const bebas = Bebas_Neue({
	subsets: ["latin"],
	variable: "--font-bebas",
	weight: "400",
});
const anton = Anton({
	subsets: ["latin"],
	variable: "--font-anton",
	weight: "400",
});
const sora = Sora({ subsets: ["latin"], variable: "--font-sora" });
const playfair = Playfair_Display({
	subsets: ["latin"],
	variable: "--font-playfair",
});
const cormorant = Cormorant_Garamond({
	subsets: ["latin"],
	variable: "--font-cormorant",
});
const pacifico = Pacifico({
	subsets: ["latin"],
	variable: "--font-pacifico",
	weight: "400",
});
const greatvibes = Great_Vibes({
	subsets: ["latin"],
	variable: "--font-greatvibes",
	weight: "400",
});

export default function Page() {
	return (
		<div
			className={`
        ${inter.variable} ${poppins.variable} ${montserrat.variable}
        ${bebas.variable} ${anton.variable} ${sora.variable}
        ${playfair.variable} ${cormorant.variable} ${pacifico.variable}
        ${greatvibes.variable}
      `}
		>
			<DesignerProvider>
				<ProductDesigner />
			</DesignerProvider>
		</div>
	);
}
