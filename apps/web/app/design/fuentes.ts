/**
 * Las fuentes que el cliente puede usar en su diseño.
 *
 * VIVEN AQUÍ Y NO EN CADA PÁGINA porque hay DOS rutas de editor —`/design` con
 * el id por parámetro y `/design/[productId]`— y cada una traía su propia
 * lista. Se desincronizaron: `/design`, que es la que usan todos los enlaces
 * del sitio, declaraba 10 de las 30 del selector. Las otras 20 se ofrecían,
 * caían a la fuente del sistema sin avisar, y al pedir un producto de láser
 * reventaban con «no pudimos convertir la tipografía» — porque sin
 * `@font-face` no hay `.woff2` que descargar y `lib/impresion/curvas.ts` no
 * puede sacar los trazos.
 *
 * La lista de `lib/fabric/fontList.ts` y ésta TIENEN que coincidir. Si añades
 * una allí, añádela aquí.
 */
import {
	Abril_Fatface,
	Alfa_Slab_One,
	Anton,
	Archivo_Black,
	Bebas_Neue,
	Bitter,
	Black_Ops_One,
	Bungee,
	Caveat,
	Cormorant_Garamond,
	Dancing_Script,
	DM_Serif_Display,
	Fredoka,
	Great_Vibes,
	Inter,
	Lobster,
	Monoton,
	Montserrat,
	Oswald,
	Outfit,
	Pacifico,
	Permanent_Marker,
	Playfair_Display,
	Poppins,
	Righteous,
	Rock_Salt,
	Shrikhand,
	Sora,
	Space_Grotesk,
	Space_Mono,
} from "next/font/google";

// --- fuentes ---
// Cada una que se declare aquí tiene que estar también en
// lib/fabric/fontList.ts, o no aparece en el panel de texto. Y al revés: una
// que esté en la lista y no aquí se dibuja con la fuente del sistema.
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

// Display pesadas: lo que más se usa en playeras de equipo y eventos.
const archivoBlack = Archivo_Black({
	subsets: ["latin"],
	variable: "--font-archivo-black",
	weight: "400",
});
const oswald = Oswald({ subsets: ["latin"], variable: "--font-oswald" });
const alfaSlab = Alfa_Slab_One({
	subsets: ["latin"],
	variable: "--font-alfa-slab",
	weight: "400",
});
const abril = Abril_Fatface({
	subsets: ["latin"],
	variable: "--font-abril",
	weight: "400",
});
const dmSerif = DM_Serif_Display({
	subsets: ["latin"],
	variable: "--font-dm-serif",
	weight: "400",
});
const shrikhand = Shrikhand({
	subsets: ["latin"],
	variable: "--font-shrikhand",
	weight: "400",
});
const righteous = Righteous({
	subsets: ["latin"],
	variable: "--font-righteous",
	weight: "400",
});
const bungee = Bungee({
	subsets: ["latin"],
	variable: "--font-bungee",
	weight: "400",
});
const blackOps = Black_Ops_One({
	subsets: ["latin"],
	variable: "--font-black-ops",
	weight: "400",
});
const monoton = Monoton({
	subsets: ["latin"],
	variable: "--font-monoton",
	weight: "400",
});

// Manuscritas y de marcador.
const lobster = Lobster({
	subsets: ["latin"],
	variable: "--font-lobster",
	weight: "400",
});
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat" });
const dancing = Dancing_Script({
	subsets: ["latin"],
	variable: "--font-dancing",
});
const marker = Permanent_Marker({
	subsets: ["latin"],
	variable: "--font-marker",
	weight: "400",
});
const rockSalt = Rock_Salt({
	subsets: ["latin"],
	variable: "--font-rock-salt",
	weight: "400",
});

// De texto y de apoyo.
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const grotesk = Space_Grotesk({
	subsets: ["latin"],
	variable: "--font-grotesk",
});
const spaceMono = Space_Mono({
	subsets: ["latin"],
	variable: "--font-space-mono",
	weight: ["400", "700"],
});
const fredoka = Fredoka({ subsets: ["latin"], variable: "--font-fredoka" });
const bitter = Bitter({ subsets: ["latin"], variable: "--font-bitter" });

/** Todas las variables CSS juntas, para el contenedor del editor. */
export const clasesDeFuentes = [
	inter.variable,
	poppins.variable,
	montserrat.variable,
	bebas.variable,
	anton.variable,
	sora.variable,
	playfair.variable,
	cormorant.variable,
	pacifico.variable,
	greatvibes.variable,
	archivoBlack.variable,
	oswald.variable,
	alfaSlab.variable,
	abril.variable,
	dmSerif.variable,
	shrikhand.variable,
	righteous.variable,
	bungee.variable,
	blackOps.variable,
	monoton.variable,
	lobster.variable,
	caveat.variable,
	dancing.variable,
	marker.variable,
	rockSalt.variable,
	outfit.variable,
	grotesk.variable,
	spaceMono.variable,
	fredoka.variable,
	bitter.variable,
].join(" ");
