/** Etiqueta de sección: punto-anillo + texto, como en el resto del sitio. */
export default function Eyebrow({
	children,
	claro = false,
}: {
	children: string;
	claro?: boolean;
}) {
	return (
		<span
			className={`flex items-center gap-2.5 text-sm font-medium md:text-base ${
				claro ? "text-hueso/80" : "text-tinta"
			}`}
		>
			<span
				className={`inline-block h-2.5 w-2.5 rounded-full border-[1.6px] ${
					claro ? "border-hueso/80" : "border-tinta"
				}`}
			/>
			{children}
		</span>
	);
}
