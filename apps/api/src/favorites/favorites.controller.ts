import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { FavoritesService } from './favorites.service';
import { CurrentUser, type AuthUser } from '../common/decorators/auth.decorators';
import { ZodSchema } from '../common/pipes/zod-validation.pipe';
import { MiniAppAuthGuard } from '../common/guards/miniapp-auth.guard';

@ZodSchema(
  z.object({
    masterId: z.string().uuid().optional(),
    serviceId: z.string().uuid().optional(),
  }),
)
class AddFavoriteDto {
  masterId?: string;
  serviceId?: string;
}

@Controller('favorites')
@UseGuards(MiniAppAuthGuard)
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.favorites.list(user.id);
  }

  @Post()
  add(@CurrentUser() user: AuthUser, @Body() body: AddFavoriteDto) {
    return this.favorites.add(user.id, body.masterId, body.serviceId);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.favorites.remove(user.id, id);
  }
}
