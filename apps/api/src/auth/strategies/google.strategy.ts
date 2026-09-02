/* eslint-disable prettier/prettier */
import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, Profile } from "passport-google-oauth20";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
	constructor() {
		super({
			clientID: process.env.GOOGLE_CLIENT_ID!,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
			callbackURL: process.env.GOOGLE_CALLBACK_URL!,
			scope: ["email", "profile"],
		});
	}

	validate(_accessToken: string, _refreshToken: string, profile: Profile) {
		return {
			provider: "google",
			providerAccountId: profile.id,
			email: profile.emails?.[0]?.value,
			name: profile.displayName,
		};
	}
}
