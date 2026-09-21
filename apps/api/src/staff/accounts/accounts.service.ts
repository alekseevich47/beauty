import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { desc, eq, ilike, or } from 'drizzle-orm';
import type { Db } from '@beauty/db';
import { users, masters, appointments, cities } from '@beauty/db';
import type { TariffCode } from '@beauty/contracts';
import { DB } from '../../common/tokens';

export type AccountSummary = {
  id: string;
  kind: 'client' | 'master';
  displayName: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  tariffCode: TariffCode | null;
  createdAt: string;
  status: 'active' | 'suspended' | 'deleted';
};

@Injectable()
export class StaffAccountsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /**
   * Flat account list for the staff console.
   * Phone numbers stay encrypted at rest and are never returned here — support
   * only needs to know whether a contact exists (152-FZ data minimization).
   */
  async list(q?: string, limit = 50): Promise<AccountSummary[]> {
    const pattern = q ? `%${q}%` : undefined;

    const userRows = await this.db
      .select({
        id: users.id,
        displayName: users.displayName,
        role: users.role,
        isBlocked: users.isBlocked,
        createdAt: users.createdAt,
        hasPhone: users.phoneEncrypted,
        cityName: cities.name,
      })
      .from(users)
      .leftJoin(cities, eq(cities.id, users.cityId))
      .where(
        pattern ? or(ilike(users.displayName, pattern), ilike(users.username, pattern)) : undefined,
      )
      .orderBy(desc(users.createdAt))
      .limit(limit);

    const masterRows = await this.db
      .select({
        id: masters.id,
        displayName: masters.displayName,
        tariffCode: masters.tariffCode,
        isActive: masters.isActive,
        createdAt: masters.createdAt,
        cityName: cities.name,
      })
      .from(masters)
      .leftJoin(cities, eq(cities.id, masters.cityId))
      .where(pattern ? ilike(masters.displayName, pattern) : undefined)
      .orderBy(desc(masters.createdAt))
      .limit(limit);

    const clients: AccountSummary[] = userRows
      .filter((u) => u.role === 'client')
      .map((u) => ({
        id: u.id,
        kind: 'client' as const,
        displayName: u.displayName,
        email: null,
        phone: u.hasPhone ? '••••••' : null,
        city: u.cityName ?? null,
        tariffCode: null,
        createdAt: u.createdAt.toISOString(),
        status: u.isBlocked ? ('suspended' as const) : ('active' as const),
      }));

    const masterAccounts: AccountSummary[] = masterRows.map((m) => ({
      id: m.id,
      kind: 'master' as const,
      displayName: m.displayName,
      email: null,
      phone: null,
      city: m.cityName ?? null,
      tariffCode: m.tariffCode,
      createdAt: m.createdAt.toISOString(),
      status: m.isActive ? ('active' as const) : ('suspended' as const),
    }));

    return [...masterAccounts, ...clients].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async search(q: string, limit = 20) {
    const pattern = `%${q}%`;
    const userRows = await this.db
      .select()
      .from(users)
      .where(or(ilike(users.displayName, pattern), ilike(users.username, pattern)))
      .limit(limit);

    const masterRows = await this.db
      .select()
      .from(masters)
      .where(ilike(masters.displayName, pattern))
      .limit(limit);

    return { users: userRows, masters: masterRows };
  }

  async getUser(id: string) {
    const [user] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!user) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }
    const appts = await this.db
      .select()
      .from(appointments)
      .where(eq(appointments.clientId, id))
      .orderBy(desc(appointments.startsAt))
      .limit(20);
    return { user, appointments: appts };
  }

  async getMaster(id: string) {
    const [master] = await this.db.select().from(masters).where(eq(masters.id, id)).limit(1);
    if (!master) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Master not found' },
      });
    }
    return master;
  }

  async setBlocked(userId: string, isBlocked: boolean) {
    const [row] = await this.db
      .update(users)
      .set({ isBlocked, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return row;
  }

  async setMasterActive(masterId: string, isActive: boolean) {
    const [row] = await this.db
      .update(masters)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(masters.id, masterId))
      .returning();
    return row;
  }
}
