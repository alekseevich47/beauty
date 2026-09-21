import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import type { ZodTypeAny } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema?: ZodTypeAny) {}

  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const metatype = metadata.metatype as
      ((new (...args: never[]) => unknown) & { schema?: ZodTypeAny }) | undefined;
    const schema = this.schema ?? metatype?.schema;
    if (!schema) return value;

    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        },
      });
    }
    return parsed.data;
  }
}

/** Attach a Zod schema to a DTO class for the global pipe. */
export function ZodSchema<T extends ZodTypeAny>(schema: T) {
  return function <C extends new (...args: never[]) => unknown>(ctor: C): C & { schema: T } {
    (ctor as C & { schema: T }).schema = schema;
    return ctor as C & { schema: T };
  };
}
