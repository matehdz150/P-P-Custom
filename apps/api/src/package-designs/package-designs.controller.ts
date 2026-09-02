import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { verifyAccessToken } from "../auth/tokens";
import { PackageDesignsService } from "./package-designs.service";
import type {
  EnsurePackageDesignDto,
  SetUnitsDto,
} from "./dto/package-design.dto";

@Controller("package-designs")
export class PackageDesignsController {
  constructor(
    @Inject(PackageDesignsService)
    private readonly service: PackageDesignsService,
  ) {}

  private getUserId(req: Request): string {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const token = req.cookies?.access_token as string | undefined;
    const userId = verifyAccessToken(token);
    if (!userId) {
      throw new UnauthorizedException(
        "Debes iniciar sesión para diseñar el paquete",
      );
    }
    return userId;
  }

  @Post("ensure")
  ensure(@Req() req: Request, @Body() dto: EnsurePackageDesignDto) {
    const userId = this.getUserId(req);
    return this.service.ensure(userId, dto.packageId);
  }

  @Get("my")
  findMine(@Req() req: Request) {
    const userId = this.getUserId(req);
    return this.service.findMine(userId);
  }

  @Get(":id")
  findOne(@Req() req: Request, @Param("id") id: string) {
    const userId = this.getUserId(req);
    return this.service.findOne(userId, id);
  }

  @Patch(":id/units")
  setUnits(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: SetUnitsDto,
  ) {
    const userId = this.getUserId(req);
    return this.service.setUnits(userId, id, dto.units ?? []);
  }

  @Patch(":id/status")
  updateStatus(
    @Req() req: Request,
    @Param("id") id: string,
    @Body("status") status: "draft" | "completed",
  ) {
    const userId = this.getUserId(req);
    return this.service.updateStatus(userId, id, status);
  }
}
