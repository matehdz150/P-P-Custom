"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useProviderAuth } from "@/Contexts/ProviderAuthContext";
import { mismaRuta } from "@/lib/rutas";

/**
 * Le dice al taller lo que le falta para poder vender con envío.
 *
 * POR QUÉ EXISTE
 *
 * Sin dirección de recolección, el checkout le enseña al comprador "este
 * taller no envía todavía" y le ofrece recoger. Eso es correcto —no se puede
 * cotizar desde una dirección que no existe— pero el aviso salía SÓLO del lado
 * del comprador: el taller no tenía manera de enterarse de que estaba perdiendo
 * todos los pedidos con envío, y desde su panel todo se veía normal.
 *
 * Las dos condiciones son las mismas que comprueban las Lambdas, y se separan
 * porque fallan en momentos muy distintos:
 *
 *   sin dirección  falla ANTES de pedir: `leerOrigen` en admin/rutas/envios.ts
 *                  no cotiza y el comprador nunca ve la opción de envío.
 *   sin teléfono   falla DESPUÉS de pedir: `leerTaller` en
 *                  proveedores/rutas/guias.ts lo rechaza al comprar la guía,
 *                  con el pedido ya cobrado y el cliente esperando.
 *
 * El segundo es el peor de los dos y por eso también se avisa aunque la
 * dirección esté puesta.
 */
export function AvisoDePerfil() {
	const { provider } = useProviderAuth();
	const pathname = usePathname();

	// En el propio perfil sobra: el aviso estaría encima del formulario que lo
	// resuelve, señalando campos que ya se ven. Sin la barra final, porque en
	// producción `usePathname()` la trae y el aviso salía TAMBIÉN ahí — ver
	// `lib/rutas.ts`.
	if (!provider || mismaRuta(pathname, "/proveedor/perfil")) return null;

	const sinDireccion = !provider.recoleccion?.cp;
	const sinTelefono = !String(provider.whatsapp ?? "").trim();

	if (!sinDireccion && !sinTelefono) return null;

	const { titulo, detalle } = sinDireccion
		? {
				titulo: "No estás recibiendo pedidos con envío",
				detalle:
					"Sin tu dirección de recolección no podemos cotizar paqueterías, " +
					"así que a tus clientes sólo les aparece la opción de recoger " +
					"contigo. Ponla y empiezas a aparecer con envío a todo el país.",
			}
		: {
				titulo: "Falta tu teléfono para poder generar guías",
				detalle:
					"La paquetería lo exige para recoger. Si entra un pedido con " +
					"envío hoy, no vas a poder comprar la etiqueta hasta que lo " +
					"pongas — y el cliente ya habrá pagado.",
			};

	return (
		<div className="mb-6 flex flex-col gap-3 rounded-xl border-[1.5px] border-tinta/20 bg-lima/25 p-5 sm:flex-row sm:items-center sm:justify-between">
			<div className="flex flex-col gap-1">
				<p className="text-[15px] font-semibold text-tinta">{titulo}</p>
				<p className="max-w-[62ch] text-[13px] leading-[20px] text-tinta/70">
					{detalle}
				</p>
			</div>

			<Link
				href="/proveedor/perfil"
				className="flex h-10 shrink-0 items-center justify-center rounded-lg bg-tinta px-4 text-[14px] font-semibold text-lima"
			>
				Completar perfil
			</Link>
		</div>
	);
}
