import {
	ConflictException,
	Injectable,
	NotFoundException,
	UnauthorizedException,
} from "@nestjs/common";
import crypto from "crypto";
import { desc, eq } from "drizzle-orm";
import {
	products,
	providerSessions,
	providers,
} from "../../../../packages/db/schema";
import { db } from "../db/connection";

function hashPassword(password: string): string {
	const salt = crypto.randomBytes(16).toString("hex");
	const hash = crypto.scryptSync(password, salt, 64).toString("hex");
	return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
	const [salt, hash] = stored.split(":");
	if (!salt || !hash) return false;
	const calc = crypto.scryptSync(password, salt, 64).toString("hex");
	const a = Buffer.from(hash, "hex");
	const b = Buffer.from(calc, "hex");
	return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function slugify(s: string): string {
	return s
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 100);
}

const PUBLIC_COLUMNS = {
	id: true,
	email: true,
	name: true,
	slug: true,
	displayName: true,
	bio: true,
	avatarUrl: true,
	bannerUrl: true,
	createdAt: true,
} as const;

@Injectable()
export class ProvidersService {
	// ---- Admin: crear proveedor ----
	async createProvider(data: {
		email: string;
		password: string;
		name?: string;
	}) {
		const email = data.email.trim().toLowerCase();

		const existing = await db.query.providers.findFirst({
			where: eq(providers.email, email),
		});
		if (existing) {
			throw new ConflictException("Ya existe un proveedor con ese correo");
		}

		// slug único a partir del nombre o correo
		const baseSlug = slugify(data.name || email.split("@")[0]) || "proveedor";
		let slug = baseSlug;
		let n = 1;
		while (
			await db.query.providers.findFirst({
				where: eq(providers.slug, slug),
			})
		) {
			slug = `${baseSlug}-${n++}`;
		}

		const [created] = await db
			.insert(providers)
			.values({
				email,
				passwordHash: hashPassword(data.password),
				name: data.name,
				displayName: data.name,
				slug,
			})
			.returning({
				id: providers.id,
				email: providers.email,
				name: providers.name,
				slug: providers.slug,
				createdAt: providers.createdAt,
			});

		return created;
	}

	listProviders() {
		return db.query.providers.findMany({
			orderBy: desc(providers.createdAt),
			columns: {
				id: true,
				email: true,
				name: true,
				slug: true,
				createdAt: true,
			},
		});
	}

	// Actualizar perfil público (proveedor autenticado)
	async updateProfile(
		providerId: string,
		data: {
			displayName?: string;
			bio?: string;
			avatarUrl?: string;
			bannerUrl?: string;
			slug?: string;
		},
	) {
		const patch: Record<string, unknown> = {};
		if (data.displayName !== undefined) patch.displayName = data.displayName;
		if (data.bio !== undefined) patch.bio = data.bio;
		if (data.avatarUrl !== undefined) patch.avatarUrl = data.avatarUrl;
		if (data.bannerUrl !== undefined) patch.bannerUrl = data.bannerUrl;

		if (data.slug !== undefined) {
			const wanted = slugify(data.slug);
			if (!wanted) throw new ConflictException("Slug inválido");
			const clash = await db.query.providers.findFirst({
				where: eq(providers.slug, wanted),
			});
			if (clash && clash.id !== providerId) {
				throw new ConflictException("Ese slug ya está en uso");
			}
			patch.slug = wanted;
		}

		const [updated] = await db
			.update(providers)
			.set(patch)
			.where(eq(providers.id, providerId))
			.returning({
				id: providers.id,
				email: providers.email,
				name: providers.name,
				slug: providers.slug,
				displayName: providers.displayName,
				bio: providers.bio,
				avatarUrl: providers.avatarUrl,
				bannerUrl: providers.bannerUrl,
				createdAt: providers.createdAt,
			});

		return updated;
	}

	// Perfil público + productos activos
	async getPublicBySlug(slug: string) {
		const provider = await db.query.providers.findFirst({
			where: eq(providers.slug, slug),
			columns: PUBLIC_COLUMNS,
		});
		if (!provider) throw new NotFoundException("Proveedor no encontrado");

		const list = await db.query.products.findMany({
			where: eq(products.providerId, provider.id),
			orderBy: desc(products.createdAt),
			columns: { id: true, name: true, slug: true, status: true },
			with: { images: true, pricing: true },
		});

		return {
			provider,
			products: list.filter((p) => p.status === "active"),
		};
	}

	// ---- Login ----
	async login(email: string, password: string) {
		const provider = await db.query.providers.findFirst({
			where: eq(providers.email, email.trim().toLowerCase()),
		});

		if (!provider || !verifyPassword(password, provider.passwordHash)) {
			throw new UnauthorizedException("Correo o contraseña incorrectos");
		}

		const token = crypto.randomUUID();
		const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

		const expires = new Date();
		expires.setDate(expires.getDate() + 7);

		await db.insert(providerSessions).values({
			providerId: provider.id,
			refreshTokenHash: tokenHash,
			expiresAt: expires,
		});

		return { token };
	}

	async logout(token: string) {
		const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
		await db
			.update(providerSessions)
			.set({ revokedAt: new Date() })
			.where(eq(providerSessions.refreshTokenHash, tokenHash));
	}

	// ---- Resolver proveedor desde la cookie ----
	async resolveFromToken(token?: string) {
		if (!token) throw new UnauthorizedException();

		const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

		const session = await db.query.providerSessions.findFirst({
			where: eq(providerSessions.refreshTokenHash, tokenHash),
		});

		if (!session || session.revokedAt || session.expiresAt < new Date()) {
			throw new UnauthorizedException();
		}

		const provider = await db.query.providers.findFirst({
			where: eq(providers.id, session.providerId),
			columns: PUBLIC_COLUMNS,
		});

		if (!provider) throw new UnauthorizedException();
		return provider;
	}

	listProductsByProvider(providerId: string) {
		return db.query.products.findMany({
			where: eq(products.providerId, providerId),
			orderBy: desc(products.createdAt),
			with: { images: true, pricing: true },
		});
	}
}
