/**
 * Puebla la base con catálogo de prueba: plantillas, categorías, productos
 * (con sus mockups, colores, tallas, áreas de impresión y precios) y paquetes.
 *
 *   DATABASE_URL=postgresql://ppcustom:ppcustom123@localhost:5432/ppcustom_db \
 *     node packages/db/seed.mjs
 *
 * Es idempotente: borra el catálogo anterior y lo vuelve a escribir. No toca
 * usuarios, sesiones ni proveedores.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

/* ─── Identificadores estables ────────────────────────────────────────────
   Los ids salen del slug y no de gen_random_uuid(): así volver a poblar no
   rompe los enlaces que ya tenías abiertos. */
const NS = Buffer.from("1b671a6440d5491e99b0da01ff1f3341", "hex");

function uuidDe(clave) {
	const bytes = createHash("sha1")
		.update(Buffer.concat([NS, Buffer.from(clave, "utf8")]))
		.digest()
		.subarray(0, 16);

	bytes[6] = (bytes[6] & 0x0f) | 0x50; // versión 5
	bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante RFC 4122

	const h = bytes.toString("hex");
	return [
		h.slice(0, 8),
		h.slice(8, 12),
		h.slice(12, 16),
		h.slice(16, 20),
		h.slice(20),
	].join("-");
}

const AQUI = dirname(fileURLToPath(import.meta.url));
const MOCKUPS = join(AQUI, "../../apps/web/public/productsMockup");

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://ppcustom:ppcustom123@localhost:5432/ppcustom_db";

/* ─── Plantillas ──────────────────────────────────────────────────────────
   Salen de apps/web/public/productsMockup/*.json, que es lo que el editor
   ya usa para dibujar el mockup y el área editable. */
const PLANTILLAS = ["tshirt", "cap", "thermo", "glass", "glasses"].map((id) =>
	JSON.parse(readFileSync(join(MOCKUPS, `${id}.json`), "utf8")),
);

/* ─── Categorías ─────────────────────────────────────────────────────────
   Solo hay categoría donde hay plantilla: si no, el producto no se podría
   diseñar en el editor. */
const CATEGORIAS = [
	{
		clave: "playeras",
		name: "Playeras",
		description: "Cuello redondo, oversize y manga larga, listas para imprimir.",
		image: "/products/tshirt.png",
	},
	{
		clave: "gorras",
		name: "Gorras",
		description: "Snapback, trucker y deportivas, para bordado o vinil.",
		image: "/products/cap.png",
	},
	{
		clave: "termos",
		name: "Termos",
		description: "De 600 ml a 1 litro, en acero con grabado láser.",
		image: "/products/thermo2.png",
	},
	{
		clave: "vasos",
		name: "Vasos",
		description: "Vasos con tapa y sets, para sublimación.",
		image: "/products/vaso2.png",
	},
];

const TALLAS_ROPA = [
	{ size: "S", widthIn: 18, lengthIn: 27 },
	{ size: "M", widthIn: 20, lengthIn: 28 },
	{ size: "L", widthIn: 22, lengthIn: 29 },
	{ size: "XL", widthIn: 24, lengthIn: 30 },
];

const TALLA_UNICA = [{ size: "U", widthIn: 0, lengthIn: 0 }];

/* ─── Productos ──────────────────────────────────────────────────────────
   precio en pesos enteros: es como lo pinta el front hoy
   (`Desde $${basePrice.toLocaleString()}`). */
const PRODUCTOS = [
	// Playeras
	{
		slug: "playera-cuello-redondo",
		sku: "PLY-001",
		name: "Playera cuello redondo",
		description: "Algodón 180 g, unisex. Bordado o serigrafía.",
		categoria: "playeras",
		plantilla: "tshirt",
		imagen: "/products/tshirt.png",
		precio: 189,
		proveedor: "Textiles del Bajío",
		tecnica: "bordado",
		dias: 7,
		colores: [
			{ name: "Hueso", hex: "#fffdf8" },
			{ name: "Negro", hex: "#1a1a17" },
			{ name: "Lima", hex: "#a5f35c" },
		],
		tallas: TALLAS_ROPA,
	},
	{
		slug: "playera-oversize",
		sku: "PLY-002",
		name: "Playera oversize",
		description: "Corte holgado, algodón pesado 220 g. Impresión DTG.",
		categoria: "playeras",
		plantilla: "tshirt",
		imagen: "/products/tshirt.png",
		precio: 229,
		proveedor: "Serigrafía Norte",
		tecnica: "DTG",
		dias: 8,
		colores: [
			{ name: "Hueso", hex: "#fffdf8" },
			{ name: "Arena", hex: "#d9cfbb" },
		],
		tallas: TALLAS_ROPA,
	},
	{
		slug: "playera-manga-larga",
		sku: "PLY-003",
		name: "Playera manga larga",
		description: "Manga larga con puño. Ideal para uniformes de equipo.",
		categoria: "playeras",
		plantilla: "tshirt",
		imagen: "/products/tshirt.png",
		precio: 249,
		proveedor: "Textiles del Bajío",
		tecnica: "serigrafía",
		dias: 9,
		colores: [
			{ name: "Negro", hex: "#1a1a17" },
			{ name: "Marino", hex: "#1b2b4b" },
		],
		tallas: TALLAS_ROPA,
	},
	{
		slug: "playera-algodon-peinado",
		sku: "PLY-004",
		name: "Playera de algodón peinado",
		description: "Tejido suave, cae recto. La más pedida para graduaciones.",
		categoria: "playeras",
		plantilla: "tshirt",
		imagen: "/products/tshirt.png",
		precio: 205,
		proveedor: "Punto y Trama",
		tecnica: "serigrafía",
		dias: 7,
		colores: [
			{ name: "Blanco", hex: "#ffffff" },
			{ name: "Lavanda", hex: "#c9b8ff" },
		],
		tallas: TALLAS_ROPA,
	},

	// Gorras
	{
		slug: "gorra-snapback",
		sku: "GOR-001",
		name: "Gorra snapback",
		description: "Visera plana, cierre ajustable. Bordado al frente.",
		categoria: "gorras",
		plantilla: "cap",
		imagen: "/products/cap.png",
		precio: 245,
		proveedor: "Bordados Tapatíos",
		tecnica: "bordado",
		dias: 6,
		colores: [
			{ name: "Negro", hex: "#1a1a17" },
			{ name: "Caqui", hex: "#a8977c" },
		],
		tallas: TALLA_UNICA,
	},
	{
		slug: "gorra-trucker",
		sku: "GOR-002",
		name: "Gorra trucker",
		description: "Malla trasera, frente de algodón. Fresca para exteriores.",
		categoria: "gorras",
		plantilla: "cap",
		imagen: "/products/cap.png",
		precio: 215,
		proveedor: "Bordados Tapatíos",
		tecnica: "bordado",
		dias: 10,
		colores: [
			{ name: "Negro", hex: "#1a1a17" },
			{ name: "Lima", hex: "#a5f35c" },
		],
		tallas: TALLA_UNICA,
	},
	{
		slug: "gorra-deportiva",
		sku: "GOR-003",
		name: "Gorra deportiva",
		description: "Visera curva, tela ligera. Vinil textil o bordado.",
		categoria: "gorras",
		plantilla: "cap",
		imagen: "/products/cap.png",
		precio: 189,
		proveedor: "Serigrafía Norte",
		tecnica: "vinil textil",
		dias: 5,
		colores: [{ name: "Blanco", hex: "#ffffff" }],
		tallas: TALLA_UNICA,
	},

	// Termos
	{
		slug: "termo-600-ml",
		sku: "TER-001",
		name: "Termo 600 ml",
		description: "Acero inoxidable de doble pared. Grabado láser.",
		categoria: "termos",
		plantilla: "thermo",
		imagen: "/products/thermo2.png",
		precio: 310,
		proveedor: "Metales Querétaro",
		tecnica: "grabado láser",
		dias: 12,
		colores: [
			{ name: "Acero", hex: "#b9bec4" },
			{ name: "Negro", hex: "#1a1a17" },
		],
		tallas: TALLA_UNICA,
	},
	{
		slug: "termo-1-litro",
		sku: "TER-002",
		name: "Termo 1 litro",
		description: "Boca ancha, mantiene frío 24 h. Sublimación a todo color.",
		categoria: "termos",
		plantilla: "thermo",
		imagen: "/products/thermo2.png",
		precio: 389,
		proveedor: "Metales Querétaro",
		tecnica: "sublimación",
		dias: 16,
		colores: [{ name: "Blanco", hex: "#ffffff" }],
		tallas: TALLA_UNICA,
	},
	{
		slug: "termo-con-asa",
		sku: "TER-003",
		name: "Termo con asa",
		description: "Con asa lateral y tapa de rosca. Para oficina o campo.",
		categoria: "termos",
		plantilla: "thermo",
		imagen: "/products/thermo2.png",
		precio: 345,
		proveedor: "Promo Industrial MX",
		tecnica: "grabado láser",
		dias: 11,
		colores: [
			{ name: "Marino", hex: "#1b2b4b" },
			{ name: "Acero", hex: "#b9bec4" },
		],
		tallas: TALLA_UNICA,
	},

	// Vasos
	{
		slug: "vaso-con-tapa",
		sku: "VAS-001",
		name: "Vaso con tapa",
		description: "Vaso térmico de 500 ml con tapa deslizable.",
		categoria: "vasos",
		plantilla: "glass",
		imagen: "/products/vaso2.png",
		precio: 165,
		proveedor: "Promo Industrial MX",
		tecnica: "sublimación",
		dias: 8,
		colores: [{ name: "Blanco", hex: "#ffffff" }],
		tallas: TALLA_UNICA,
	},
	{
		slug: "vaso-termico-chico",
		sku: "VAS-002",
		name: "Vaso térmico chico",
		description: "350 ml, cabe en cualquier portavasos. Grabado láser.",
		categoria: "vasos",
		plantilla: "glass",
		imagen: "/products/vaso2.png",
		precio: 198,
		proveedor: "Metales Querétaro",
		tecnica: "grabado láser",
		dias: 7,
		colores: [
			{ name: "Acero", hex: "#b9bec4" },
			{ name: "Negro", hex: "#1a1a17" },
		],
		tallas: TALLA_UNICA,
	},
	{
		slug: "set-de-dos-vasos",
		sku: "VAS-003",
		name: "Set de 2 vasos",
		description: "Par de vasos con diseño independiente en cada uno.",
		categoria: "vasos",
		plantilla: "glasses",
		imagen: "/products/vaso2.png",
		precio: 289,
		proveedor: "Promo Industrial MX",
		tecnica: "sublimación",
		dias: 9,
		colores: [{ name: "Blanco", hex: "#ffffff" }],
		tallas: TALLA_UNICA,
	},
	{
		slug: "vaso-de-viaje",
		sku: "VAS-004",
		name: "Vaso de viaje",
		description: "Con tapa antiderrames, para llevar en el coche.",
		categoria: "vasos",
		plantilla: "glass",
		imagen: "/products/vaso2.png",
		precio: 225,
		proveedor: "Promo Industrial MX",
		tecnica: "sublimación",
		dias: 10,
		colores: [{ name: "Arena", hex: "#d9cfbb" }],
		tallas: TALLA_UNICA,
	},
	{
		slug: "playera-cuello-v",
		sku: "PLY-005",
		name: "Playera cuello V",
		description: "Escote en V, corte entallado. Algodón 165 g.",
		categoria: "playeras",
		plantilla: "tshirt",
		imagen: "/products/tshirt.png",
		precio: 195,
		proveedor: "Punto y Trama",
		tecnica: "DTG",
		dias: 6,
		colores: [
			{ name: "Blanco", hex: "#ffffff" },
			{ name: "Negro", hex: "#1a1a17" },
		],
		tallas: TALLAS_ROPA,
	},
	{
		slug: "gorra-de-lona",
		sku: "GOR-004",
		name: "Gorra de lona",
		description: "Lona lavada con visera pre-curvada. Acabado vintage.",
		categoria: "gorras",
		plantilla: "cap",
		imagen: "/products/cap.png",
		precio: 265,
		proveedor: "Bordados Tapatíos",
		tecnica: "bordado",
		dias: 18,
		colores: [{ name: "Caqui", hex: "#a8977c" }],
		tallas: TALLA_UNICA,
	},
	{
		slug: "termo-de-bolsillo",
		sku: "TER-004",
		name: "Termo de bolsillo",
		description: "350 ml, delgado, cabe en la mochila.",
		categoria: "termos",
		plantilla: "thermo",
		imagen: "/products/thermo2.png",
		precio: 275,
		proveedor: "Promo Industrial MX",
		tecnica: "grabado láser",
		dias: 15,
		colores: [{ name: "Acero", hex: "#b9bec4" }],
		tallas: TALLA_UNICA,
	},
	{
		slug: "vaso-para-cafe",
		sku: "VAS-005",
		name: "Vaso para café",
		description: "250 ml con banda antitérmica. Sublimación completa.",
		categoria: "vasos",
		plantilla: "glass",
		imagen: "/products/vaso2.png",
		precio: 149,
		proveedor: "Serigrafía Norte",
		tecnica: "sublimación",
		dias: 5,
		colores: [{ name: "Blanco", hex: "#ffffff" }],
		tallas: TALLA_UNICA,
	},
];

/* ─── Paquetes ───────────────────────────────────────────────────────── */
const CATEGORIAS_PAQUETE = [
	{
		clave: "eventos",
		name: "eventos",
		description: "Combos para graduaciones, bodas y eventos especiales.",
	},
	{
		clave: "empresariales",
		name: "empresariales",
		description: "Soluciones para equipos, oficinas y marcas.",
	},
];

const PAQUETES = [
	{
		name: "Kit de boda",
		description:
			"Totes y playeras para invitados, con el diseño de los novios.",
		image: "/event2.png",
		categoria: "eventos",
		precio: 4890,
		items: [
			{ slug: "playera-cuello-redondo", cantidad: 30 },
			{ slug: "vaso-con-tapa", cantidad: 30 },
		],
	},
	{
		name: "Kit de graduación",
		description: "Generación, escuela y nombres, en pedidos de grupo.",
		image: "/event.png",
		categoria: "eventos",
		precio: 6250,
		items: [
			{ slug: "playera-algodon-peinado", cantidad: 40 },
			{ slug: "gorra-snapback", cantidad: 40 },
		],
	},
	{
		name: "Uniforme de equipo",
		description: "Playeras con tu logo, en tallas surtidas por persona.",
		image: "/business.png",
		categoria: "empresariales",
		precio: 3980,
		items: [
			{ slug: "playera-manga-larga", cantidad: 20 },
			{ slug: "gorra-deportiva", cantidad: 20 },
		],
	},
	{
		name: "Kit de bienvenida",
		description: "Playera, termo y vaso para quien entra al equipo.",
		image: "/products/thermo2.png",
		categoria: "empresariales",
		precio: 1290,
		items: [
			{ slug: "playera-oversize", cantidad: 1 },
			{ slug: "termo-600-ml", cantidad: 1 },
			{ slug: "vaso-termico-chico", cantidad: 1 },
		],
	},
];

/* ─── Ejecución ──────────────────────────────────────────────────────── */

const cliente = new pg.Client({ connectionString: DATABASE_URL });
await cliente.connect();

try {
	await cliente.query("BEGIN");

	// Limpiar solo el catálogo. Las FK con ON DELETE CASCADE se encargan de
	// imágenes, precios, colores, tallas y lados.
	await cliente.query(`
    TRUNCATE TABLE
      package_category_items, package_items, package_pricing, packages,
      package_categories, product_categories, products, categories,
      product_templates
    RESTART IDENTITY CASCADE
  `);

	// Plantillas
	for (const t of PLANTILLAS) {
		await cliente.query(
			`INSERT INTO product_templates (id, name, data) VALUES ($1, $2, $3)`,
			[
				t.id,
				t.name,
				JSON.stringify({
					sides: t.sides,
					sideLabels: t.sideLabels,
					mockups: t.mockups,
					editableAreas: t.editableAreas,
				}),
			],
		);
	}
	console.log(`plantillas: ${PLANTILLAS.length}`);

	// Categorías
	const idCategoria = new Map();
	for (const c of CATEGORIAS) {
		const { rows } = await cliente.query(
			`INSERT INTO categories (id, name, description, image) VALUES ($1, $2, $3, $4) RETURNING id`,
			[uuidDe(`categoria:${c.clave}`), c.name, c.description, c.image],
		);
		idCategoria.set(c.clave, rows[0].id);
	}
	console.log(`categorías: ${CATEGORIAS.length}`);

	// Productos
	const plantillaPorId = new Map(PLANTILLAS.map((t) => [t.id, t]));
	const idProducto = new Map();

	for (const p of PRODUCTOS) {
		const plantilla = plantillaPorId.get(p.plantilla);
		if (!plantilla) throw new Error(`sin plantilla: ${p.plantilla}`);

		const datosPlantilla = {
			sides: plantilla.sides,
			sideLabels: plantilla.sideLabels,
			mockups: plantilla.mockups,
			editableAreas: plantilla.editableAreas,
		};

		const { rows } = await cliente.query(
			`INSERT INTO products
         (id, slug, sku, internal_name, name, description, brand, status,
          template_id, product_template_data, is_customizable)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $9, true)
       RETURNING id`,
			[
				uuidDe(`producto:${p.slug}`),
				p.slug,
				p.sku,
				p.name,
				p.name,
				p.description,
				"kustto",
				p.plantilla,
				JSON.stringify(datosPlantilla),
			],
		);
		const productoId = rows[0].id;
		idProducto.set(p.slug, productoId);

		// La foto primero y luego los mockups de la plantilla: son las vistas
		// que el escaparate ofrece como miniaturas.
		const imagenes = [
			p.imagen,
			...plantilla.sides
				.map((lado) => plantilla.mockups?.[lado])
				.filter(Boolean),
		];

		for (const [orden, url] of imagenes.entries()) {
			await cliente.query(
				`INSERT INTO product_images (product_id, url, "order") VALUES ($1, $2, $3)`,
				[productoId, url, orden],
			);
		}

		await cliente.query(
			`INSERT INTO product_pricing
         (product_id, base_price, per_side_price, per_design_price, per_color_price, embroidery_extra)
       VALUES ($1, $2, $3, $4, $5, $6)`,
			[productoId, p.precio, 35, 25, 15, 45],
		);

		for (const color of p.colores) {
			await cliente.query(
				`INSERT INTO product_colors (product_id, name, hex) VALUES ($1, $2, $3)`,
				[productoId, color.name, color.hex],
			);
		}

		for (const talla of p.tallas) {
			await cliente.query(
				`INSERT INTO product_sizes (product_id, size, width_in, length_in) VALUES ($1, $2, $3, $4)`,
				[productoId, talla.size, talla.widthIn, talla.lengthIn],
			);
		}

		// Un lado de impresión por cada lado de la plantilla.
		for (const lado of plantilla.sides) {
			await cliente.query(
				`INSERT INTO product_print_sides (product_id, side_key, width_cm, height_cm, dpi, enabled)
         VALUES ($1, $2, $3, $4, 300, true)`,
				[productoId, lado, 28, 35],
			);
		}

		await cliente.query(
			`INSERT INTO product_production (product_id, provider, provider_sku, meta)
       VALUES ($1, $2, $3, $4)`,
			[
				productoId,
				p.proveedor,
				`${p.sku}-PROV`,
				JSON.stringify({ tecnica: p.tecnica, diasProduccion: p.dias }),
			],
		);

		await cliente.query(
			`INSERT INTO product_customization_rules (product_id, rules) VALUES ($1, $2)`,
			[
				productoId,
				JSON.stringify({
					maxDesigns: 2,
					allowText: true,
					allowImages: true,
					maxColorsPerDesign: 4,
				}),
			],
		);

		await cliente.query(
			`INSERT INTO product_categories (product_id, category_id) VALUES ($1, $2)`,
			[productoId, idCategoria.get(p.categoria)],
		);
	}
	console.log(`productos: ${PRODUCTOS.length}`);

	// Categorías de paquete
	const idCategoriaPaquete = new Map();
	for (const c of CATEGORIAS_PAQUETE) {
		const { rows } = await cliente.query(
			`INSERT INTO package_categories (id, name, description) VALUES ($1, $2, $3) RETURNING id`,
			[uuidDe(`categoria-paquete:${c.clave}`), c.name, c.description],
		);
		idCategoriaPaquete.set(c.clave, rows[0].id);
	}

	// Paquetes
	for (const p of PAQUETES) {
		const { rows } = await cliente.query(
			`INSERT INTO packages (id, name, description, categories, image, status)
       VALUES ($1, $2, $3, $4, $5, 'active') RETURNING id`,
			[
				uuidDe(`paquete:${p.name}`),
				p.name,
				p.description,
				[p.categoria],
				p.image,
			],
		);
		const paqueteId = rows[0].id;

		await cliente.query(
			`INSERT INTO package_pricing (package_id, base_price, discount_percentage)
       VALUES ($1, $2, 10)`,
			[paqueteId, p.precio],
		);

		for (const item of p.items) {
			const productoId = idProducto.get(item.slug);
			if (!productoId) throw new Error(`sin producto: ${item.slug}`);

			await cliente.query(
				`INSERT INTO package_items (package_id, product_id, quantity, design_required)
         VALUES ($1, $2, $3, true)`,
				[paqueteId, productoId, item.cantidad],
			);
		}

		await cliente.query(
			`INSERT INTO package_category_items (package_id, category_id) VALUES ($1, $2)`,
			[paqueteId, idCategoriaPaquete.get(p.categoria)],
		);
	}
	console.log(`paquetes: ${PAQUETES.length}`);

	await cliente.query("COMMIT");
	console.log("listo");
} catch (error) {
	await cliente.query("ROLLBACK");
	console.error("falló el seed, no se escribió nada:", error.message);
	process.exitCode = 1;
} finally {
	await cliente.end();
}
