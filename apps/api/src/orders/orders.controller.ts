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
import { OrdersService, type OrderStatus } from "./orders.service";
import { ProvidersService } from "../providers/providers.service";

type ReqWithCookies = Request & {
  cookies: { access_token?: string; provider_session?: string };
};

@Controller("orders")
export class OrdersController {
  constructor(
    @Inject(OrdersService)
    private readonly ordersService: OrdersService,
    @Inject(ProvidersService)
    private readonly providersService: ProvidersService,
  ) {}

  // ---- Crear pedido (usuario autenticado) ----
  // POST /orders
  @Post()
  async createOrder(
    @Req() req: ReqWithCookies,
    @Body()
    dto: {
      designId: string;
      quantity?: number;
      notes?: string;
      shippingAddress?: Record<string, string>;
      designSnapshot?: Record<string, string>;
      designAssets?: Record<string, unknown[]>;
    },
  ) {
    const userId = await this.getUserIdFromCookie(req);
    return this.ordersService.createOrder(userId, dto);
  }

  // ---- Mis pedidos (usuario) ----
  // GET /orders/my
  @Get("my")
  async myOrders(@Req() req: ReqWithCookies) {
    const userId = await this.getUserIdFromCookie(req);
    return this.ordersService.getOrdersByUser(userId);
  }

  // ---- Pedidos del proveedor ----
  // GET /orders/provider?status=pending
  @Get("provider")
  async providerOrders(
    @Req() req: ReqWithCookies,
    @Query("status") status?: string,
  ) {
    const provider = await this.providersService.resolveFromToken(
      req.cookies.provider_session,
    );
    return this.ordersService.getOrdersByProvider(provider.id, status);
  }

  // ---- Detalle de un pedido (proveedor) ----
  // GET /orders/provider/:id
  @Get("provider/:id")
  async providerOrderDetail(
    @Req() req: ReqWithCookies,
    @Param("id") id: string,
  ) {
    const provider = await this.providersService.resolveFromToken(
      req.cookies.provider_session,
    );
    return this.ordersService.getOrderDetail(provider.id, id);
  }

  // ---- Cambiar estado (proveedor) ----
  // PATCH /orders/provider/:id/status
  @Patch("provider/:id/status")
  async updateStatus(
    @Req() req: ReqWithCookies,
    @Param("id") id: string,
    @Body() dto: { status: OrderStatus; note?: string },
  ) {
    const provider = await this.providersService.resolveFromToken(
      req.cookies.provider_session,
    );
    return this.ordersService.updateOrderStatus(provider.id, id, dto);
  }

  // ---- Helper: resolver userId desde cookie access_token ----
  private getUserIdFromCookie(req: ReqWithCookies): string {
    const token = req.cookies.access_token;
    if (!token) throw new UnauthorizedException();

    // El access token es un HMAC firmado: verifyAccessToken devuelve userId o null
    const { verifyAccessToken } = require("../auth/tokens") as {
      verifyAccessToken: (t?: string) => string | null;
    };

    const userId = verifyAccessToken(token);
    if (!userId) throw new UnauthorizedException();
    return userId;
  }
}
