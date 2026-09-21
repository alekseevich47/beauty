import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { Db } from '@beauty/db';
import { appointments, reviewsMaster, reviewsClient, masters } from '@beauty/db';
import { DB } from '../common/tokens';

@Injectable()
export class ReviewsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async reviewMaster(input: {
    clientId: string;
    appointmentId: string;
    rating: number;
    text?: string;
  }) {
    const [a] = await this.db
      .select()
      .from(appointments)
      .where(eq(appointments.id, input.appointmentId))
      .limit(1);
    if (!a || a.clientId !== input.clientId) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Appointment not found' },
      });
    }
    if (a.status !== 'completed') {
      throw new BadRequestException({
        error: { code: 'NOT_COMPLETED', message: 'Appointment must be completed' },
      });
    }

    const [row] = await this.db
      .insert(reviewsMaster)
      .values({
        appointmentId: a.id,
        masterId: a.masterId,
        clientId: input.clientId,
        rating: input.rating,
        text: input.text,
      })
      .onConflictDoNothing()
      .returning();

    if (!row) {
      throw new BadRequestException({
        error: { code: 'ALREADY_REVIEWED', message: 'Already reviewed' },
      });
    }

    await this.db.execute(sql`
      update masters set
        rating_avg = (
          select coalesce(avg(rating)::numeric(3,2), 0) from reviews_master where master_id = ${a.masterId}
        ),
        rating_count = (
          select count(*)::int from reviews_master where master_id = ${a.masterId}
        ),
        updated_at = now()
      where id = ${a.masterId}
    `);

    return row;
  }

  async reviewClient(input: {
    masterId: string;
    appointmentId: string;
    rating: number;
    text?: string;
  }) {
    const [a] = await this.db
      .select()
      .from(appointments)
      .where(
        and(eq(appointments.id, input.appointmentId), eq(appointments.masterId, input.masterId)),
      )
      .limit(1);
    if (!a) {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'Not your appointment' },
      });
    }
    if (a.status !== 'completed') {
      throw new BadRequestException({
        error: { code: 'NOT_COMPLETED', message: 'Appointment must be completed' },
      });
    }

    const [row] = await this.db
      .insert(reviewsClient)
      .values({
        appointmentId: a.id,
        masterId: a.masterId,
        clientId: a.clientId,
        rating: input.rating,
        text: input.text,
      })
      .onConflictDoNothing()
      .returning();

    if (!row) {
      throw new BadRequestException({
        error: { code: 'ALREADY_REVIEWED', message: 'Already reviewed' },
      });
    }
    return row;
  }

  async listForMaster(masterId: string) {
    return this.db
      .select()
      .from(reviewsMaster)
      .where(eq(reviewsMaster.masterId, masterId))
      .orderBy(desc(reviewsMaster.createdAt))
      .limit(50);
  }

  async listForClient(clientId: string) {
    return this.db
      .select()
      .from(reviewsClient)
      .where(eq(reviewsClient.clientId, clientId))
      .orderBy(desc(reviewsClient.createdAt))
      .limit(50);
  }
}

void masters;
