import { Injectable } from "@nestjs/common";
import { Prisma } from "@uwt/db";
import { PrismaService } from "../../prisma.service";

@Injectable()
export class DaysService {
  constructor(private readonly prisma: PrismaService) {}

  async getBundle(date: string) {
    const d = new Date(`${date}T00:00:00Z`);
    const day = await this.prisma.day.findUnique({
      where: { date: d },
      include: {
        stats: true,
        events: {
          include: { sources: { include: { source: true } }, place: true },
          orderBy: [{ isKeyEvent: "desc" }, { id: "asc" }],
        },
        personnelEstimates: { include: { source: true } },
        equipmentRecords: { include: { source: true } },
        controlDeltas: true,
      },
    });
    if (!day || !day.isPublished) return null;
    return {
      date,
      preliminary: day.isPreliminary,
      stats: day.stats,
      events: day.events.map((e) => ({
        id: Number(e.id),
        date,
        timeUtc: e.timeUtc,
        type: e.type,
        title: e.title,
        description: e.description,
        placeName: e.place?.nameUk ?? null,
        confidence: e.confidence,
        isKeyEvent: e.isKeyEvent,
        sources: e.sources.map((s) => ({
          code: s.source.code,
          name: s.source.name,
          url: s.url,
          publishedAt: s.publishedAt,
        })),
      })),
      losses: {
        // ВСЕГДА раздельно по источникам — инвариант ТЗ на уровне контракта
        personnel: day.personnelEstimates.map((p) => ({
          side: p.side,
          sourceCode: p.source.code,
          sourceName: p.source.name,
          metric: p.metric,
          valueMin: p.valueMin,
          valueMax: p.valueMax,
          methodNote: p.methodNote,
          url: p.url,
        })),
        equipment: day.equipmentRecords.map((r) => ({
          side: r.side,
          sourceCode: r.source.code,
          sourceName: r.source.name,
          category: r.category,
          status: r.status,
          count: r.count,
          url: r.url,
        })),
      },
      diffSummary: {
        gainedRuSqkm: day.controlDeltas
          .filter((x) => x.kind === "gained_ru")
          .reduce((s, x) => s + Number(x.areaSqkm), 0),
        gainedUaSqkm: day.controlDeltas
          .filter((x) => x.kind === "gained_ua")
          .reduce((s, x) => s + Number(x.areaSqkm), 0),
      },
    };
  }

  /** Гео-операции — только типизированный raw SQL (docs/04 §5). */
  async getControlGeo(date: string) {
    const rows = await this.prisma.$queryRaw<Array<{ side: string; geojson: string }>>(
      Prisma.sql`
        SELECT side::text AS side, ST_AsGeoJSON(geom, 5) AS geojson
        FROM control_snapshots
        WHERE date = ${date}::date
      `,
    );
    return {
      type: "FeatureCollection",
      features: rows.map((r) => ({
        type: "Feature",
        geometry: JSON.parse(r.geojson),
        properties: { side: r.side, date },
      })),
    };
  }
}
