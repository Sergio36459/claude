import { Controller, Get, Header } from "@nestjs/common";
import { PrismaService } from "../../prisma.service";

@Controller()
export class SourcesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("sources")
  @Header("Cache-Control", "public, max-age=3600")
  async sources() {
    return this.prisma.source.findMany({ orderBy: { priority: "asc" } });
  }

  @Get("health")
  health() {
    return { status: "ok", ts: new Date().toISOString() };
  }
}
