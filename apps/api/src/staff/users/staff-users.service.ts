import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import type { Db } from '@beauty/db';
import { staffUsers, staffUserRoles, roles as rolesTable, staffSessions } from '@beauty/db';
import { DB } from '../../common/tokens';
import { StaffAuthService } from '../../common/guards/staff-auth.guard';
import type { StaffRoleName } from '../../common/decorators/auth.decorators';

export type StaffMemberDto = {
  id: string;
  email: string;
  displayName: string;
  roles: StaffRoleName[];
  totpEnabled: boolean;
  lastLoginAt: string | null;
  active: boolean;
};

@Injectable()
export class StaffUsersService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly auth: StaffAuthService,
  ) {}

  async list(): Promise<StaffMemberDto[]> {
    const rows = await this.db
      .select()
      .from(staffUsers)
      .orderBy(desc(staffUsers.createdAt))
      .limit(200);

    return Promise.all(
      rows.map(async (s) => ({
        id: s.id,
        email: s.email,
        displayName: s.displayName,
        roles: await this.auth.resolveRoles(s.id),
        totpEnabled: s.totpEnabled,
        lastLoginAt: s.lastLoginAt?.toISOString() ?? null,
        active: s.isActive,
      })),
    );
  }

  async create(input: {
    email: string;
    password: string;
    displayName: string;
    role: StaffRoleName;
  }): Promise<StaffMemberDto> {
    const email = input.email.toLowerCase();
    const [existing] = await this.db
      .select({ id: staffUsers.id })
      .from(staffUsers)
      .where(eq(staffUsers.email, email))
      .limit(1);
    if (existing) {
      throw new BadRequestException({
        error: { code: 'EMAIL_TAKEN', message: 'Staff user already exists' },
      });
    }

    const passwordHash = await this.auth.hashPassword(input.password);
    const [created] = await this.db
      .insert(staffUsers)
      .values({ email, passwordHash, displayName: input.displayName })
      .returning();

    await this.assignRole(created!.id, input.role);

    return {
      id: created!.id,
      email: created!.email,
      displayName: created!.displayName,
      roles: [input.role],
      totpEnabled: false,
      lastLoginAt: null,
      active: created!.isActive,
    };
  }

  async assignRole(staffUserId: string, role: StaffRoleName) {
    const [roleRow] = await this.db
      .select()
      .from(rolesTable)
      .where(eq(rolesTable.code, role))
      .limit(1);
    if (!roleRow) {
      throw new NotFoundException({
        error: { code: 'ROLE_NOT_FOUND', message: `Role ${role} missing; run seed` },
      });
    }
    await this.db
      .insert(staffUserRoles)
      .values({ staffUserId, roleId: roleRow.id })
      .onConflictDoNothing();
    return { ok: true };
  }

  /** Deactivating a staff member revokes every live session immediately. */
  async setActive(staffUserId: string, active: boolean) {
    const [row] = await this.db
      .update(staffUsers)
      .set({ isActive: active, updatedAt: new Date() })
      .where(eq(staffUsers.id, staffUserId))
      .returning();
    if (!row) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Staff user not found' },
      });
    }
    if (!active) {
      await this.db
        .update(staffSessions)
        .set({ revokedAt: new Date() })
        .where(eq(staffSessions.staffUserId, staffUserId));
    }
    return { id: row.id, active: row.isActive };
  }

  /** Resets TOTP enrollment — used when a staff member loses their device. */
  async resetTotp(staffUserId: string) {
    await this.db
      .update(staffUsers)
      .set({ totpEnabled: false, updatedAt: new Date() })
      .where(eq(staffUsers.id, staffUserId));
    return this.auth.enrollTotp(staffUserId);
  }
}
