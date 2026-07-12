import { Module } from "@nestjs/common";
import { PrismaService } from "../../prisma.service";
import { LossesController } from "./losses.controller";

@Module({
  controllers: [LossesController],
  providers: [PrismaService],
})
export class LossesModule {}
