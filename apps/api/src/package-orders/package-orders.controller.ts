import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { verifyAccessToken } from "../auth/tokens";
import { ProvidersService } from "../providers/providers.service";
import {
  PackageOrdersService,
  type OrderStatus,
} from "./package-orders.service";

type ReqWithCookies = Request & {
  cookies: { access_token?: string; provider_session?: string };
};

@Controller("package-orders")
export class PackageOrdersController {
  constructor(
    @Inject(PackageOrdersService)
    private readonly service: PackageOrdersService,
    @Inject(ProvidersService)
    private readonly providersService: ProvidersService,
  ) {}

  private getUserId(req: ReqWithCookies): string {
    const userId = verifyAccessToken(req.cookies?.access_token);
    if (!userId) throw new UnauthorizedException("Debes iniciar sesión");
    return userId;
  }

  // ---- Crear pedido de paquete (usuario) ----
  @Post()
  create(
    @Req() req: ReqWithCookies,
    @Body()
    dto: {
      packageDesignId: string;
      notes?: string;
      shippingAddress?: Record<string, string>;
    },
  ) {
    const userId = this.getUserId(req);
    return this.service.createFromDesign(userId, dto.packageDesignId, dto);
  }

  // ---- Mis pedidos de paquete (usuario) ----
  @Get("my")
  myOrders(@Req() req: ReqWithCookies) {
    const userId = this.getUserId(req);
    return this.service.getByUser(userId);
  }

  // ---- Pedidos de paquete del proveedor ----
  @Get("provider")
  async providerOrders(
    @Req() req: ReqWithCookies,
    @Query("status") status?: string,
  ) {
    const provider = await this.providersService.resolveFromToken(
      req.cookies.provider_session,
    );
    return this.service.getByProvider(provider.id, status);
  }

  @Get("provider/:id")
  async providerOrderDetail(
    @Req() req: ReqWithCookies,
    @Param("id") id: string,
  ) {
    const provider = await this.providersService.resolveFromToken(
      req.cookies.provider_session,
    );
    return this.service.getProviderDetail(provider.id, id);
  }

  @Patch("provider/:id/status")
  async updateStatus(
    @Req() req: ReqWithCookies,
    @Param("id") id: string,
    @Body() dto: { status: OrderStatus; note?: string },
  ) {
    const provider = await this.providersService.resolveFromToken(
      req.cookies.provider_session,
    );
    return this.service.updateStatus(provider.id, id, dto);
  }
}
