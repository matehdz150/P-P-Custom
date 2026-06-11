import { Module } from "@nestjs/common";
import { EmailsService } from "./emails.service";
import { ConfigModule } from "@nestjs/config";

@Module({
  imports: [ConfigModule],
  providers: [EmailsService],
  exports: [EmailsService],
})
export class EmailsModule {}
