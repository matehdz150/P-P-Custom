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
 *
 * TAMPOCO HAY TIPOGRAFÍA DE MARCA. Figtree y Poppins no se pueden cargar en
 * un correo —Outlook ignora las webfonts—, así que la marca la sostienen el
 * color, el espacio y el tono.
 *
 * VAN EN OSCURO, sobre tinta. No es una variante: es el correo. Por eso se
 * declara `color-scheme: dark`, para que los clientes que invierten solos no
 * lo "arreglen" a claro y rompan el contraste que se buscó.
 */

/* ─── El sistema ─────────────────────────────────────────────────────────── */

/** El fondo de la página: tinta bajada, para que la tarjeta se despegue. */
const FONDO = "#1b1a0c";
const TINTA = "#2b2812";
/** Tinta levantada. Es la superficie de las fichas dentro de la tarjeta. */
const SUPERFICIE = "#39351b";
const LIMA = "#aeff6e";
const LAVANDA = "#c9b8ff";
const HUESO = "#fffdf8";

/* Los apagados van en hexadecimal y no en rgba: Outlook renderiza con Word y
   la transparencia le sale a manchas. Son el hueso mezclado con la tinta. */
const SUAVE = "#b9b5a4";
const TENUE = "#847f6b";
const BORDE = "#453f22";

const FUENTE =
	"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const P = `margin:0 0 14px;font-size:15px;line-height:24px;color:${SUAVE};`;

/**
 * El marco común.
 *
 * `preheader` es lo que se lee en la bandeja DESPUÉS del asunto, y era lo que
 * más faltaba: sin él, Gmail rellena ese hueco con lo primero que encuentre en
 * el cuerpo —o sea la palabra "kustto"— y desperdicia la única línea que
 * decide si alguien abre. Va oculto y seguido de espacios de ancho cero para
 * que el cliente no siga arrastrando texto detrás.
 *
 * La cabecera es una BANDA LIMA con el logo en tinta. Es lo primero que se ve
 * y lo que hace que el correo se reconozca antes de leerlo; en oscuro, un
 * logotipo claro sobre fondo oscuro se pierde entre el resto del texto.
 */
function envoltorio(
	titulo: string,
	preheader: string,
	cuerpo: string,
): string {
	return `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${esc(titulo)}</title>
</head>
<body style="margin:0;padding:0;background:${FONDO};-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0;">${esc(preheader)}${"&#8199;&#65279;&#847; ".repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${FONDO}" style="background:${FONDO};padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${TINTA}" style="max-width:560px;background:${TINTA};border-radius:18px;overflow:hidden;font-family:${FUENTE};">

<tr><td bgcolor="${LIMA}" style="background:${LIMA};padding:16px 32px;">
<span style="font-size:21px;font-weight:700;letter-spacing:-0.045em;color:${TINTA};">kustto</span>
</td></tr>

${cuerpo}

<tr><td style="padding:24px 32px 30px;border-top:1px solid ${BORDE};">
<p style="margin:0;font-size:12px;line-height:19px;color:${TENUE};font-family:${FUENTE};">
Personalización bajo demanda, hecha en México.<br>
¿Dudas? <strong style="color:${SUAVE};font-weight:600;">Responde a este correo</strong> y te contestamos.
</p>
</td></tr>

</table>
</td></tr></table>
</body></html>`;
}

/**
 * El titular, con un antetítulo en lima.
 *
 * El antetítulo hace el trabajo que en el sitio hacen los pesos de Figtree:
 * en dos palabras dice de qué va el correo antes de que se lea el titular,
 * y con la tipografía del sistema esa jerarquía no se puede conseguir sólo
 * con tamaños.
 */
function encabezado(
	antetitulo: string,
	titulo: string,
	entrada: string,
	acento = LIMA,
): string {
	return `<tr><td style="padding:28px 32px 0;font-family:${FUENTE};">
<p style="margin:0 0 8px;font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${acento};">${antetitulo}</p>
<h1 style="margin:0 0 12px;font-size:29px;line-height:35px;font-weight:700;letter-spacing:-0.035em;color:${HUESO};">${titulo}</h1>
<p style="${P}">${entrada}</p>
</td></tr>`;
}

/**
 * Dónde va el pedido, en cuatro tramos.
 *
 * Es lo que más levanta el correo de una lista de datos: en un vistazo se ve
 * el camino entero y en qué punto está, sin leer. Hecho con celdas y bloques
 * de color en vez de una imagen, porque las imágenes llegan bloqueadas por
 * defecto en media bandeja y un progreso que no se ve no sirve de nada.
 *
 * Los tramos pasados van en lima apagado y el actual en lima: si todos
 * fueran iguales habría que contar para saber dónde estás.
 */
function progreso(activo: number, recoge: boolean): string {
	const tramos = [
		"Recibido",
		"Producción",
		recoge ? "Listo" : "En camino",
		recoge ? "Recogido" : "Entregado",
	];

	const celdas = tramos
		.map((nombre, i) => {
			const hecho = i < activo;
			const aqui = i === activo;
			const color = aqui ? LIMA : hecho ? "#6d8f47" : BORDE;
			return `<td width="25%" style="padding:0 3px 0 0;">
<div style="height:5px;background:${color};border-radius:3px;font-size:0;line-height:0;">&nbsp;</div>
<p style="margin:8px 0 0;font-family:${FUENTE};font-size:11px;line-height:14px;letter-spacing:0.02em;color:${aqui ? HUESO : TENUE};font-weight:${aqui ? "700" : "400"};">${nombre}</p>
</td>`;
		})
		.join("");

	return `<tr><td style="padding:22px 32px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${celdas}</tr></table>
</td></tr>`;
}

/**
 * El dato grande.
 *
 * Un folio o un número de rastreo en cuerpo 15 obliga a buscarlo; puesto en
 * grande, ES el correo. Va sobre la superficie levantada para que se lea como
 * una placa y no como un párrafo suelto.
 */
function destacado(etiqueta: string, valor: string, pie?: string): string {
	return `<tr><td style="padding:22px 32px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${SUPERFICIE}" style="background:${SUPERFICIE};border-radius:14px;">
<tr><td align="center" style="padding:20px 18px;font-family:${FUENTE};">
<p style="margin:0 0 6px;font-size:11px;line-height:15px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${TENUE};">${etiqueta}</p>
<p style="margin:0;font-size:30px;line-height:36px;font-weight:700;letter-spacing:-0.02em;color:${LIMA};">${valor}</p>
${pie ? `<p style="margin:8px 0 0;font-size:13px;line-height:19px;color:${SUAVE};">${pie}</p>` : ""}
</td></tr></table>
</td></tr>`;
}

/**
 * Los datos, en pares etiqueta/valor.
 *
 * En dos columnas y no en una frase corrida: quien abre esto ya sabe qué
 * compró y busca UN dato. Alineados, el ojo lo encuentra sin leer.
 */
function ficha(filas: [string, string][], titulo?: string): string {
	const cuerpo = filas
		.map(
			([etiqueta, valor], i) => `<tr>
<td style="padding:${i === 0 ? "0" : "10px"} 12px 0 0;font-size:13px;line-height:20px;color:${TENUE};white-space:nowrap;vertical-align:top;">${etiqueta}</td>
<td style="padding:${i === 0 ? "0" : "10px"} 0 0;font-size:14px;line-height:20px;color:${HUESO};font-weight:600;text-align:right;">${valor}</td>
</tr>`,
		)
		.join("");

	return `<tr><td style="padding:18px 32px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${SUPERFICIE}" style="background:${SUPERFICIE};border-radius:14px;">
<tr><td style="padding:18px 20px;font-family:${FUENTE};">
${titulo ? `<p style="margin:0 0 14px;padding:0 0 12px;border-bottom:1px solid ${BORDE};font-size:16px;line-height:22px;font-weight:700;color:${HUESO};">${titulo}</p>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${cuerpo}</table>
</td></tr></table>
</td></tr>`;
}

/**
 * El botón, en lima con texto tinta.
 *
 * Invertido respecto al sitio a propósito: sobre oscuro, un botón oscuro
 * desaparece. Es una tabla con `bgcolor` y no un `<a>` con padding porque
 * Outlook ignora el padding de los enlaces y el botón sale del tamaño del
 * texto.
 */
function boton(url: string, texto: string): string {
	return `<tr><td style="padding:22px 32px 0;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td bgcolor="${LIMA}" style="background:${LIMA};border-radius:10px;">
<a href="${esc(url)}" style="display:inline-block;padding:14px 30px;font-family:${FUENTE};font-size:15px;font-weight:700;color:${TINTA};text-decoration:none;">${esc(texto)}</a>
</td></tr></table>
</td></tr>`;
}

/** La letra chica. Con barra de acento cuando hay que hacerle caso. */
function nota(html: string, acento?: string): string {
	if (!acento) {
		return `<tr><td style="padding:18px 32px 0;font-family:${FUENTE};">
<p style="margin:0;font-size:13px;line-height:20px;color:${TENUE};">${html}</p>
</td></tr>`;
	}

	return `<tr><td style="padding:20px 32px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${SUPERFICIE}" style="background:${SUPERFICIE};border-radius:0 12px 12px 0;border-left:3px solid ${acento};">
<tr><td style="padding:14px 16px;font-family:${FUENTE};">
<p style="margin:0;font-size:13px;line-height:20px;color:${SUAVE};">${html}</p>
</td></tr></table>
</td></tr>`;
}

/** Cierra el cuerpo con aire antes del pie. */
const FIN = `<tr><td style="height:10px;line-height:10px;">&nbsp;</td></tr>`;

/** Las piezas, en singular o plural, que se repite en los cinco. */
const piezas = (n: number) => `${n} ${n === 1 ? "pieza" : "piezas"}`;

/* ─── 1 · Al comprador, cuando hace el pedido ───────────────────────────── */

/**
 * EL CORREO MÁS IMPORTANTE DE LOS CINCO.
 *
 * Lleva el enlace de seguimiento, y ese enlace es lo ÚNICO que da acceso al
 * pedido a quien pidió sin cuenta: del token sólo se guarda su huella, así que
 * si se pierde no hay forma de devolvérselo, ni por soporte. Antes de esto el
 * enlace sólo aparecía en pantalla y cerrar la pestaña bastaba para perderlo.
 *
 * Por eso el "guarda este correo" va acentuado y no en letra gris al final:
 * es la única instrucción del correo que tiene consecuencias si se ignora.
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
		`${datos.producto}`,
		`${piezas(datos.piezas)} · ${pesos(datos.total)}`,
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
		"Aquí está tu enlace de seguimiento — guárdalo.",
		encabezado(
			"Pedido confirmado",
			"Ya está en el taller",
			`Hola ${esc(datos.nombre)}, tu pedido entró y el taller se pone con él.`,
		) +
			destacado(
				"Tu folio",
				`#${esc(datos.folio)}`,
				datos.dias ? `Listo en ~${datos.dias} días` : undefined,
			) +
			progreso(0, false) +
			ficha(
				[
					["Cantidad", piezas(datos.piezas)],
					["Total", pesos(datos.total)],
				],
				esc(datos.producto),
			) +
			boton(url, "Seguir mi pedido") +
			nota(
				`<strong style="color:${HUESO};">Guarda este correo.</strong> Ese enlace es la única forma de entrar a tu pedido si no tienes cuenta con nosotros.`,
				LIMA,
			) +
			FIN,
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
 *
 * Éste es una herramienta de trabajo, no un correo de marca: lo que importa
 * es que en la bandeja se lea cuánto es y de qué, sin abrirlo. De ahí el
 * asunto con las piezas y el preheader con el producto.
 *
 * Va en LAVANDA en vez de lima, que es el otro acento de la marca: el taller
 * recibe los suyos mezclados con los del cliente si usa el mismo correo, y a
 * un golpe de vista se distinguen.
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
	const recoge = datos.metodo === "recoger";
	const entrega = recoge ? "Lo recoge el cliente" : "Se envía por paquetería";

	const texto = [
		`Hola ${datos.taller},`,
		"",
		`Entró el pedido #${datos.folio}.`,
		"",
		`${datos.producto}`,
		`${piezas(datos.piezas)} · ${pesos(datos.total)}`,
		entrega,
		"",
		"Los archivos de producción y los datos de entrega están en tu panel:",
		url,
	].join("\n");

	const html = envoltorio(
		`Pedido nuevo #${datos.folio}`,
		`${piezas(datos.piezas)} de ${datos.producto} · ${pesos(datos.total)}`,
		encabezado(
			"Trabajo nuevo",
			"Entró un pedido",
			`Hola ${esc(datos.taller)}, tienes algo que producir.`,
			LAVANDA,
		) +
			destacado("Pedido", `#${esc(datos.folio)}`, `${piezas(datos.piezas)}`) +
			ficha(
				[
					["Entrega", entrega],
					["Te toca", pesos(datos.total)],
				],
				esc(datos.producto),
			) +
			boton(url, "Ver el pedido") +
			nota(
				"En el panel están los archivos listos para imprimir, con sus medidas y su resolución.",
			) +
			FIN,
	);

	return {
		para: datos.para,
		asunto: `Pedido nuevo #${datos.folio} · ${piezas(datos.piezas)}`,
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
	metodo: string;
	taller?: string | null;
	direccion?: string | null;
	whatsapp?: string | null;
}): Correo {
	const recoge = datos.metodo === "recoger";

	const texto = [
		`Hola ${datos.nombre},`,
		"",
		recoge
			? `Tu pedido #${datos.folio} ya está listo para que lo recojas.`
			: `Tu pedido #${datos.folio} ya está hecho y va camino a la paquetería.`,
		"",
		`${datos.producto} · ${piezas(datos.piezas)}`,
		"",
		...(recoge
			? [
					datos.taller ? `Recógelo en ${datos.taller}` : "",
					datos.direccion ?? "",
					datos.whatsapp ? `WhatsApp: ${datos.whatsapp}` : "",
					"",
					"Escríbeles antes de ir para acordar la hora.",
				]
			: ["Te avisamos otra vez en cuanto salga, con el número de rastreo."]),
	]
		.filter((l) => l !== "")
		.join("\n");

	const filas: [string, string][] = [
		["Folio", `#${esc(datos.folio)}`],
		["Cantidad", piezas(datos.piezas)],
	];
	if (recoge && datos.whatsapp) filas.push(["WhatsApp", esc(datos.whatsapp)]);

	const html = envoltorio(
		recoge ? "Listo para recoger" : "Tu pedido ya está hecho",
		recoge
			? "Pásate por él cuando quieras — dentro va la dirección."
			: "Ahora pasa a la paquetería. Te avisamos cuando salga.",
		encabezado(
			recoge ? "Listo para recoger" : "Producción terminada",
			recoge ? "Ya puedes recogerlo" : "Tu pedido ya está hecho",
			recoge
				? `Hola ${esc(datos.nombre)}, el taller terminó y te lo tiene guardado.`
				: `Hola ${esc(datos.nombre)}, el taller terminó y ahora pasa a la paquetería.`,
		) +
			(recoge && datos.taller
				? destacado("Recógelo en", esc(datos.taller), esc(datos.direccion ?? ""))
				: destacado("Tu folio", `#${esc(datos.folio)}`)) +
			progreso(2, recoge) +
			ficha(filas, esc(datos.producto)) +
			(recoge
				? nota(
						"Escríbeles antes de ir para acordar la hora: así no te encuentras la cortina abajo.",
						LIMA,
					)
				: nota(
						"Te escribimos otra vez en cuanto salga, con el número para rastrearlo.",
					)) +
			FIN,
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
 *
 * El número de rastreo va EN GRANDE y en el preheader: es el dato que la
 * gente busca, y aquí se puede copiar sin buscarlo.
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
		`Tu pedido #${datos.folio} va en camino.`,
		"",
		`Paquetería: ${datos.paqueteria}`,
		`Número de rastreo: ${datos.rastreo}`,
		datos.rastreoUrl ? `Rastréalo aquí: ${datos.rastreoUrl}` : "",
		"",
		"Los tiempos los pone la paquetería; nosotros ya cumplimos nuestra parte.",
	]
		.filter((l) => l !== "")
		.join("\n");

	const html = envoltorio(
		`Pedido #${datos.folio} en camino`,
		`${datos.paqueteria} · rastreo ${datos.rastreo}`,
		encabezado(
			"En camino",
			"Tu paquete salió",
			`Hola ${esc(datos.nombre)}, tu pedido dejó el taller y ya lo tiene la paquetería.`,
		) +
			destacado(
				`Rastreo · ${esc(datos.paqueteria)}`,
				esc(datos.rastreo),
				`Pedido #${esc(datos.folio)}`,
			) +
			progreso(2, false) +
			(datos.rastreoUrl
				? boton(datos.rastreoUrl, "Rastrear mi paquete")
				: boton(`${SITIO}/cuenta`, "Ver mis pedidos")) +
			nota(
				"A partir de aquí los tiempos los pone la paquetería. Si algo se atora, respóndenos y lo vemos.",
			) +
			FIN,
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
 * Es el único que puede pedir algo sin resultar pesado, porque llega cuando la
 * persona tiene la prenda en la mano: por eso lleva la invitación a diseñar
 * otra vez, y ninguno de los anteriores.
 */
export function pedidoEntregado(datos: {
	para: string;
	nombre: string;
	folio: string;
	producto: string;
	metodo: string;
}): Correo {
	const recogio = datos.metodo === "recoger";

	const texto = [
		`Hola ${datos.nombre},`,
		"",
		recogio
			? `Tu pedido #${datos.folio} ya está en tus manos.`
			: `Tu pedido #${datos.folio} llegó.`,
		"",
		`${datos.producto}`,
		"",
		"Si algo no salió como esperabas, responde a este correo y lo resolvemos.",
		"",
		`¿Otra idea? ${SITIO}/catalogo`,
	].join("\n");

	const html = envoltorio(
		recogio ? "Ya lo tienes" : "Tu pedido llegó",
		"Si algo no salió como esperabas, respóndenos.",
		encabezado(
			"Entregado",
			recogio ? "Ya lo tienes" : "Tu pedido llegó",
			`Hola ${esc(datos.nombre)}, ${
				recogio ? "gracias por pasar por él" : "esperamos que te haya gustado"
			}.`,
		) +
			progreso(3, recogio) +
			ficha(
				[["Folio", `#${esc(datos.folio)}`]],
				esc(datos.producto),
			) +
			nota(
				`<strong style="color:${HUESO};">¿Algo no salió bien?</strong> Responde a este correo. Lo lee una persona y lo resolvemos.`,
				LIMA,
			) +
			boton(`${SITIO}/catalogo`, "Diseñar otra cosa") +
			FIN,
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
