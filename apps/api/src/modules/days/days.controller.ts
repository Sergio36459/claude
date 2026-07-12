import { Controller, Get, Header, NotFoundException, Param } from "@nestjs/common";
import { isValidIsoDate } from "@uwt/shared";
import { DaysService } from "./days.service";

@Controller("days")
export class DaysController {
  constructor(private readonly days: DaysService) {}

  /** Дневной бандл (зеркало /data/days/{date}/bundle.json — docs/05 §2.1). */
  @Get(":date")
  @Header("Cache-Control", "public, max-age=86400, s-maxage=31536000")
  async getDay(@Param("date") date: string) {
    if (!isValidIsoDate(date)) {
      throw new NotFoundException({ title: "DATE_OUT_OF_RANGE", status: 404 });
    }
    const bundle = await this.days.getBundle(date);
    if (!bundle) {
      throw new NotFoundException({ title: "DAY_NOT_PUBLISHED", status: 404 });
    }
    return bundle;
  }

  /** Геометрия дня: зоны контроля как GeoJSON из PostGIS (docs/05 §2.1). */
  @Get(":date/geo/control")
  @Header("Cache-Control", "public, max-age=86400, s-maxage=31536000")
  async getControl(@Param("date") date: string) {
    if (!isValidIsoDate(date)) {
      throw new NotFoundException({ title: "DATE_OUT_OF_RANGE", status: 404 });
    }
    return this.days.getControlGeo(date);
  }
}
