import type { Metadata } from "next";
import { Figtree, Geist, Geist_Mono, Poppins } from "next/font/google";
import "./globals.css";

import { AuthProvider } from "@/Contexts/AuthContext";
import { CompradorProvider } from "@/Contexts/CompradorContext";
import IOSViewportProvider from "@/components/hooks/IOSViewportProvider"; // 👈 IMPORTANTE
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

const figtree = Figtree({
	variable: "--font-figtree",
	subsets: ["latin"],
	// 600 lo usa la landing de proveedores, que pide un display menos pesado
	// que el del resto del sitio. Sin este peso el navegador lo sintetiza.
	weight: ["600", "700", "800"],
	display: "swap",
});

const poppins = Poppins({
	variable: "--font-poppins",
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
	display: "swap",
});

export const metadata: Metadata = {
	title: "kustto — Diseña lo tuyo, pídelo desde una pieza",
	description:
		"Marketplace de personalización bajo demanda. Diseña en el navegador, compara proveedores y pide desde una pieza.",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en">
			<body
				className={`${geistSans.variable} ${geistMono.variable} ${figtree.variable} ${poppins.variable} antialiased`}
			>
				<AuthProvider>
					<CompradorProvider>
						<IOSViewportProvider>{children}</IOSViewportProvider>
					{/* Inerte hasta que alguien llame a `toast()`, así que vive en la
					    raíz y no en cada panel que lo necesite. */}
					<Toaster />
					</CompradorProvider>
				</AuthProvider>
			</body>
		</html>
	);
}
