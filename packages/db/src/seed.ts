/** Сид справочника источников (docs/04 §2.1). Идемпотентен. */
import { PrismaClient } from "@prisma/client";
import { SOURCES } from "@uwt/shared";

const prisma = new PrismaClient();

async function main() {
  for (const [i, s] of SOURCES.entries()) {
    await prisma.source.upsert({
      where: { code: s.code },
      create: {
        code: s.code,
        name: s.name,
        url: s.url,
        kind: s.kind,
        reliabilityNote: s.reliabilityNote,
        priority: i + 1,
      },
      update: {
        name: s.name,
        url: s.url,
        kind: s.kind,
        reliabilityNote: s.reliabilityNote,
        priority: i + 1,
      },
    });
  }
  console.log(`Источники: ${SOURCES.length} записей upsert`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
