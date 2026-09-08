/**
 * El corpus de imágenes con el que se mide la preparación de bordado.
 *
 * SON GENERADAS, Y ESO HAY QUE TENERLO PRESENTE AL LEER LOS RESULTADOS. Las
 * fotografías sintéticas —campos de color suavizados, degradados con grano— se
 * parecen a una fotografía en lo que aquí importa (el interior varía poco a
 * poco) pero no traen la suciedad de una cámara real: enfoque desigual, grano
 * ISO, aberración, recortes mal hechos. Un acierto sobre este corpus dice que
 * el algoritmo distingue tono continuo de arte plano; NO dice que acierte con
 * el catálogo de un cliente.
 *
 * Las cuatro reales del banco del láser se conservan tal cual y son las únicas
 * que no salen de aquí.
 *
 * CADA FIXTURE DECLARA LO QUE ESPERA Y POR QUÉ. `grafico` significa que debe
 * llegar al pipeline de geometría; `foto` que debe rechazarse antes de
 * cuantizar. Los `ambiguo` NO tienen respuesta correcta: están para ver dónde
 * cae la frontera, no para acertarlos.
 */

import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

declare const __dirname: string;
const aqui = __dirname;
const destino = path.join(aqui, "corpus");

export type Familia = "logo" | "ilustracion" | "foto" | "ambiguo";
export type Espera = "grafico" | "foto" | "ambiguo";

export type Fixture = {
	archivo: string;
	familia: Familia;
	espera: Espera;
	nota: string;
};

const fixtures: Fixture[] = [];

async function guardar(
	buffer: Buffer,
	archivo: string,
	familia: Familia,
	espera: Espera,
	nota: string,
) {
	await writeFile(path.join(destino, archivo), buffer);
	fixtures.push({ archivo, familia, espera, nota });
}

const svg = (ancho: number, alto: number, cuerpo: string) =>
	Buffer.from(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}">${cuerpo}</svg>`,
	);

/** Un generador pseudoaleatorio con semilla: el corpus tiene que ser idéntico. */
function aleatorio(semilla: number) {
	let s = semilla >>> 0;
	return () => {
		s = (s * 1664525 + 1013904223) >>> 0;
		return s / 4294967296;
	};
}

/**
 * Suma de octavas: una rejilla gruesa que manda y varias finas que la matizan.
 *
 * CON UNA SOLA REJILLA NO VALE. Se probó y sale un mosaico: el valor es
 * continuo pero su pendiente cambia de golpe en cada celda, y a simple vista
 * son cuadrados. Una fotografía tiene estructura a todas las escalas a la vez,
 * y eso es exactamente lo que hace la suma de octavas.
 */
function fractal(ancho: number, alto: number, semilla: number) {
	const capas = [
		{ celdas: 3, peso: 1 },
		{ celdas: 7, peso: 0.42 },
		{ celdas: 17, peso: 0.18 },
		{ celdas: 41, peso: 0.07 },
	].map((c, i) => ({
		peso: c.peso,
		campo: campoSuave(ancho, alto, c.celdas, semilla + i * 977),
	}));
	const total = capas.reduce((s, c) => s + c.peso, 0);
	return (x: number, y: number) =>
		capas.reduce((v, c) => v + c.campo(x, y) * c.peso, 0) / total;
}

/** Ruido suave por interpolación de una rejilla gruesa: la base de las fotos. */
function campoSuave(
	ancho: number,
	alto: number,
	celdas: number,
	semilla: number,
) {
	const rnd = aleatorio(semilla);
	const rejilla: number[] = [];
	const cols = celdas + 1;
	for (let i = 0; i < cols * cols; i++) rejilla.push(rnd());

	return (x: number, y: number) => {
		const fx = (x / ancho) * celdas;
		const fy = (y / alto) * celdas;
		const x0 = Math.min(celdas - 1, Math.floor(fx));
		const y0 = Math.min(celdas - 1, Math.floor(fy));
		const tx = fx - x0;
		const ty = fy - y0;
		// Suavizado de Hermite: sin él se ven las aristas de la rejilla y el
		// resultado parece un mosaico, no una fotografía.
		const sx = tx * tx * (3 - 2 * tx);
		const sy = ty * ty * (3 - 2 * ty);
		const a = rejilla[y0 * cols + x0];
		const b = rejilla[y0 * cols + x0 + 1];
		const c = rejilla[(y0 + 1) * cols + x0];
		const d = rejilla[(y0 + 1) * cols + x0 + 1];
		return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
	};
}

async function crudoAPng(
	datos: Uint8ClampedArray,
	ancho: number,
	alto: number,
) {
	return sharp(Buffer.from(datos.buffer as ArrayBuffer), {
		raw: { width: ancho, height: alto, channels: 4 },
	})
		.png()
		.toBuffer();
}

// ---------------------------------------------------------------- LOGOS

const MARCA = `<path d="M60 40h150a50 50 0 0 1 0 100H130v70H60z" />
	<path d="M60 100h95a10 10 0 0 0 0-20H60z" fill="#ffffff"/>`;
const ANILLO = `<circle cx="330" cy="130" r="80"/><circle cx="330" cy="130" r="34" fill="#ffffff"/>`;
const BARRAS = `<path d="M440 42h190v42H500v36h118v40H500v40h142v42H440z"/>`;

async function logos() {
	await guardar(
		await sharp(
			svg(700, 260, `<g fill="#111111">${MARCA}${ANILLO}${BARRAS}</g>`),
		)
			.flatten({ background: "#ffffff" })
			.png()
			.toBuffer(),
		"logo-bn-simple.png",
		"logo",
		"grafico",
		"dos tintas, fondo blanco",
	);

	await guardar(
		await sharp(
			svg(
				700,
				260,
				`<g fill="#0b3d91">${MARCA}</g><g fill="#c8102e">${ANILLO}</g><g fill="#f2a900">${BARRAS}</g>`,
			),
		)
			.flatten({ background: "#ffffff" })
			.png()
			.toBuffer(),
		"logo-multicolor.png",
		"logo",
		"grafico",
		"tres tintas planas",
	);

	await guardar(
		await sharp(
			svg(700, 260, `<g fill="#0b3d91">${MARCA}${ANILLO}${BARRAS}</g>`),
		)
			.png()
			.toBuffer(),
		"logo-alpha.png",
		"logo",
		"grafico",
		"fondo transparente",
	);

	await guardar(
		await sharp(
			svg(700, 260, `<g fill="#ffffff">${MARCA}${ANILLO}${BARRAS}</g>`),
		)
			.flatten({ background: "#0b3d91" })
			.png()
			.toBuffer(),
		"logo-fondo-color.png",
		"logo",
		"grafico",
		"tinta clara sobre fondo de color",
	);

	// Antialias fuerte: se rasteriza pequeño y se agranda con interpolación, que
	// es exactamente lo que le pasa a un logo que el comprador sube a baja
	// resolución y el editor escala.
	for (const [nombre, lado] of [
		["logo-antialias-suave.png", 220],
		["logo-antialias-fuerte.png", 120],
	] as const) {
		await guardar(
			await sharp(
				svg(700, 260, `<g fill="#111111">${MARCA}${ANILLO}${BARRAS}</g>`),
			)
				.flatten({ background: "#ffffff" })
				.resize(lado, null, { fit: "inside" })
				.resize(700, null, { fit: "inside", kernel: "cubic" })
				.png()
				.toBuffer(),
			nombre,
			"logo",
			"grafico",
			`reescalado desde ${lado}px`,
		);
	}

	for (const q of [30, 60, 90]) {
		await guardar(
			await sharp(
				svg(
					700,
					260,
					`<g fill="#0b3d91">${MARCA}</g><g fill="#c8102e">${ANILLO}</g><g fill="#f2a900">${BARRAS}</g>`,
				),
			)
				.flatten({ background: "#ffffff" })
				.jpeg({ quality: q })
				.toBuffer(),
			`logo-jpeg-q${q}.jpg`,
			"logo",
			"grafico",
			`JPEG calidad ${q}`,
		);
	}

	// Sombra: el diseño sigue siendo plano, pero arrastra una mancha difusa.
	for (const [nombre, desenfoque, opacidad] of [
		["logo-sombra-ligera.png", 6, 0.25],
		["logo-sombra-marcada.png", 14, 0.45],
	] as const) {
		const sombra = await sharp(
			svg(700, 260, `<g fill="#000000">${MARCA}${ANILLO}${BARRAS}</g>`),
		)
			.blur(desenfoque)
			.png()
			.toBuffer();
		const frente = await sharp(
			svg(700, 260, `<g fill="#0b3d91">${MARCA}${ANILLO}${BARRAS}</g>`),
		)
			.png()
			.toBuffer();
		await guardar(
			await sharp({
				create: {
					width: 700,
					height: 260,
					channels: 4,
					background: "#ffffff",
				},
			})
				.composite([
					{ input: sombra, left: 8, top: 8, blend: "over", opacity: opacidad },
					{ input: frente, blend: "over" },
				])
				.png()
				.toBuffer(),
			nombre,
			"logo",
			"grafico",
			`sombra desenfoque ${desenfoque}`,
		);
	}

	// Degradado ligero dentro de las formas: sigue siendo arte gráfico.
	for (const [nombre, hasta] of [
		["logo-gradiente-ligero.png", "#2a5fc0"],
		["logo-gradiente-medio.png", "#7fb2ff"],
	] as const) {
		await guardar(
			await sharp(
				svg(
					700,
					260,
					`<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
						<stop offset="0" stop-color="#0b3d91"/><stop offset="1" stop-color="${hasta}"/>
					</linearGradient></defs>
					<g fill="url(#g)">${MARCA}${ANILLO}${BARRAS}</g>`,
				),
			)
				.flatten({ background: "#ffffff" })
				.png()
				.toBuffer(),
			nombre,
			"logo",
			"grafico",
			`degradado interno hasta ${hasta}`,
		);
	}

	const palabras = [
		["wordmark-grueso.png", 92, 700, "#111111"],
		["wordmark-fino.png", 46, 700, "#111111"],
		["wordmark-pequeno.png", 24, 700, "#333333"],
	] as const;
	for (const [nombre, tam, ancho, color] of palabras) {
		await guardar(
			await sharp(
				svg(
					ancho,
					160,
					`<g fill="${color}">
						<rect x="40" y="${80 - tam / 2}" width="${tam * 0.18}" height="${tam}"/>
						<rect x="${40 + tam * 0.45}" y="${80 - tam / 2}" width="${tam * 0.18}" height="${tam}"/>
						<rect x="${40 + tam * 0.18}" y="${80 - tam * 0.09}" width="${tam * 0.27}" height="${tam * 0.18}"/>
						<circle cx="${60 + tam * 1.3}" cy="80" r="${tam * 0.42}"/>
						<circle cx="${60 + tam * 1.3}" cy="80" r="${tam * 0.22}" fill="#ffffff"/>
						<rect x="${60 + tam * 1.9}" y="${80 - tam / 2}" width="${tam * 0.18}" height="${tam}"/>
						<rect x="${60 + tam * 2.5}" y="${80 - tam / 2}" width="${tam * 0.6}" height="${tam * 0.18}"/>
						<rect x="${60 + tam * 2.5}" y="${80 - tam * 0.09}" width="${tam * 0.5}" height="${tam * 0.18}"/>
						<rect x="${60 + tam * 2.5}" y="${80 + tam * 0.32}" width="${tam * 0.6}" height="${tam * 0.18}"/>
					</g>`,
				),
			)
				.flatten({ background: "#ffffff" })
				.png()
				.toBuffer(),
			nombre,
			"logo",
			"grafico",
			`wordmark de ${tam}px`,
		);
	}

	// Escaneado: papel con grano, un poco de desenfoque y el negro deslavado.
	for (const [nombre, grano, desenfoque] of [
		["logo-escaneado-limpio.png", 6, 0.6],
		["logo-escaneado-sucio.png", 16, 1.4],
	] as const) {
		const base = await sharp(
			svg(700, 260, `<g fill="#1a1a1a">${MARCA}${ANILLO}${BARRAS}</g>`),
		)
			.flatten({ background: "#f4f1e8" })
			.blur(desenfoque)
			.raw()
			.toBuffer({ resolveWithObject: true });
		const rnd = aleatorio(7);
		const canales = base.info.channels;
		const total = base.info.width * base.info.height;
		// `flatten` deja tres canales, no cuatro: el destino se dimensiona por
		// píxeles y no por la longitud del origen.
		const datos = new Uint8ClampedArray(total * 4);
		for (let p = 0; p < total; p++) {
			const ruido = (rnd() - 0.5) * grano * 2;
			datos[p * 4] = base.data[p * canales] + ruido;
			datos[p * 4 + 1] = base.data[p * canales + 1] + ruido;
			datos[p * 4 + 2] = base.data[p * canales + 2] + ruido;
			datos[p * 4 + 3] = 255;
		}
		await guardar(
			await crudoAPng(datos, base.info.width, base.info.height),
			nombre,
			"logo",
			"grafico",
			`escaneado grano ${grano}`,
		);
	}
}

// --------------------------------------------------------- ILUSTRACIONES

function regiones(cuantas: number, semilla: number) {
	const rnd = aleatorio(semilla);
	const tintas = [
		"#1b4965",
		"#5fa8d3",
		"#cae9ff",
		"#f6ae2d",
		"#f26419",
		"#2f9c95",
	];
	const partes: string[] = [];
	for (let i = 0; i < cuantas; i++) {
		const x = 30 + rnd() * 600;
		const y = 30 + rnd() * 300;
		const w = 40 + rnd() * 120;
		const h = 40 + rnd() * 120;
		const tinta = tintas[Math.floor(rnd() * tintas.length)];
		partes.push(
			rnd() > 0.5
				? `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" rx="${(rnd() * 20).toFixed(0)}" fill="${tinta}"/>`
				: `<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${(w / 2).toFixed(0)}" ry="${(h / 2).toFixed(0)}" fill="${tinta}"/>`,
		);
	}
	return partes.join("");
}

async function ilustraciones() {
	for (const [nombre, cuantas, nota] of [
		["ilustracion-simple.png", 5, "cinco regiones planas"],
		["ilustracion-media.png", 14, "catorce regiones"],
		["ilustracion-compleja.png", 40, "cuarenta regiones"],
		["ilustracion-muy-compleja.png", 90, "noventa regiones"],
	] as const) {
		await guardar(
			await sharp(svg(700, 380, regiones(cuantas, 42)))
				.flatten({ background: "#ffffff" })
				.png()
				.toBuffer(),
			nombre,
			"ilustracion",
			"grafico",
			nota,
		);
	}

	// Clipart: contorno negro grueso y relleno plano, como el de una imprenta.
	const perfil = `<path d="M120 300c0-90 60-160 150-160s150 70 150 160z" />
		<circle cx="270" cy="120" r="70"/>`;
	await guardar(
		await sharp(
			svg(
				700,
				380,
				`<g fill="#f6ae2d" stroke="#111111" stroke-width="10">${perfil}</g>
				 <g fill="#2f9c95" stroke="#111111" stroke-width="10"><rect x="440" y="150" width="180" height="150" rx="18"/></g>`,
			),
		)
			.flatten({ background: "#ffffff" })
			.png()
			.toBuffer(),
		"clipart-contorno.png",
		"ilustracion",
		"grafico",
		"relleno plano con contorno grueso",
	);
	await guardar(
		await sharp(
			svg(
				700,
				380,
				`<g fill="#cae9ff" stroke="#1b4965" stroke-width="4">${perfil}${regiones(10, 9)}</g>`,
			),
		)
			.flatten({ background: "#ffffff" })
			.png()
			.toBuffer(),
		"clipart-fino.png",
		"ilustracion",
		"grafico",
		"contorno fino y muchas piezas",
	);

	// Cartoon: formas planas con un par de sombras duras, sin degradados.
	await guardar(
		await sharp(
			svg(
				700,
				380,
				`<circle cx="300" cy="190" r="140" fill="#f6ae2d"/>
				 <path d="M300 50a140 140 0 0 1 0 280z" fill="#e08e12"/>
				 <circle cx="255" cy="150" r="22" fill="#111111"/>
				 <circle cx="345" cy="150" r="22" fill="#111111"/>
				 <path d="M235 240q65 55 130 0" stroke="#111111" stroke-width="14" fill="none"/>`,
			),
		)
			.flatten({ background: "#ffffff" })
			.png()
			.toBuffer(),
		"cartoon-plano.png",
		"ilustracion",
		"grafico",
		"cartoon de tintas planas",
	);
	await guardar(
		await sharp(
			svg(
				700,
				380,
				`<circle cx="300" cy="190" r="140" fill="#f6ae2d"/>
				 <circle cx="255" cy="150" r="22" fill="#111111"/>
				 <circle cx="345" cy="150" r="22" fill="#111111"/>
				 ${regiones(24, 3)}`,
			),
		)
			.flatten({ background: "#ffffff" })
			.png()
			.toBuffer(),
		"cartoon-detallado.png",
		"ilustracion",
		"grafico",
		"cartoon con muchos añadidos",
	);
}

// ------------------------------------------------------------- FOTOGRAFÍAS

/**
 * Una "fotografia": un sujeto iluminado sobre un fondo, con grano.
 *
 * NO ES UNA FOTOGRAFIA DE VERDAD y el informe tiene que decirlo. Reproduce lo
 * unico que aqui se mide —que el interior de las formas varia poco a poco en
 * vez de ser plano— con estructura a varias escalas y una caida de luz sobre el
 * sujeto. Lo que no trae es la suciedad de una camara: desenfoque desigual,
 * grano por canal, aberracion cromatica, recortes con halo.
 */
async function fotoSintetica(
	ancho: number,
	alto: number,
	semilla: number,
	opciones: {
		saturacion?: number;
		grano?: number;
		contraste?: number;
		fondoBlanco?: boolean;
		alpha?: boolean;
	} = {},
) {
	const forma = fractal(ancho, alto, semilla);
	const tono = fractal(ancho, alto, semilla + 5101);
	const frio = fractal(ancho, alto, semilla + 9203);
	const rnd = aleatorio(semilla + 999);
	const sat = opciones.saturacion ?? 1;
	const grano = opciones.grano ?? 4;
	const contraste = opciones.contraste ?? 1;

	const datos = new Uint8ClampedArray(ancho * alto * 4);
	const cx = ancho / 2;
	const cy = alto * 0.46;
	const rx = ancho * 0.34;
	const ry = alto * 0.42;

	for (let y = 0; y < alto; y++) {
		for (let x = 0; x < ancho; x++) {
			const i = (y * ancho + x) * 4;
			const u = (x - cx) / rx;
			const v = (y - cy) / ry;
			const r = Math.hypot(u, v);
			const dentro = r < 1;

			if ((opciones.fondoBlanco || opciones.alpha) && !dentro) {
				// Un fondo de estudio nunca es blanco puro: cae un poco a los lados.
				const caida = 250 - Math.min(18, (r - 1) * 22);
				datos[i] = caida;
				datos[i + 1] = caida;
				datos[i + 2] = caida + 2;
				datos[i + 3] = opciones.alpha ? 0 : 255;
				continue;
			}

			// Luz desde arriba a la izquierda, con la sombra propia del volumen.
			const luz = Math.max(0, 1 - Math.hypot(u + 0.45, v + 0.5) * 0.62);
			const base = forma(x, y) * 0.55 + luz * 0.45;
			const nivel = 122 + (base - 0.5) * 210 * contraste;
			const ruido = (rnd() - 0.5) * grano * 2;

			datos[i] = nivel + (tono(x, y) - 0.5) * 96 * sat + ruido;
			datos[i + 1] = nivel + (tono(x, y) - 0.5) * 40 * sat + ruido * 0.9;
			datos[i + 2] = nivel + (frio(x, y) - 0.5) * -84 * sat + ruido * 1.1;
			datos[i + 3] = 255;
		}
	}
	return { datos, ancho, alto };
}

async function fotografias() {
	const casos: Array<[string, Parameters<typeof fotoSintetica>[3], string]> = [
		["foto-retrato.png", { saturacion: 0.8, grano: 5 }, "campos suaves"],
		[
			"foto-producto-fondo-blanco.png",
			{ fondoBlanco: true, saturacion: 1 },
			"objeto sobre blanco",
		],
		["foto-con-alpha.png", { alpha: true, saturacion: 1 }, "recorte con alfa"],
		[
			"foto-alto-contraste.png",
			{ contraste: 1.8, grano: 6 },
			"mucho contraste",
		],
		[
			"foto-casi-monocroma.png",
			{ saturacion: 0.12, grano: 4 },
			"casi sin color",
		],
		["foto-fondo-simple.png", { fondoBlanco: true, grano: 2 }, "fondo liso"],
		["foto-grano-fuerte.png", { grano: 22 }, "grano alto"],
		["foto-suave.png", { grano: 1, contraste: 0.7 }, "muy suave"],
	];

	let semilla = 11;
	for (const [nombre, opciones, nota] of casos) {
		const { datos, ancho, alto } = await fotoSintetica(
			620,
			420,
			(semilla += 37),
			opciones,
		);
		await guardar(
			await crudoAPng(datos, ancho, alto),
			nombre,
			"foto",
			"foto",
			nota,
		);
	}

	// Las mismas, comprimidas: el JPEG añade bloques y debería seguir siendo foto.
	for (const q of [40, 75]) {
		const { datos, ancho, alto } = await fotoSintetica(620, 420, 501, {
			grano: 5,
		});
		await guardar(
			await sharp(Buffer.from(datos.buffer as ArrayBuffer), {
				raw: { width: ancho, height: alto, channels: 4 },
			})
				.jpeg({ quality: q })
				.toBuffer(),
			`foto-jpeg-q${q}.jpg`,
			"foto",
			"foto",
			`JPEG calidad ${q}`,
		);
	}

	// Degradados puros, sin grano: el caso más limpio de tono continuo.
	for (const [nombre, cuerpo] of [
		[
			"degradado-lineal.png",
			`<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
				<stop offset="0" stop-color="#0b3d91"/><stop offset="1" stop-color="#f6ae2d"/>
			</linearGradient></defs><rect width="700" height="380" fill="url(#g)"/>`,
		],
		[
			"degradado-radial.png",
			`<defs><radialGradient id="g"><stop offset="0" stop-color="#ffffff"/>
				<stop offset="1" stop-color="#1b4965"/></radialGradient></defs>
				<rect width="700" height="380" fill="url(#g)"/>`,
		],
		[
			"degradado-tres-paradas.png",
			`<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
				<stop offset="0" stop-color="#c8102e"/><stop offset="0.5" stop-color="#f6ae2d"/>
				<stop offset="1" stop-color="#2f9c95"/></linearGradient></defs>
				<rect width="700" height="380" fill="url(#g)"/>`,
		],
	] as const) {
		await guardar(
			await sharp(svg(700, 380, cuerpo))
				.png()
				.toBuffer(),
			nombre,
			"foto",
			"foto",
			"degradado puro",
		);
	}
}

// ---------------------------------------------------------------- AMBIGUOS

async function ambiguos() {
	// Logo con brillo: forma plana con un reflejo suave encima.
	for (const [nombre, fuerza] of [
		["ambiguo-logo-glossy-suave.png", 0.35],
		["ambiguo-logo-glossy-fuerte.png", 0.7],
	] as const) {
		await guardar(
			await sharp(
				svg(
					700,
					260,
					`<defs><linearGradient id="b" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0" stop-color="#ffffff" stop-opacity="${fuerza}"/>
						<stop offset="0.5" stop-color="#ffffff" stop-opacity="0"/>
						<stop offset="1" stop-color="#000000" stop-opacity="${fuerza * 0.6}"/>
					</linearGradient></defs>
					<g fill="#0b3d91">${MARCA}${ANILLO}${BARRAS}</g>
					<g fill="url(#b)">${MARCA}${ANILLO}${BARRAS}</g>`,
				),
			)
				.flatten({ background: "#ffffff" })
				.png()
				.toBuffer(),
			nombre,
			"ambiguo",
			"ambiguo",
			`brillo ${fuerza}`,
		);
	}

	// Fotografía posterizada: era tono continuo y ya no lo es.
	for (const niveles of [4, 8, 16]) {
		const { datos, ancho, alto } = await fotoSintetica(620, 420, 77, {
			grano: 2,
		});
		const paso = 256 / niveles;
		for (let i = 0; i < datos.length; i += 4) {
			datos[i] = Math.round(datos[i] / paso) * paso;
			datos[i + 1] = Math.round(datos[i + 1] / paso) * paso;
			datos[i + 2] = Math.round(datos[i + 2] / paso) * paso;
		}
		await guardar(
			await crudoAPng(datos, ancho, alto),
			`ambiguo-posterizada-${niveles}.png`,
			"ambiguo",
			"ambiguo",
			`foto reducida a ${niveles} niveles por canal`,
		);
	}

	// Pixel art: bloques duros, ampliados sin interpolar.
	for (const [nombre, lado, tintas] of [
		["ambiguo-pixelart-8.png", 8, 4],
		["ambiguo-pixelart-32.png", 32, 6],
	] as const) {
		const paleta = [
			[17, 17, 17],
			[246, 174, 45],
			[47, 156, 149],
			[200, 16, 46],
			[11, 61, 145],
			[255, 255, 255],
		];
		const rnd = aleatorio(5);
		const datos = new Uint8ClampedArray(lado * lado * 4);
		for (let i = 0; i < lado * lado; i++) {
			const c = paleta[Math.floor(rnd() * tintas)];
			datos[i * 4] = c[0];
			datos[i * 4 + 1] = c[1];
			datos[i * 4 + 2] = c[2];
			datos[i * 4 + 3] = 255;
		}
		await guardar(
			await sharp(Buffer.from(datos.buffer as ArrayBuffer), {
				raw: { width: lado, height: lado, channels: 4 },
			})
				.resize(640, 640, { kernel: "nearest" })
				.png()
				.toBuffer(),
			nombre,
			"ambiguo",
			"ambiguo",
			`rejilla de ${lado} ampliada sin interpolar`,
		);
	}

	// Acuarela: manchas suaves con bordes difusos.
	for (const [nombre, desenfoque] of [
		["ambiguo-acuarela-suave.png", 12],
		["ambiguo-acuarela-fuerte.png", 26],
	] as const) {
		await guardar(
			await sharp(svg(700, 380, regiones(9, 17)))
				.flatten({ background: "#ffffff" })
				.blur(desenfoque)
				.png()
				.toBuffer(),
			nombre,
			"ambiguo",
			"ambiguo",
			`manchas desenfocadas ${desenfoque}`,
		);
	}

	// Captura de pantalla: rectángulos planos, texto fino y degradados sutiles.
	await guardar(
		await sharp(
			svg(
				760,
				420,
				`<rect width="760" height="420" fill="#f7f8fa"/>
				 <rect width="760" height="56" fill="#ffffff"/>
				 <rect x="0" y="56" width="200" height="364" fill="#eef1f6"/>
				 ${Array.from({ length: 9 }, (_, i) => `<rect x="24" y="${84 + i * 34}" width="${120 - (i % 3) * 20}" height="10" rx="5" fill="#c3cad6"/>`).join("")}
				 <rect x="232" y="88" width="500" height="130" rx="10" fill="#ffffff" stroke="#e2e6ee"/>
				 ${Array.from({ length: 6 }, (_, i) => `<rect x="256" y="${112 + i * 18}" width="${420 - (i % 4) * 60}" height="8" rx="4" fill="#d5dbe5"/>`).join("")}
				 <rect x="232" y="240" width="240" height="150" rx="10" fill="#ffffff" stroke="#e2e6ee"/>
				 <rect x="492" y="240" width="240" height="150" rx="10" fill="#0b3d91"/>`,
			),
		)
			.png()
			.toBuffer(),
		"ambiguo-captura-interfaz.png",
		"ambiguo",
		"ambiguo",
		"interfaz plana con texto fino",
	);
	await guardar(
		await sharp(
			svg(
				760,
				420,
				`<defs><linearGradient id="h" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e7ecf5"/>
				</linearGradient></defs>
				<rect width="760" height="420" fill="url(#h)"/>
				<rect x="60" y="60" width="640" height="300" rx="16" fill="#ffffff" stroke="#dde3ee"/>
				${Array.from({ length: 10 }, (_, i) => `<rect x="90" y="${96 + i * 26}" width="${560 - (i % 5) * 70}" height="9" rx="4" fill="#cfd7e4"/>`).join("")}`,
			),
		)
			.png()
			.toBuffer(),
		"ambiguo-captura-degradada.png",
		"ambiguo",
		"ambiguo",
		"interfaz con fondo degradado",
	);

	// Vector rasterizado a alta resolución: gráfico purísimo, sin antialias casi.
	for (const [nombre, escala] of [
		["ambiguo-vector-alta.png", 1600],
		["ambiguo-vector-media.png", 900],
	] as const) {
		await guardar(
			await sharp(
				svg(
					700,
					260,
					`<g fill="#1b4965">${MARCA}</g><g fill="#f26419">${ANILLO}</g><g fill="#2f9c95">${BARRAS}</g>`,
				),
			)
				.resize(escala, null, { fit: "inside" })
				.flatten({ background: "#ffffff" })
				.png()
				.toBuffer(),
			nombre,
			"ambiguo",
			"ambiguo",
			`vector a ${escala}px`,
		);
	}
	await guardar(
		await sharp(
			svg(
				700,
				260,
				`<g fill="#1b4965">${MARCA}${ANILLO}${BARRAS}</g>
				 <g fill="#ffffff" opacity="0.15">${regiones(30, 21)}</g>`,
			),
		)
			.flatten({ background: "#ffffff" })
			.png()
			.toBuffer(),
		"ambiguo-vector-con-texturas.png",
		"ambiguo",
		"ambiguo",
		"vector con veladuras encima",
	);
}

// ------------------------------------------------ las reales del banco láser

const REALES: Array<[string, Familia, Espera, string]> = [
	["01-logo-color-alpha.png", "logo", "grafico", "Discovery Park, real"],
	["02-logo-color-sin-alpha.png", "logo", "grafico", "Discovery aplanado"],
	["03-logo-blanco-negro.png", "logo", "grafico", "logo b/n del banco láser"],
	["04-wordmark-texto-pequeno.png", "logo", "grafico", "wordmark del banco"],
	["05-icono-geometrico.png", "logo", "grafico", "icono del banco"],
	["06-ilustracion.png", "ilustracion", "grafico", "ilustración del banco"],
	["07-retrato.jpg", "foto", "foto", "retrato REAL"],
	["08-fotografia-alpha.png", "foto", "foto", "foto recortada REAL"],
	["09-degradados.png", "foto", "foto", "degradados REALES"],
	["10-jpeg-ruido-compresion.jpg", "foto", "foto", "JPEG ruidoso REAL"],
];

async function main() {
	await mkdir(destino, { recursive: true });
	await logos();
	await ilustraciones();
	await fotografias();
	await ambiguos();

	/* Las reales se COPIAN al corpus en vez de referenciarse con una ruta
	   relativa. Con la ruta, el banco las buscaba en un sitio que no existe y
	   perdía en silencio las diez únicas imágenes que no son generadas: los
	   casos que más valen del corpus salían del informe sin que se notara. */
	for (const [archivo, familia, espera, nota] of REALES) {
		const nombre = `real-${archivo}`;
		await copyFile(
			path.join(aqui, "../../vectorizacion-adaptativa/fixtures", archivo),
			path.join(destino, nombre),
		);
		fixtures.push({ archivo: nombre, familia, espera, nota });
	}

	await writeFile(
		path.join(destino, "manifiesto.json"),
		`${JSON.stringify(fixtures, null, 2)}\n`,
	);
	console.log(`${fixtures.length} fixtures`);
	for (const f of ["logo", "ilustracion", "foto", "ambiguo"] as const) {
		console.log(`  ${f}: ${fixtures.filter((x) => x.familia === f).length}`);
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
