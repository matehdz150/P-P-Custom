/* eslint-disable prettier/prettier */
import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { ConfigModule } from "@nestjs/config";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { GoogleStrategy } from "./strategies/google.strategy";

@Module({
	imports: [ConfigModule, PassportModule.register({ session: false })],
	controllers: [AuthController],
	providers: [AuthService, GoogleStrategy],
	exports: [AuthService],
})
export class AuthModule {}
