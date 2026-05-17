/* eslint-disable prettier/prettier */
import {
  Body,
  Controller,
  Get,
  Req,
  Res,
  UseGuards,
  Inject,
  UnauthorizedException,
  Post,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Request, Response } from "express";
import { AuthService, type IssuedTokens } from "./auth.service";
import {
  ACCESS_TTL_MS,
  REFRESH_TTL_DAYS,
  verifyAccessToken,
} from "./tokens";

interface OAuthUser {
  provider: string;
  providerAccountId: string;
  email?: string;
  name?: string;
}

type AuthCookies = {
  access_token?: string;
  refresh_token?: string;
};

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService)
    private readonly authService: AuthService,
  ) {}

  // ---- cookies ----
  private setAuthCookies(res: Response, tokens: IssuedTokens) {
    const base = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
    };
    res.cookie("access_token", tokens.accessToken, {
      ...base,
      maxAge: ACCESS_TTL_MS,
    });
    res.cookie("refresh_token", tokens.refreshToken, {
      ...base,
      maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
    });
  }

  private clearAuthCookies(res: Response) {
    const base = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
    };
    res.clearCookie("access_token", base);
    res.clearCookie("refresh_token", base);
  }

  // ---- Google OAuth ----
  @Get("google")
  @UseGuards(AuthGuard("google"))
  googleAuth(): void {
    // Passport redirige automáticamente
  }

  @Get("google/callback")
  @UseGuards(AuthGuard("google"))
  async googleCallback(
    @Req() req: Request & { user: OAuthUser },
    @Res() res: Response,
  ) {
    const tokens = await this.authService.loginOAuth(req.user);
    this.setAuthCookies(res, tokens);
    return res.redirect(process.env.FRONTEND_URL!);
  }

  // ---- Email/password ----
  @Post("register")
  async register(
    @Body() dto: { email: string; password: string; name?: string },
    @Res() res: Response,
  ) {
    const tokens = await this.authService.register(dto);
    this.setAuthCookies(res, tokens);
    return res.json({ ok: true });
  }

  @Post("login")
  async login(
    @Body() dto: { email: string; password: string },
    @Res() res: Response,
  ) {
    const tokens = await this.authService.loginEmail(
      dto.email,
      dto.password,
    );
    this.setAuthCookies(res, tokens);
    return res.json({ ok: true });
  }

  // ---- Rotación de refresh token ----
  @Post("refresh")
  async refresh(
    @Req() req: Request & { cookies: AuthCookies },
    @Res() res: Response,
  ) {
    try {
      const tokens = await this.authService.refresh(
        req.cookies.refresh_token,
      );
      this.setAuthCookies(res, tokens);
      return res.json({ ok: true });
    } catch {
      this.clearAuthCookies(res);
      throw new UnauthorizedException();
    }
  }

  // ---- Usuario actual (con auto-refresh transparente) ----
  @Get("me")
  async me(
    @Req() req: Request & { cookies: AuthCookies },
    @Res({ passthrough: true }) res: Response,
  ) {
    // 1. access token válido → respuesta directa (sin DB)
    let userId = verifyAccessToken(req.cookies.access_token);

    // 2. access vencido/ausente → intentar rotar con refresh token
    if (!userId) {
      try {
        const tokens = await this.authService.refresh(
          req.cookies.refresh_token,
        );
        this.setAuthCookies(res, tokens);
        userId = verifyAccessToken(tokens.accessToken);
      } catch {
        this.clearAuthCookies(res);
        throw new UnauthorizedException();
      }
    }

    if (!userId) throw new UnauthorizedException();

    const user = await this.authService.getUser(userId);
    if (!user) throw new UnauthorizedException();

    return { id: user.id, email: user.email, name: user.name };
  }

  @Post("logout")
  async logout(
    @Req() req: Request & { cookies: AuthCookies },
    @Res() res: Response,
  ) {
    await this.authService.logout(req.cookies.refresh_token);
    this.clearAuthCookies(res);
    return res.json({ ok: true });
  }
}
