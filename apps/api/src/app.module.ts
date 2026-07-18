import { Module } from "@nestjs/common";
import { DaysModule } from "./modules/days/days.module";
import { EventsModule } from "./modules/events/events.module";
import { LossesModule } from "./modules/losses/losses.module";
import { SearchModule } from "./modules/search/search.module";
import { SourcesModule } from "./modules/sources/sources.module";
import { PrismaService } from "./prisma.service";

@Module({
  imports: [DaysModule, EventsModule, LossesModule, SearchModule, SourcesModule],
  providers: [PrismaService],
})
export class AppModule {}
