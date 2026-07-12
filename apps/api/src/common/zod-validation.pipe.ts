import { BadRequestException, Injectable, type PipeTransform } from "@nestjs/common";
import type { ZodSchema } from "zod";

/** Валидация query/params через zod-схемы из @uwt/shared (единый контракт, docs/05 §3). */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      // формат ошибки — RFC 7807
      throw new BadRequestException({
        type: "about:blank",
        title: "VALIDATION_ERROR",
        status: 400,
        detail: result.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      });
    }
    return result.data;
  }
}
