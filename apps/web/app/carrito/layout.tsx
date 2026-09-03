import Footer from "@/components/Kustto/Footer";
import Header from "@/components/Kustto/Header";

/**
 * El carrito lleva el mismo marco que el resto de la tienda.
 *
 * No lo tenía: `/carrito` era la única ruta de la tienda sin `layout.tsx`, así
 * que se abría sin cabecera y sin pie. Quien llega aquí viene de diseñar y va
 * hacia el checkout, y quedarse sin el marco a mitad del camino se siente a
 * página rota — o peor, a otro sitio.
 *
 * COLUMNA FLEXIBLE CON EL CENTRO CRECIENDO. Es lo que hace que el gris del
 * carrito llegue hasta el pie: sin `flex-grow`, con el carrito corto o vacío el
 * fondo se cortaba a media pantalla y debajo quedaba una franja clara suelta.
 *
 * El relleno de abajo por debajo de `lg` es por la barra de total, que en el
 * teléfono va fija al borde inferior (ver `Resumen` en `page.tsx`): sin él, esa
 * barra se queda encima del pie cuando terminas de bajar.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
	return (
		<div className="font-brand flex min-h-screen flex-col bg-hueso text-tinta max-lg:pb-[132px]">
			<Header />
			<main className="flex-grow bg-gris">{children}</main>
			<Footer />
		</div>
	);
}
