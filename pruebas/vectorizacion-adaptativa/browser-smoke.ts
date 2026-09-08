import { vectorizar } from "../../apps/web/lib/impresion/vectorizar";

const cargar = (src: string) =>
	new Promise<HTMLImageElement>((resolve, reject) => {
		const imagen = new Image();
		imagen.onload = () => resolve(imagen);
		imagen.onerror = () => reject(new Error(`No cargó ${src}`));
		imagen.src = src;
	});

async function ejecutar() {
	const casos = [
		["/fixtures/01-logo-color-alpha.png", "logo-line-art"],
		["/fixtures/02-logo-color-sin-alpha.png", "logo-line-art"],
		["/fixtures/03-logo-blanco-negro.png", "logo-line-art"],
		["/fixtures/04-wordmark-texto-pequeno.png", "logo-line-art"],
		["/fixtures/05-icono-geometrico.png", "icono-geometrico"],
		["/fixtures/06-ilustracion.png", "ilustracion"],
		["/fixtures/07-retrato.jpg", "fotografia"],
		["/fixtures/08-fotografia-alpha.png", "fotografia"],
		["/fixtures/09-degradados.png", "fotografia"],
		["/fixtures/10-jpeg-ruido-compresion.jpg", "fotografia"],
	] as const;
	const resultados = [];
	for (const [src, esperado] of casos) {
		const salida = await vectorizar(await cargar(src));
		resultados.push({
			src,
			esperado,
			perfil: salida.perfil,
			confianza: salida.confianza,
			nodos: salida.nodos,
			paths: salida.paths,
			valido:
				!/<(?:image|text)\b/i.test(salida.svg) &&
				salida.nodos > 0 &&
				salida.nodos <= 20_000,
		});
	}
	const ok = resultados.every(
		(resultado) => resultado.perfil === resultado.esperado && resultado.valido,
	);
	document.body.dataset.estado = ok ? "ok" : "fallo";
	const pre = document.querySelector("pre");
	if (pre) pre.textContent = JSON.stringify({ ok, resultados }, null, 2);
}

ejecutar().catch((error) => {
	document.body.dataset.estado = "error";
	const pre = document.querySelector("pre");
	if (pre) pre.textContent = String(error?.stack ?? error);
});
