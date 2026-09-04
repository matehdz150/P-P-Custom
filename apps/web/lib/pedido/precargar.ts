"use client";

import {
	type Dispatch,
	type SetStateAction,
	useEffect,
	useRef,
	useState,
} from "react";
import { useComprador } from "@/Contexts/CompradorContext";
import { getMiPerfil } from "@/lib/api/cuenta";
import type { Direccion } from "@/lib/api/pedir";

/**
 * Con sesión, el checkout no vuelve a preguntar lo que ya está guardado.
 *
 * VIVE AQUÍ Y NO EN CADA PANTALLA porque hay DOS checkouts —el de un producto
 * y el del carrito— y son el mismo trato con quien ya entró. Estaba escrito
 * sólo en el de un producto, así que quien llegaba desde el carrito tenía que
 * teclear otra vez su nombre, su WhatsApp y su dirección entera, con los datos
 * en la cuenta. Tenerlo en un sitio es lo que evita que vuelva a pasar.
 *
 * SE RELLENA UNA VEZ Y SÓLO LO VACÍO. El perfil es una petición a la API y
 * puede llegar tarde: si pisara lo ya tecleado, borraría la dirección de quien
 * empezó a escribir mientras cargaba.
 *
 * EL NOMBRE Y EL CORREO SALEN DEL TOKEN, que está de inmediato; el WhatsApp y
 * la dirección hay que ir a buscarlos.
 *
 * Devuelve si la dirección vino de la cuenta, para poder decirlo en pantalla:
 * cambiarla en este pedido NO toca la guardada, y callárselo haría que alguien
 * la "corrigiera" aquí creyendo que arregla su perfil.
 */
type Contacto = { nombre: string; email: string; whatsapp: string };

export function usePrecargarPerfil<C extends Contacto>(
	setContacto: Dispatch<SetStateAction<C>>,
	setDireccion: Dispatch<SetStateAction<Direccion>>,
) {
	const { comprador } = useComprador();
	const [perfilPuesto, setPerfilPuesto] = useState(false);
	const yaRellene = useRef(false);

	useEffect(() => {
		if (!comprador || yaRellene.current) return;
		yaRellene.current = true;

		setContacto((c) => ({
			...c,
			nombre: c.nombre || (comprador.nombre ?? ""),
			email: c.email || comprador.email,
		}));

		getMiPerfil()
			.then((perfil) => {
				setContacto((c) => ({
					...c,
					nombre: c.nombre || (perfil.nombre ?? ""),
					whatsapp: c.whatsapp || (perfil.whatsapp ?? ""),
				}));

				if (!perfil.direccion) return;

				setDireccion((d) =>
					d.calle.trim() ? d : { ...d, ...limpiar(perfil.direccion) },
				);
				setPerfilPuesto(true);
			})
			// Sin perfil guardado se sigue con lo del token: no tener dirección
			// no es un fallo, es alguien que pide por primera vez.
			.catch(() => {});
	}, [comprador, setContacto, setDireccion]);

	return perfilPuesto;
}

/**
 * La dirección del perfil, lista para meter en el formulario.
 *
 * El perfil guarda `null` en lo opcional y aquí los campos son cadenas: un
 * `null` en un input lo vuelve no controlado y React se queja en consola.
 */
function limpiar(d: Record<string, string | null> | null): Partial<Direccion> {
	if (!d) return {};

	return Object.fromEntries(
		Object.entries(d).map(([k, v]) => [k, v ?? ""]),
	) as Partial<Direccion>;
}
