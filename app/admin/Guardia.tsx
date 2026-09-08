"use client";

import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { useAdminAuth } from "@/Contexts/AdminAuthContext";
import { mismaRuta } from "@/lib/rutas";

/**
 * Deja pasar a quien tiene sesión y manda a entrar a quien no.
 *
 * LA PANTALLA DE ENTRAR SE SALTA EL GUARDIA, obviamente: si no, entrar
 * redirigiría a entrar. Se compara con `mismaRuta` y no con `===` porque el
 * sitio se exporta con `trailingSlash`, así que en producción la ruta llega
 * con barra final y la comparación directa da falso SÓLO AHÍ — que es donde
 * nadie la prueba. Ya dejó en blanco dos pantallas del proyecto.
 *
 * MIENTRAS SE AVERIGUA no se enseña ni el panel ni la redirección: leer la
 * sesión puede implicar renovar el token contra Cognito, y pintar "entra" un
 * instante antes de saber que sí había sesión es un parpadeo que hace dudar
 * de si la sesión aguanta.
 */
export default function Guardia({ children }: { children: ReactNode }) {
	const { admin, cargando } = useAdminAuth();
	const router = useRouter();
	const ruta = usePathname();

	const esEntrar = mismaRuta(ruta, "/admin/entrar");

	useEffect(() => {
		if (!cargando && !admin && !esEntrar) router.replace("/admin/entrar");
	}, [cargando, admin, esEntrar, router]);

	if (esEntrar) return <>{children}</>;

	if (cargando || !admin) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<div className="h-8 w-8 animate-spin rounded-full border-[3px] border-muted border-t-foreground" />
			</div>
		);
	}

	return <>{children}</>;
}
