import { Controller, Get, Query } from "@nestjs/common";
import { equipmentCategorySchema, lossSideSchema } from "@uwt/shared";
import { z } from "zod";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { PrismaService } from "../../prisma.service";

/**
 * Инвариант ТЗ на уровне контракта: у эндпоинтов потерь НЕТ параметра
 * агрегации — ответ всегда массив серий, по одной на источник.
 */
const personnelQuerySchema = z.object({
  side: lossSideSchema.optional(),
  sourceCode: z
    .union([z.string(), z.array(z.string())])
    .transform((v) => (Array.isArray(v) ? v : [v]))
    .optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});
type PersonnelQuery = z.infer<typeof personnelQuerySchema>;

const equipmentQuerySchema = personnelQuerySchema.extend({
  category: z
    .union([equipmentCategorySchema, z.array(equipmentCategorySchema)])
    .transform((v) => (Array.isArray(v) ? v : [v]))
    .optional(),
});
type EquipmentQuery = z.infer<typeof equipmentQuerySchema>;

@Controller("losses")
export class LossesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("personnel")
  async personnel(@Query(new ZodValidationPipe(personnelQuerySchema)) q: PersonnelQuery) {
    const rows = await this.prisma.personnelLossEstimate.findMany({
      where: {
        side: q.side,
        source: q.sourceCode ? { code: { in: q.sourceCode } } : undefined,
        date: {
          gte: q.from ? new Date(`${q.from}T00:00:00Z`) : undefined,
          lte: q.to ? new Date(`${q.to}T00:00:00Z`) : undefined,
        },
      },
      include: { source: true },
      orderBy: { date: "asc" },
    });
    const series = new Map<
      string,
      { source: string; side: string; metric: string; methodNote: string | null; points: Array<[string, number, number]> }
    >();
    for (const r of rows) {
      const key = `${r.side}:${r.source.code}:${r.metric}`;
      const s =
        series.get(key) ??
        { source: r.source.code, side: r.side, metric: r.metric, methodNote: r.methodNote, points: [] };
      s.points.push([r.date.toISOString().slice(0, 10), r.valueMin, r.valueMax]);
      series.set(key, s);
    }
    return { series: [...series.values()] };
  }

  @Get("equipment")
  async equipment(@Query(new ZodValidationPipe(equipmentQuerySchema)) q: EquipmentQuery) {
    const rows = await this.prisma.equipmentLossRecord.findMany({
      where: {
        side: q.side,
        category: q.category ? { in: q.category } : undefined,
        source: q.sourceCode ? { code: { in: q.sourceCode } } : undefined,
        date: {
          gte: q.from ? new Date(`${q.from}T00:00:00Z`) : undefined,
          lte: q.to ? new Date(`${q.to}T00:00:00Z`) : undefined,
        },
      },
      include: { source: true },
      orderBy: { date: "asc" },
    });
    const series = new Map<
      string,
      { source: string; side: string; category: string; status: string; points: Array<[string, number]> }
    >();
    for (const r of rows) {
      const key = `${r.side}:${r.source.code}:${r.category}:${r.status}`;
      const s =
        series.get(key) ??
        { source: r.source.code, side: r.side, category: r.category, status: r.status, points: [] };
      s.points.push([r.date.toISOString().slice(0, 10), r.count]);
      series.set(key, s);
    }
    return { series: [...series.values()] };
  }
}
