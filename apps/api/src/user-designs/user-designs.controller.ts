import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { UserDesignsService } from "./user-designs.service";
import type { SaveDesignDto } from "./dto/save-design-dto";
import { verifyAccessToken } from "../auth/tokens";

@Controller("user-designs")
export class UserDesignsController {
  constructor(
    @Inject(UserDesignsService)
    private readonly userDesignsService: UserDesignsService,
  ) {}

  private getUserId(req: Request): string {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const token = req.cookies?.access_token as string | undefined;
    const userId = verifyAccessToken(token);
    if (!userId) {
      throw new UnauthorizedException("Debes iniciar sesión para realizar esta acción");
    }
    return userId;
  }

  @Post()
  save(@Req() req: Request, @Body() dto: SaveDesignDto) {
    const userId = this.getUserId(req);
    return this.userDesignsService.save(userId, dto);
  }

  @Get()
  findAll(
    @Req() req: Request,
    @Query("status") status?: string,
    @Query("productId") productId?: string,
  ) {
    const userId = this.getUserId(req);
    return this.userDesignsService.findAll(userId, status, productId);
  }

  @Get(":id")
  findOne(@Req() req: Request, @Param("id") id: string) {
    const userId = this.getUserId(req);
    return this.userDesignsService.findOne(userId, id);
  }

  @Delete(":id")
  remove(@Req() req: Request, @Param("id") id: string) {
    const userId = this.getUserId(req);
    return this.userDesignsService.remove(userId, id);
  }

  @Patch(":id/status")
  updateStatus(
    @Req() req: Request,
    @Param("id") id: string,
    @Body("status") status: "draft" | "completed",
  ) {
    const userId = this.getUserId(req);
    return this.userDesignsService.updateStatus(userId, id, status);
  }
}
