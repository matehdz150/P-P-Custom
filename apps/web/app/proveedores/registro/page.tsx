import type { Metadata } from "next";
import Link from "next/link";
import FormularioAlta from "@/components/Proveedores/FormularioAlta";

export const metadata: Metadata = {
	title: "Solicita tu alta como proveedor — kustto",
	description:
		"Cuéntanos qué técnicas manejas y qué produces. Revisamos cada solicitud a mano y te damos de alta.",
};

/**
 * Alta pública de proveedor. No crea cuenta: manda una solicitud que
 * revisamos a mano. Por eso no pide contraseña.
 */
export default function Page() {
	return (
		<div className="font-brand relative flex min-h-screen flex-col items-center overflow-hidden bg-gris px-5 pb-16 pt-8 text-tinta md:pb-24 md:pt-12">
			{/* Los mismos aros del login, para que se lean como el mismo trámite. */}
			<svg
				className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2"
				width="1400"
				height="1400"
				viewBox="0 0 1400 1400"
				fill="none"
				aria-hidden="true"
			>
				<circle
					cx="700"
					cy="700"
					r="640"
					stroke="rgba(43,40,18,0.07)"
					strokeWidth="1.2"
					fill="none"
				/>
				<circle
					cx="700"
					cy="700"
					r="450"
					stroke="rgba(43,40,18,0.06)"
					strokeWidth="1.2"
					fill="none"
				/>
			</svg>

			<div className="relative flex w-full flex-col items-center gap-7 md:w-[620px] md:gap-9">
				<div className="flex flex-col items-center gap-3">
					<Link
						href="/"
						className="font-brand text-[28px] font-semibold leading-none tracking-[-0.05em] text-tinta md:text-[32px]"
					>
						kustto
					</Link>
					<h1 className="text-center font-display text-[28px] font-semibold leading-9 tracking-[-0.032em] text-tinta md:text-[34px] md:leading-[42px]">
						Solicita tu alta como proveedor
					</h1>
					<p className="max-w-[440px] text-center text-[15px] leading-[26px] text-tinta/70">
						Cuéntanos qué sabes producir. Si encaja con lo que nos están
						pidiendo, te damos de alta y te mandamos tu acceso.
					</p>
				</div>

				<FormularioAlta />

				<span className="text-center text-sm text-tinta/60">
					¿Ya tienes cuenta?{" "}
					<Link
						href="/proveedor/login"
						className="font-semibold text-tinta hover:text-lima-oscuro"
					>
						Entra a tu panel
					</Link>
				</span>
			</div>
		</div>
	);
}
