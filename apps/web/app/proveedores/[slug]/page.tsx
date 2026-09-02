import VistaDeProveedor from "./Vista";

/**
 * El escaparate público de un taller.
 *
 * NO SE GENERA NINGUNA URL todavía, a propósito: esta pantalla lee de la API
 * de Nest, que no se despliega, y no existe un endpoint público que liste los
 * talleres con su slug. En cuanto lo haya, aquí se enumeran igual que los
 * productos y las fichas vuelven a existir. Mientras tanto la ruta no se
 * publica, que es más honesto que publicar una página que no carga.
 */
export function generateStaticParams() {
	return [];
}

export default function Pagina() {
	return <VistaDeProveedor />;
}
