export type AvailableFont = {
	family: string;
	label: string;
};

/**
 * Las fuentes que puede usar el cliente en su diseño.
 *
 * Cada una tiene que estar declarada también en la página del editor
 * (`app/design/[productId]/page.tsx`) con `next/font/google`: Fabric las pide
 * por nombre de familia y si no está el `@font-face` el texto cae a la fuente
 * del sistema sin avisar.
 */
export const AVAILABLE_FONTS: AvailableFont[] = [
	{ family: "Abril Fatface", label: "Abril Fatface" },
	{ family: "Alfa Slab One", label: "Alfa Slab One" },
	{ family: "Anton", label: "Anton" },
	{ family: "Archivo Black", label: "Archivo Black" },
	{ family: "Bebas Neue", label: "Bebas Neue" },
	{ family: "Bitter", label: "Bitter" },
	{ family: "Black Ops One", label: "Black Ops One" },
	{ family: "Bungee", label: "Bungee" },
	{ family: "Caveat", label: "Caveat" },
	{ family: "Cormorant Garamond", label: "Cormorant Garamond" },
	{ family: "DM Serif Display", label: "DM Serif Display" },
	{ family: "Dancing Script", label: "Dancing Script" },
	{ family: "Fredoka", label: "Fredoka" },
	{ family: "Great Vibes", label: "Great Vibes" },
	{ family: "Inter", label: "Inter" },
	{ family: "Lobster", label: "Lobster" },
	{ family: "Monoton", label: "Monoton" },
	{ family: "Montserrat", label: "Montserrat" },
	{ family: "Oswald", label: "Oswald" },
	{ family: "Outfit", label: "Outfit" },
	{ family: "Pacifico", label: "Pacifico" },
	{ family: "Permanent Marker", label: "Permanent Marker" },
	{ family: "Playfair Display", label: "Playfair Display" },
	{ family: "Poppins", label: "Poppins" },
	{ family: "Righteous", label: "Righteous" },
	{ family: "Rock Salt", label: "Rock Salt" },
	{ family: "Shrikhand", label: "Shrikhand" },
	{ family: "Sora", label: "Sora" },
	{ family: "Space Grotesk", label: "Space Grotesk" },
	{ family: "Space Mono", label: "Space Mono" },
];
