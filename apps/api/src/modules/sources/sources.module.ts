import { Module } from "@nestjs/common";
import { PrismaService } from "../../prisma.service";
import { SourcesController } from "./sources.controller";

@Module({
  controllers: [SourcesController],
  providers: [PrismaService],
})
export class SourcesModule {}
