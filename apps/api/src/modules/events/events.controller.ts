import { Controller, Get, Query } from "@nestjs/common";
import { confidenceSchema, eventTypeSchema } from "@uwt/shared";
import { z } from "zod";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { PrismaService } from "../../prisma.service";

const listQuerySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  type: z
    .union([eventTypeSchema, z.array(eventTypeSchema)])
    .transform((v) => (Array.isArray(v) ? v : [v]))
    .optional(),
  confidence: z
    .union([confidenceSchema, z.array(confidenceSchema)])
    .transform((v) => (Array.isArray(v) ? v : [v]))
    .optional(),
  q: z.string().min(2).max(120).optional(),
  cursor: z.coerce.bigint().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
type ListQuery = z.infer<typeof listQuerySchema>;

@Controller("events")
export class EventsController {
  constructor(private readonly prisma: PrismaService) {}

  /** Keyset-пагинация по (date,id) — устойчива к дозаписи (docs/05 §2.2). */
  @Get()
  async list(@Query(new ZodValidationPipe(listQuerySchema)) query: ListQuery) {
    const items = await this.prisma.event.findMany({
      where: {
        date: {
          gte: query.from ? new Date(`${query.from}T00:00:00Z`) : undefined,
          lte: query.to ? new Date(`${query.to}T00:00:00Z`) : undefined,
        },
        type: query.type ? { in: query.type } : undefined,
        confidence: query.confidence ? { in: query.confidence } : undefined,
        title: query.q ? { contains: query.q, mode: "insensitive" } : undefined,
        id: query.cursor ? { gt: query.cursor } : undefined,
      },
      include: { sources: { include: { source: true } } },
      orderBy: { id: "asc" },
      take: query.limit + 1,
    });
    const hasMore = items.length > query.limit;
    const page = hasMore ? items.slice(0, -1) : items;
    return {
      items: page.map((e) => ({
        id: Number(e.id),
        date: e.date.toISOString().slice(0, 10),
        type: e.type,
        title: e.title,
        confidence: e.confidence,
        isKeyEvent: e.isKeyEvent,
        sources: e.sources.map((s) => ({ code: s.source.code, url: s.url })),
      })),
      nextCursor: hasMore ? String(page[page.length - 1]!.id) : null,
    };
  }
}
