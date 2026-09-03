/**
 * DUPLICADO A PROPÓSITO en `services/admin` y `services/proveedores`.
 *
 * Cada servicio es su propio bundle y tiene su `lib/`, como ya pasa con
 * `skydropx.ts`. Hay DOS correos que salen de los dos lados, porque el pedido
 * se puede mover por dos caminos:
 *
 *   "va en camino"  el taller lo marca a mano (proveedores) o lo marca la
 *                   paquetería por webhook (admin).
 *   "llegó"         lo marca el taller cuando el cliente RECOGIÓ, y lo marca
 *                   la paquetería cuando ENTREGÓ.
 *
 * ("ya está listo" sale sólo de proveedores: eso lo sabe quien produce.)
 *
 * COPIA EL ARCHIVO ENTERO al cambiarlo. Si las plantillas divergen, el mismo
 * cliente recibe un texto u otro según quién movió el pedido, y eso no se ve
 * en ninguna prueba.
 *
 * Si algún día hace falta un TERCER disparador, esto deja de compensar: la
 * salida buena es una Lambda sobre el stream de DynamoDB que mire las
 * transiciones y mande desde un solo sitio. Los streams ya están activados.
 */

import { type Correo, esc, pesos, SITIO } from "./correo.js";

/**
 * Los correos que manda Kustto.
 *
 * Se escriben en texto Y en HTML. El texto no es un respaldo de segunda: hay
 * clientes que no pintan HTML, los filtros de spam castigan el sólo-HTML, y un
 * correo que se lee bien en texto se lee bien en cualquier sitio.
 *
 * EL HTML VA EN TABLAS Y CON ESTILOS EN LÍNEA. No es descuido ni nostalgia:
 * Gmail borra las hojas de estilo, Outlook renderiza con Word y el flexbox no
 * existe ahí. Lo que aquí parece anticuado es lo único que se ve igual en
 * todos.
 */

const TINTA = "#2b2812";
const HUESO = "#fffdf8";
const GRIS = "#f3f3f1";

/** El marco común. Todo lo demás sólo rellena el cuerpo. */
function envoltorio(titulo: string, cuerpo: string): string {
	return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)}</title></head>
<body style="margin:0;padding:0;background:${GRIS};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${GRIS};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${HUESO};border-radius:14px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<tr><td style="padding:26px 28px 0;">
<span style="font-size:21px;font-weight:700;letter-spacing:-0.04em;color:${TINTA};">kustto</span>
</td></tr>
${cuerpo}
<tr><td style="padding:22px 28px 28px;border-top:1px solid rgba(43,40,18,0.10);">
<p style="margin:0;font-size:12px;line-height:18px;color:rgba(43,40,18,0.45);">
Personalización bajo demanda, hecha en México.<br>
¿Dudas? Responde a este correo y te contestamos.
</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function boton(url: string, texto: string): string {
	return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0 0;"><tr>
<td style="background:${TINTA};border-radius:9px;">
<a href="${esc(url)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#aeff6e;text-decoration:none;">${esc(texto)}</a>
</td></tr></table>`;
}

const P = `margin:0 0 12px;font-size:15px;line-height:24px;color:${TINTA};`;

/* ─── 1 · Al comprador, cuando hace el pedido ───────────────────────────── */

/**
 * EL CORREO MÁS IMPORTANTE DE LOS TRES.
 *
 * Lleva el enlace de seguimiento, y ese enlace es lo ÚNICO que da acceso al
 * pedido a quien pidió sin cuenta: del token sólo se guarda su huella, así que
 * si se pierde no hay forma de devolvérselo, ni por soporte. Antes de esto el
 * enlace sólo aparecía en pantalla y cerrar la pestaña bastaba para perderlo.
 */
export function pedidoRecibido(datos: {
	para: string;
	nombre: string;
	folio: string;
	enlace: string;
	total: number;
	piezas: number;
	producto: string;
	dias?: number | null;
}): Correo {
	const url = `${SITIO}${datos.enlace}`;

	const texto = [
		`Hola ${datos.nombre},`,
		"",
		`Recibimos tu pedido #${datos.folio}. El taller ya lo tiene.`,
		"",
		`${datos.producto} · ${datos.piezas} ${datos.piezas === 1 ? "pieza" : "piezas"}`,
		`Total: ${pesos(datos.total)}`,
		datos.dias ? `Producción estimada: ${datos.dias} días` : "",
		"",
		"Sigue tu pedido aquí:",
		url,
		"",
		"GUARDA ESTE CORREO: ese enlace es la única forma de ver tu pedido si",
		"no tienes cuenta con nosotros.",
	]
		.filter((l) => l !== "")
		.join("\n");

	const html = envoltorio(
		`Pedido #${datos.folio} recibido`,
		`<tr><td style="padding:20px 28px 0;">
<h1 style="margin:0 0 14px;font-size:23px;line-height:30px;font-weight:700;letter-spacing:-0.02em;color:${TINTA};">
Recibimos tu pedido</h1>
<p style="${P}">Hola ${esc(datos.nombre)}, el taller ya tiene tu pedido
<strong>#${esc(datos.folio)}</strong> y se pone con él.</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 0;background:${GRIS};border-radius:10px;">
<tr><td style="padding:14px 16px;">
<p style="margin:0;font-size:15px;line-height:22px;color:${TINTA};"><strong>${esc(datos.producto)}</strong></p>
<p style="margin:2px 0 0;font-size:14px;line-height:21px;color:rgba(43,40,18,0.65);">
${datos.piezas} ${datos.piezas === 1 ? "pieza" : "piezas"} · ${pesos(datos.total)}${
			datos.dias ? ` · ~${datos.dias} días de producción` : ""
		}</p>
</td></tr></table>

${boton(url, "Seguir mi pedido")}

<p style="margin:16px 0 0;font-size:13px;line-height:20px;color:rgba(43,40,18,0.6);">
<strong>Guarda este correo.</strong> Ese enlace es la única forma de entrar a tu
pedido si no tienes cuenta con nosotros.</p>
</td></tr>`,
	);

	return {
		para: datos.para,
		asunto: `Recibimos tu pedido #${datos.folio}`,
		texto,
		html,
	};
}

/* ─── 2 · Al taller, cuando entra un pedido ─────────────────────────────── */

/**
 * El taller sólo se enteraba si tenía el panel abierto: el aviso en vivo va
 * por WebSocket y muere con la pestaña. Un pedido que entra un viernes por la
 * tarde esperaba al lunes.
 */
export function pedidoParaTaller(datos: {
	para: string;
	taller: string;
	folio: string;
	piezas: number;
	producto: string;
	total: number;
	metodo: string;
}): Correo {
	const url = `${SITIO}/proveedor`;

	const texto = [
		`Entró el pedido #${datos.folio}.`,
		"",
		`${datos.producto} · ${datos.piezas} ${datos.piezas === 1 ? "pieza" : "piezas"}`,
		`Importe: ${pesos(datos.total)}`,
		datos.metodo === "recoger"
			? "El cliente lo recoge contigo."
			: "Lleva envío a domicilio.",
		"",
		"Ábrelo en tu panel para ver el arte y los datos:",
		url,
	].join("\n");

	const html = envoltorio(
		`Pedido #${datos.folio}`,
		`<tr><td style="padding:20px 28px 0;">
<h1 style="margin:0 0 14px;font-size:23px;line-height:30px;font-weight:700;letter-spacing:-0.02em;color:${TINTA};">
Tienes un pedido nuevo</h1>
<p style="${P}">${esc(datos.taller)}, entró el pedido
<strong>#${esc(datos.folio)}</strong>.</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 0;background:${GRIS};border-radius:10px;">
<tr><td style="padding:14px 16px;">
<p style="margin:0;font-size:15px;line-height:22px;color:${TINTA};"><strong>${esc(datos.producto)}</strong></p>
<p style="margin:2px 0 0;font-size:14px;line-height:21px;color:rgba(43,40,18,0.65);">
${datos.piezas} ${datos.piezas === 1 ? "pieza" : "piezas"} · ${pesos(datos.total)} · ${
			datos.metodo === "recoger" ? "lo recoge el cliente" : "con envío"
		}</p>
</td></tr></table>

${boton(url, "Abrir el pedido")}

<p style="margin:16px 0 0;font-size:13px;line-height:20px;color:rgba(43,40,18,0.6);">
En el panel están el arte listo para producir, las tallas y la dirección.</p>
</td></tr>`,
	);

	return {
		para: datos.para,
		asunto: `Pedido nuevo #${datos.folio} · ${datos.piezas} ${datos.piezas === 1 ? "pieza" : "piezas"}`,
		texto,
		html,
	};
}

/* ─── 3 · Al comprador, cuando el taller termina ────────────────────────── */

/**
 * "Ya está hecho".
 *
 * De producción NO se avisa, y es deliberado: entre `nuevo` y `listo` no hay
 * nada que el comprador pueda hacer, y un correo que no pide nada ni cambia
 * nada enseña a ignorar los que sí importan. Este sí: con `recoger` es la
 * señal de ir por él —lleva la dirección del taller— y con envío es el aviso
 * de que la espera pasa a manos de la paquetería.
 *
 * Por eso el texto se bifurca. Un "tu pedido está listo" idéntico para los dos
 * mandaría a la mitad de la gente a esperar en casa algo que tiene que ir a
 * recoger, o a la otra mitad a presentarse en un taller que ya lo despachó.
 */
export function pedidoListo(datos: {
	para: string;
	nombre: string;
	folio: string;
	producto: string;
	piezas: number;
	metodo: "envio" | "recoger";
	/** Sólo con `recoger`: dónde y con quién. */
	taller?: string | null;
	direccion?: string | null;
	whatsapp?: string | null;
}): Correo {
	const recoge = datos.metodo === "recoger";

	const dondeTexto = recoge
		? [
				datos.taller ? `Lo tiene ${datos.taller}.` : "",
				datos.direccion ? `Dirección: ${datos.direccion}` : "",
				datos.whatsapp
					? `Escríbeles antes de ir para acordar la hora: ${datos.whatsapp}`
					: "Escríbenos si quieres acordar una hora antes de ir.",
			].filter((l) => l !== "")
		: [
				"En cuanto la paquetería lo recoja te mandamos el número de rastreo",
				"para que lo sigas.",
			];

	const texto = [
		`Hola ${datos.nombre},`,
		"",
		recoge
			? `Tu pedido #${datos.folio} ya está terminado y puedes pasar por él.`
			: `Tu pedido #${datos.folio} ya está terminado y sale del taller.`,
		"",
		`${datos.producto} · ${datos.piezas} ${datos.piezas === 1 ? "pieza" : "piezas"}`,
		"",
		...dondeTexto,
	].join("\n");

	const dondeHtml = recoge
		? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 0;background:${GRIS};border-radius:10px;">
<tr><td style="padding:14px 16px;">
<p style="margin:0;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:rgba(43,40,18,0.45);">Pasa por él</p>
${datos.taller ? `<p style="margin:5px 0 0;font-size:15px;line-height:22px;color:${TINTA};"><strong>${esc(datos.taller)}</strong></p>` : ""}
${datos.direccion ? `<p style="margin:2px 0 0;font-size:14px;line-height:21px;color:rgba(43,40,18,0.65);">${esc(datos.direccion)}</p>` : ""}
${datos.whatsapp ? `<p style="margin:8px 0 0;font-size:14px;line-height:21px;color:rgba(43,40,18,0.65);">Acuerda la hora al <strong style="color:${TINTA};">${esc(datos.whatsapp)}</strong></p>` : ""}
</td></tr></table>`
		: `<p style="margin:14px 0 0;font-size:13px;line-height:20px;color:rgba(43,40,18,0.6);">
En cuanto la paquetería lo recoja te mandamos el número de rastreo para que lo
sigas.</p>`;

	const html = envoltorio(
		`Tu pedido #${datos.folio} está listo`,
		`<tr><td style="padding:20px 28px 0;">
<h1 style="margin:0 0 14px;font-size:23px;line-height:30px;font-weight:700;letter-spacing:-0.02em;color:${TINTA};">
${recoge ? "Ya puedes pasar por él" : "Tu pedido ya está hecho"}</h1>
<p style="${P}">Hola ${esc(datos.nombre)}, el taller terminó tu pedido
<strong>#${esc(datos.folio)}</strong>.</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 14px;background:${GRIS};border-radius:10px;">
<tr><td style="padding:14px 16px;">
<p style="margin:0;font-size:15px;line-height:22px;color:${TINTA};"><strong>${esc(datos.producto)}</strong></p>
<p style="margin:2px 0 0;font-size:14px;line-height:21px;color:rgba(43,40,18,0.65);">
${datos.piezas} ${datos.piezas === 1 ? "pieza" : "piezas"}</p>
</td></tr></table>

${dondeHtml}
</td></tr>`,
	);

	return {
		para: datos.para,
		asunto: recoge
			? `Tu pedido #${datos.folio} ya está listo para recoger`
			: `Tu pedido #${datos.folio} ya está hecho`,
		texto,
		html,
	};
}

/* ─── 4 · Al comprador, cuando el paquete sale ──────────────────────────── */

/**
 * NO LLEVA ENLACE DE SEGUIMIENTO NUESTRO, y no es un olvido: del token sólo
 * guardamos la huella, así que aquí ya no se puede reconstruir. Quien pidió
 * sin cuenta lo tiene en el correo de confirmación; el de aquí lleva lo que
 * de verdad hace falta en este momento —el número y el enlace de la
 * paquetería— y para quien sí tenga cuenta, el acceso a sus pedidos.
 */
export function pedidoEnviado(datos: {
	para: string;
	nombre: string;
	folio: string;
	paqueteria: string;
	rastreo: string;
	rastreoUrl?: string | null;
}): Correo {
	const texto = [
		`Hola ${datos.nombre},`,
		"",
		`Tu pedido #${datos.folio} ya va en camino con ${datos.paqueteria}.`,
		"",
		`Número de rastreo: ${datos.rastreo}`,
		datos.rastreoUrl ? `Sigue el paquete: ${datos.rastreoUrl}` : "",
		"",
		"El rastreo lo actualiza la paquetería y puede tardar unas horas en",
		"mostrar movimiento después de la recolección.",
	]
		.filter((l) => l !== "")
		.join("\n");

	const html = envoltorio(
		`Tu pedido #${datos.folio} va en camino`,
		`<tr><td style="padding:20px 28px 0;">
<h1 style="margin:0 0 14px;font-size:23px;line-height:30px;font-weight:700;letter-spacing:-0.02em;color:${TINTA};">
Tu pedido va en camino</h1>
<p style="${P}">Hola ${esc(datos.nombre)}, el pedido
<strong>#${esc(datos.folio)}</strong> salió del taller con
<strong>${esc(datos.paqueteria)}</strong>.</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 0;background:${GRIS};border-radius:10px;">
<tr><td style="padding:14px 16px;">
<p style="margin:0;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:rgba(43,40,18,0.45);">Número de rastreo</p>
<p style="margin:3px 0 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:18px;font-weight:600;color:${TINTA};">${esc(datos.rastreo)}</p>
</td></tr></table>

${datos.rastreoUrl ? boton(datos.rastreoUrl, "Ver dónde va") : ""}

<p style="margin:16px 0 0;font-size:13px;line-height:20px;color:rgba(43,40,18,0.6);">
El rastreo lo actualiza la paquetería y puede tardar unas horas en mostrar
movimiento después de la recolección.</p>
</td></tr>`,
	);

	return {
		para: datos.para,
		asunto: `Tu pedido #${datos.folio} va en camino`,
		texto,
		html,
	};
}

/* ─── 5 · Al comprador, cuando llega ────────────────────────────────────── */

/**
 * El que cierra.
 *
 * Es el único momento en que preguntar algo no molesta: la prenda ya está en
 * sus manos. También es la última oportunidad de enterarnos de que llegó mal
 * antes de que el cliente se resigne y no vuelva.
 *
 * `entregado` lo pone la paquetería por webhook cuando hubo envío, y el taller
 * a mano cuando el cliente recogió. El texto se bifurca por eso: "te llegó" a
 * quien no estuvo ahí, "lo recogiste" a quien fue en persona.
 */
export function pedidoEntregado(datos: {
	para: string;
	nombre: string;
	folio: string;
	producto: string;
	metodo: "envio" | "recoger";
}): Correo {
	const recogio = datos.metodo === "recoger";

	const texto = [
		`Hola ${datos.nombre},`,
		"",
		recogio
			? `Damos por recogido tu pedido #${datos.folio}. Gracias por pasar.`
			: `Tu pedido #${datos.folio} aparece como entregado.`,
		"",
		datos.producto,
		"",
		"Si algo no llegó como esperabas, responde a este correo y lo vemos.",
		"Tienes hasta 7 días para reportarlo.",
		"",
		`Vuelve cuando quieras: ${SITIO}`,
	].join("\n");

	const html = envoltorio(
		`Tu pedido #${datos.folio} llegó`,
		`<tr><td style="padding:20px 28px 0;">
<h1 style="margin:0 0 14px;font-size:23px;line-height:30px;font-weight:700;letter-spacing:-0.02em;color:${TINTA};">
${recogio ? "Gracias por pasar" : "Tu pedido llegó"}</h1>
<p style="${P}">Hola ${esc(datos.nombre)}, damos por
${recogio ? "recogido" : "entregado"} el pedido
<strong>#${esc(datos.folio)}</strong>.</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 0;background:${GRIS};border-radius:10px;">
<tr><td style="padding:14px 16px;">
<p style="margin:0;font-size:15px;line-height:22px;color:${TINTA};"><strong>${esc(datos.producto)}</strong></p>
</td></tr></table>

${boton(SITIO, "Hacer otro")}

<p style="margin:16px 0 0;font-size:13px;line-height:20px;color:rgba(43,40,18,0.6);">
¿Algo no llegó como esperabas? Responde a este correo y lo vemos. Tienes 7 días
para reportarlo.</p>
</td></tr>`,
	);

	return {
		para: datos.para,
		asunto: recogio
			? `Gracias por recoger tu pedido #${datos.folio}`
			: `Tu pedido #${datos.folio} llegó`,
		texto,
		html,
	};
}
