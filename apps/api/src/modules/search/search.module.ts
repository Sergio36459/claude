import { Module } from "@nestjs/common";
import { PrismaService } from "../../prisma.service";
import { SearchController } from "./search.controller";

@Module({
  controllers: [SearchController],
  providers: [PrismaService],
})
export class SearchModule {}
