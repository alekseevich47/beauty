import { Controller, Get, Query } from '@nestjs/common';
import { catalogQuerySchema } from '@beauty/contracts';
import { z } from 'zod';
import { CatalogService } from './catalog.service';
import { Public } from '../common/decorators/auth.decorators';
import { ZodSchema } from '../common/pipes/zod-validation.pipe';

@ZodSchema(catalogQuerySchema)
class CatalogQueryDto {
  cityId!: string;
  categoryId?: string;
  variantId?: string;
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  date?: string;
  preferredTime?: string;
  cursor?: string;
  limit?: number;
}

@ZodSchema(z.object({ cityId: z.string().uuid() }))
class CityQueryDto {
  cityId!: string;
}

@ZodSchema(z.object({ categoryId: z.string().uuid().optional() }))
class CategoryQueryDto {
  categoryId?: string;
}

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Public()
  @Get('cities')
  cities() {
    return this.catalog.listCities();
  }

  @Public()
  @Get('categories')
  categories() {
    return this.catalog.listCategories();
  }

  @Public()
  @Get('variants')
  variants(@Query() q: CategoryQueryDto) {
    return this.catalog.listVariants(q.categoryId);
  }

  @Public()
  @Get('services')
  services(@Query() q: CatalogQueryDto) {
    return this.catalog.searchServices(q as never);
  }

  @Public()
  @Get('popular-variants')
  popular(@Query() q: CityQueryDto) {
    return this.catalog.popularVariants(q.cityId);
  }
}
