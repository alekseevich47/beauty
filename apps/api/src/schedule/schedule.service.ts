import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import type { Db } from '@beauty/db';
import { masterSchedules, appointments, services } from '@beauty/db';
import { DB } from '../common/tokens';

@Injectable()
export class ScheduleService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async getMasterSchedule(masterId: string) {
    return this.db
      .select()
      .from(masterSchedules)
      .where(eq(masterSchedules.masterId, masterId))
      .orderBy(asc(masterSchedules.weekday), asc(masterSchedules.startTime));
  }

  async upsertSlots(
    masterId: string,
    slots: Array<{
      weekday: number;
      startTime: string;
      endTime: string;
      slotStepMin?: number;
      timezone?: string;
    }>,
  ) {
    for (const s of slots) {
      if (s.weekday < 0 || s.weekday > 6) {
        throw new BadRequestException({
          error: { code: 'BAD_WEEKDAY', message: 'weekday must be 0..6' },
        });
      }
      if (s.startTime >= s.endTime) {
        throw new BadRequestException({
          error: { code: 'BAD_RANGE', message: 'startTime must be before endTime' },
        });
      }
    }

    await this.db.delete(masterSchedules).where(eq(masterSchedules.masterId, masterId));
    if (slots.length === 0) return [];
    return this.db
      .insert(masterSchedules)
      .values(
        slots.map((s) => ({
          masterId,
          weekday: s.weekday,
          startTime: s.startTime,
          endTime: s.endTime,
          slotStepMin: s.slotStepMin ?? 30,
          timezone: s.timezone ?? 'Europe/Moscow',
        })),
      )
      .returning();
  }

  async availableSlots(masterId: string, date: string, serviceId: string) {
    const day = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(day.getTime())) {
      throw new BadRequestException({
        error: { code: 'BAD_DATE', message: 'Invalid date' },
      });
    }
    const weekday = day.getUTCDay();

    const [service] = await this.db
      .select()
      .from(services)
      .where(and(eq(services.id, serviceId), eq(services.masterId, masterId)))
      .limit(1);
    if (!service) {
      throw new NotFoundException({
        error: { code: 'SERVICE_NOT_FOUND', message: 'Service not found' },
      });
    }

    const windows = await this.db
      .select()
      .from(masterSchedules)
      .where(and(eq(masterSchedules.masterId, masterId), eq(masterSchedules.weekday, weekday)));

    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);
    const existing = await this.db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.masterId, masterId),
          // status not cancelled
        ),
      );

    const busy = existing.filter(
      (a) => a.status !== 'cancelled' && a.startsAt >= dayStart && a.startsAt <= dayEnd,
    );

    const slots: string[] = [];
    for (const w of windows) {
      const [sh, sm] = w.startTime.split(':').map(Number);
      const [eh, em] = w.endTime.split(':').map(Number);
      let cursor = new Date(dayStart);
      cursor.setUTCHours(sh!, sm!, 0, 0);
      const end = new Date(dayStart);
      end.setUTCHours(eh!, em!, 0, 0);
      const step = w.slotStepMin * 60_000;
      const duration = service.durationMin * 60_000;

      while (cursor.getTime() + duration <= end.getTime()) {
        const slotEnd = new Date(cursor.getTime() + duration);
        const overlap = busy.some((a) => cursor < a.endsAt && slotEnd > a.startsAt);
        if (!overlap && cursor.getTime() > Date.now()) {
          slots.push(cursor.toISOString());
        }
        cursor = new Date(cursor.getTime() + step);
      }
    }
    return { date, serviceId, slots };
  }
}
