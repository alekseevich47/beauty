import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, ne } from 'drizzle-orm';
import type { Db } from '@beauty/db';
import { appointments, appointmentEvents, services, masters, blacklist } from '@beauty/db';
import { DB } from '../common/tokens';
import { QueuesService } from '../queues/queues.service';

@Injectable()
export class BookingService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly queues: QueuesService,
  ) {}

  async create(input: {
    clientId: string;
    serviceId: string;
    masterId: string;
    startsAt: string;
    note?: string;
  }) {
    const [service] = await this.db
      .select()
      .from(services)
      .where(and(eq(services.id, input.serviceId), eq(services.isActive, true)))
      .limit(1);
    if (!service || service.masterId !== input.masterId) {
      throw new NotFoundException({
        error: { code: 'SERVICE_NOT_FOUND', message: 'Service not found' },
      });
    }

    const [blocked] = await this.db
      .select({ id: blacklist.id })
      .from(blacklist)
      .where(and(eq(blacklist.masterId, input.masterId), eq(blacklist.clientId, input.clientId)))
      .limit(1);
    if (blocked) {
      throw new ForbiddenException({
        error: { code: 'BLACKLISTED', message: 'Client is blacklisted' },
      });
    }

    const startsAt = new Date(input.startsAt);
    if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() < Date.now()) {
      throw new BadRequestException({
        error: { code: 'INVALID_START', message: 'startsAt must be in the future' },
      });
    }
    const endsAt = new Date(startsAt.getTime() + service.durationMin * 60_000);

    // Price is always taken from DB — never from client
    const priceAmount = service.priceAmount;

    try {
      const created = await this.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(appointments)
          .values({
            masterId: input.masterId,
            clientId: input.clientId,
            serviceId: service.id,
            status: 'pending',
            startsAt,
            endsAt,
            priceAmount,
            currency: service.currency,
            note: input.note,
            timeRange: `[${startsAt.toISOString()},${endsAt.toISOString()})`,
          })
          .returning();

        await tx.insert(appointmentEvents).values({
          appointmentId: row!.id,
          actorUserId: input.clientId,
          eventType: 'created',
          payload: { serviceId: service.id },
        });

        return row!;
      });

      await this.queues.reminders.add(
        'appointment-reminder',
        { appointmentId: created.id },
        { delay: Math.max(startsAt.getTime() - Date.now() - 2 * 3600_000, 0) },
      );

      return this.toDto(created, service.title);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('exclusion') || msg.includes('appointments_no_overlap')) {
        throw new ConflictException({
          error: { code: 'SLOT_TAKEN', message: 'Time slot overlaps an existing appointment' },
        });
      }
      throw e;
    }
  }

  async listForUser(userId: string, role: 'client' | 'master', masterId?: string) {
    const rows =
      role === 'master' && masterId
        ? await this.db
            .select()
            .from(appointments)
            .where(eq(appointments.masterId, masterId))
            .orderBy(desc(appointments.startsAt))
            .limit(50)
        : await this.db
            .select()
            .from(appointments)
            .where(eq(appointments.clientId, userId))
            .orderBy(desc(appointments.startsAt))
            .limit(50);

    return Promise.all(
      rows.map(async (a) => {
        const [s] = await this.db
          .select({ title: services.title })
          .from(services)
          .where(eq(services.id, a.serviceId))
          .limit(1);
        return this.toDto(a, s?.title ?? 'Service');
      }),
    );
  }

  async cancel(appointmentId: string, actorUserId: string, asMaster: boolean) {
    const [a] = await this.db
      .select()
      .from(appointments)
      .where(eq(appointments.id, appointmentId))
      .limit(1);
    if (!a) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Appointment not found' },
      });
    }
    if (!asMaster && a.clientId !== actorUserId) {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'Not your appointment' },
      });
    }
    if (asMaster) {
      const [m] = await this.db
        .select({ userId: masters.userId })
        .from(masters)
        .where(eq(masters.id, a.masterId))
        .limit(1);
      if (m?.userId !== actorUserId) {
        throw new ForbiddenException({
          error: { code: 'FORBIDDEN', message: 'Not your appointment' },
        });
      }
    }
    if (inArrayStatusesCancelled(a.status)) {
      throw new BadRequestException({
        error: { code: 'INVALID_STATUS', message: 'Cannot cancel' },
      });
    }

    const [updated] = await this.db
      .update(appointments)
      .set({ status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() })
      .where(eq(appointments.id, appointmentId))
      .returning();

    await this.db.insert(appointmentEvents).values({
      appointmentId,
      actorUserId,
      eventType: 'cancelled',
      payload: {},
    });

    return updated;
  }

  async confirm(appointmentId: string, masterUserId: string, masterId: string) {
    const [a] = await this.db
      .select()
      .from(appointments)
      .where(and(eq(appointments.id, appointmentId), eq(appointments.masterId, masterId)))
      .limit(1);
    if (!a) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Appointment not found' },
      });
    }
    const [updated] = await this.db
      .update(appointments)
      .set({ status: 'confirmed', updatedAt: new Date() })
      .where(and(eq(appointments.id, appointmentId), ne(appointments.status, 'cancelled')))
      .returning();

    await this.db.insert(appointmentEvents).values({
      appointmentId,
      actorUserId: masterUserId,
      eventType: 'confirmed',
      payload: {},
    });
    return updated;
  }

  private toDto(a: typeof appointments.$inferSelect, serviceTitle: string) {
    return {
      id: a.id,
      status: a.status,
      startsAt: a.startsAt.toISOString(),
      endsAt: a.endsAt.toISOString(),
      price: { amount: a.priceAmount, currency: 'RUB' as const },
      serviceTitle,
      masterId: a.masterId,
      clientId: a.clientId,
    };
  }
}

function inArrayStatusesCancelled(status: string): boolean {
  return status === 'cancelled' || status === 'completed';
}
