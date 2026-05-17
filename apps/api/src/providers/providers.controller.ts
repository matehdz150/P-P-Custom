import {
	Body,
	Controller,
	Get,
	Inject,
	Param,
	Patch,
	Post,
	Req,
	Res,
	UnauthorizedException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { ProductsService } from "../products/products.service";
import type { CreateProductDto } from "../products/dto/create_product_dto";
import { ProvidersService } from "./providers.service";

type ReqWithCookies = Request & { cookies: { provider_session?: string } };

@Controller("providers")
export class ProvidersController {
	constructor(
		@Inject(ProvidersService)
		private readonly providersService: ProvidersService,
		@Inject(ProductsService)
		private readonly productsService: ProductsService,
	) {}

	// ---- Admin ----
	@Post()
	create(
		@Body() dto: { email: string; password: string; name?: string },
	) {
		return this.providersService.createProvider(dto);
	}

	@Get()
	list() {
		return this.providersService.listProviders();
	}

	// ---- Auth proveedor ----
	@Post("login")
	async login(
		@Body() dto: { email: string; password: string },
		@Res() res: Response,
	) {
		const { token } = await this.providersService.login(
			dto.email,
			dto.password,
		);
		res.cookie("provider_session", token, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			path: "/",
		});
		return res.json({ ok: true });
	}

	@Post("logout")
	async logout(@Req() req: ReqWithCookies, @Res() res: Response) {
		const token = req.cookies.provider_session;
		if (token) await this.providersService.logout(token);
		res.clearCookie("provider_session", {
			httpOnly: true,
			sameSite: "lax",
			secure: process.env.NODE_ENV === "production",
			path: "/",
		});
		return res.json({ ok: true });
	}

	@Get("me")
	me(@Req() req: ReqWithCookies) {
		return this.providersService.resolveFromToken(
			req.cookies.provider_session,
		);
	}

	// Perfil público (sin auth)
	@Get("public/:slug")
	publicProfile(@Param("slug") slug: string) {
		return this.providersService.getPublicBySlug(slug);
	}

	// Actualizar perfil público (proveedor autenticado)
	@Patch("me/profile")
	async updateProfile(
		@Req() req: ReqWithCookies,
		@Body()
		dto: {
			displayName?: string;
			bio?: string;
			avatarUrl?: string;
			bannerUrl?: string;
			slug?: string;
		},
	) {
		const provider = await this.providersService.resolveFromToken(
			req.cookies.provider_session,
		);
		return this.providersService.updateProfile(provider.id, dto);
	}

	@Get("me/products")
	async myProducts(@Req() req: ReqWithCookies) {
		const provider = await this.providersService.resolveFromToken(
			req.cookies.provider_session,
		);
		return this.providersService.listProductsByProvider(provider.id);
	}

	// ---- Crear producto como proveedor ----
	@Post("products")
	async createProduct(
		@Req() req: ReqWithCookies,
		@Body() dto: CreateProductDto,
	) {
		const provider = await this.providersService.resolveFromToken(
			req.cookies.provider_session,
		);
		if (!provider) throw new UnauthorizedException();
		return this.productsService.create({
			...dto,
			providerId: provider.id,
		});
	}
}
