import { Module } from "@nestjs/common";
import { PrismaService } from "../../prisma.service";
import { DaysController } from "./days.controller";
import { DaysService } from "./days.service";

@Module({
  controllers: [DaysController],
  providers: [DaysService, PrismaService],
})
export class DaysModule {}
