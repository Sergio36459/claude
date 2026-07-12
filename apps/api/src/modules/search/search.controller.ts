import { Controller, Get, Header, Query } from "@nestjs/common";
import { Prisma } from "@uwt/db";
import { z } from "zod";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { PrismaService } from "../../prisma.service";

const searchQuerySchema = z.object({
  q: z.string().min(2).max(120),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
type SearchQuery = z.infer<typeof searchQuerySchema>;

@Controller("search")
export class SearchController {
  constructor(private readonly prisma: PrismaService) {}

  /** Единый поиск: места (tsvector/trigram) + события (docs/05 §2.4). */
  @Get()
  @Header("Cache-Control", "no-store")
  async search(@Query(new ZodValidationPipe(searchQuerySchema)) q: SearchQuery) {
    const [places, events] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{ id: bigint; kind: string; name_uk: string; lng: number | null; lat: number | null }>
      >(Prisma.sql`
        SELECT id, kind, name_uk, ST_X(geom) AS lng, ST_Y(geom) AS lat
        FROM places
        WHERE search_tsv @@ plainto_tsquery('simple', ${q.q})
           OR name_en % ${q.q}
        LIMIT ${q.limit}
      `),
      this.prisma.event.findMany({
        where: { title: { contains: q.q, mode: "insensitive" } },
        orderBy: [{ isKeyEvent: "desc" }, { date: "desc" }],
        take: q.limit,
      }),
    ]);
    return {
      results: [
        ...places.map((p) => ({
          type: "place" as const,
          id: Number(p.id),
          label: p.name_uk,
          sublabel: p.kind,
          coords: p.lng != null && p.lat != null ? [p.lng, p.lat] : null,
        })),
        ...events.map((e) => ({
          type: "event" as const,
          id: Number(e.id),
          label: e.title,
          date: e.date.toISOString().slice(0, 10),
        })),
      ].slice(0, q.limit),
    };
  }
}
