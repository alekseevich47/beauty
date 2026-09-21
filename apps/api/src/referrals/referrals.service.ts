import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import type { Db } from '@beauty/db';
import { masters, referrals, subscriptions } from '@beauty/db';
import { DB } from '../common/tokens';

@Injectable()
export class ReferralsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async getOrCreateCode(masterId: string) {
    const [m] = await this.db.select().from(masters).where(eq(masters.id, masterId)).limit(1);
    if (!m) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Master not found' },
      });
    }
    if (m.referralCode) return { code: m.referralCode };

    const code = randomBytes(6).toString('hex');
    await this.db
      .update(masters)
      .set({ referralCode: code, updatedAt: new Date() })
      .where(eq(masters.id, masterId));
    return { code };
  }

  async apply(referredMasterId: string, code: string) {
    const [referrer] = await this.db
      .select()
      .from(masters)
      .where(eq(masters.referralCode, code))
      .limit(1);
    if (!referrer) {
      throw new NotFoundException({
        error: { code: 'INVALID_CODE', message: 'Referral code not found' },
      });
    }
    if (referrer.id === referredMasterId) {
      throw new BadRequestException({
        error: { code: 'SELF_REFERRAL', message: 'Cannot refer yourself' },
      });
    }

    const [existing] = await this.db
      .select()
      .from(referrals)
      .where(eq(referrals.referredMasterId, referredMasterId))
      .limit(1);
    if (existing) {
      throw new BadRequestException({
        error: { code: 'ALREADY_REFERRED', message: 'Already used a referral' },
      });
    }

    const [row] = await this.db
      .insert(referrals)
      .values({
        referrerMasterId: referrer.id,
        referredMasterId,
        rewardGranted: false,
      })
      .returning();

    await this.grantMonth(referrer.id);
    await this.grantMonth(referredMasterId);
    await this.db.update(referrals).set({ rewardGranted: true }).where(eq(referrals.id, row!.id));

    return { ok: true, referralId: row!.id };
  }

  private async grantMonth(masterId: string) {
    const periodEnd = new Date(Date.now() + 30 * 86400_000);
    const [sub] = await this.db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.masterId, masterId), eq(subscriptions.status, 'active')))
      .limit(1);

    if (sub) {
      const currentEnd = sub.currentPeriodEnd ?? new Date();
      const next = new Date(Math.max(currentEnd.getTime(), Date.now()) + 30 * 86400_000);
      await this.db
        .update(subscriptions)
        .set({ currentPeriodEnd: next, updatedAt: new Date() })
        .where(eq(subscriptions.id, sub.id));
    } else {
      const [m] = await this.db
        .select({ tariffCode: masters.tariffCode })
        .from(masters)
        .where(eq(masters.id, masterId))
        .limit(1);
      await this.db.insert(subscriptions).values({
        masterId,
        tariffCode: m?.tariffCode ?? 'standard',
        status: 'trialing',
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd,
      });
    }
  }
}
