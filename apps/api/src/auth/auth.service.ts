import {
	ConflictException,
	Injectable,
	UnauthorizedException,
} from "@nestjs/common";
import { db } from "../db/connection";
import { users, accounts, sessions } from "../../../../packages/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import {
	newRefreshToken,
	REFRESH_TTL_DAYS,
	sha256,
	signAccessToken,
} from "./tokens";

export type IssuedTokens = {
	accessToken: string;
	refreshToken: string;
};

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

@Injectable()
export class AuthService {
	// Emite access token (sin estado, 15min) + refresh token (rotativo, 7d)
	private async issueTokens(userId: string): Promise<IssuedTokens> {
		const { token: refreshToken, hash } = newRefreshToken();

		const expires = new Date();
		expires.setDate(expires.getDate() + REFRESH_TTL_DAYS);

		await db.insert(sessions).values({
			userId,
			refreshTokenHash: hash,
			expiresAt: expires,
		});

		return {
			accessToken: signAccessToken(userId),
			refreshToken,
		};
	}

	// Rota el refresh token: invalida el viejo y emite uno nuevo
	async refresh(refreshToken?: string): Promise<IssuedTokens> {
		if (!refreshToken) throw new UnauthorizedException();

		const hash = sha256(refreshToken);
		const session = await db.query.sessions.findFirst({
			where: eq(sessions.refreshTokenHash, hash),
		});

		if (!session || session.revokedAt || session.expiresAt < new Date()) {
			throw new UnauthorizedException();
		}

		// invalida el refresh actual (rotación)
		await db
			.update(sessions)
			.set({ revokedAt: new Date() })
			.where(eq(sessions.id, session.id));

		return this.issueTokens(session.userId);
	}

	async getUser(userId: string) {
		const user = await db.query.users.findFirst({
			where: eq(users.id, userId),
			columns: { id: true, email: true, name: true },
		});
		return user ?? null;
	}

	async register(data: { email: string; password: string; name?: string }) {
		const email = data.email.trim().toLowerCase();

		const existing = await db.query.users.findFirst({
			where: eq(users.email, email),
		});
		if (existing) {
			throw new ConflictException("Ya existe una cuenta con ese correo");
		}

		const [user] = await db
			.insert(users)
			.values({
				email,
				name: data.name,
				passwordHash: hashPassword(data.password),
			})
			.returning();

		return this.issueTokens(user.id);
	}

	async loginEmail(email: string, password: string) {
		const user = await db.query.users.findFirst({
			where: eq(users.email, email.trim().toLowerCase()),
		});

		if (
			!user ||
			!user.passwordHash ||
			!verifyPassword(password, user.passwordHash)
		) {
			throw new UnauthorizedException("Correo o contraseña incorrectos");
		}

		return this.issueTokens(user.id);
	}
	async loginOAuth(data: {
		provider: string;
		providerAccountId: string;
		email?: string;
		name?: string;
	}) {
		if (!data.email) {
			throw new Error("Email requerido");
		}

		// 1. Buscar usuario
		let user = await db.query.users.findFirst({
			where: eq(users.email, data.email),
		});

		// 2. Crear usuario si no existe
		if (!user) {
			const [created] = await db
				.insert(users)
				.values({
					email: data.email,
					name: data.name,
				})
				.returning();

			user = created;

			await db.insert(accounts).values({
				userId: user.id,
				provider: data.provider,
				providerAccountId: data.providerAccountId,
			});
		}

		// 3. Emitir tokens
		return this.issueTokens(user.id);
	}

	async logout(refreshToken?: string) {
		if (!refreshToken) return;
		const hash = sha256(refreshToken);
		await db
			.update(sessions)
			.set({ revokedAt: new Date() })
			.where(eq(sessions.refreshTokenHash, hash));
	}
}
