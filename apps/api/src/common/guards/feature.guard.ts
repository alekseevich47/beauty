import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { and, eq, gt, inArray } from 'drizzle-orm';
import { hasFeature, type EntitlementSnapshot } from '@beauty/entitlements';
import type { FeatureCode } from '@beauty/contracts';
import type { Db } from '@beauty/db';
import { masters, subscriptions, masterFeatureOverrides, features } from '@beauty/db';
import { DB } from '../tokens';
import { FEATURE_KEY, type AuthUser } from '../decorators/auth.decorators';

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(DB) private readonly db: Db,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<FeatureCode>(FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!feature) return true;

    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const masterId = req.user?.masterId;
    if (!masterId) {
      throw new ForbiddenException({
        error: { code: 'MASTER_REQUIRED', message: 'Master context required' },
      });
    }

    const snapshot = await this.loadSnapshot(masterId);
    if (!hasFeature(snapshot, feature)) {
      throw new ForbiddenException({
        error: {
          code: 'FEATURE_DISABLED',
          message: `Feature ${feature} is not available`,
        },
      });
    }
    return true;
  }

  async loadSnapshot(masterId: string): Promise<EntitlementSnapshot> {
    const [master] = await this.db
      .select({ tariffCode: masters.tariffCode })
      .from(masters)
      .where(eq(masters.id, masterId))
      .limit(1);

    if (!master) {
      return {
        tariffCode: 'standard',
        subscriptionActive: false,
        overrides: [],
      };
    }

    // A subscription only counts when it is paid (or an explicitly granted trial)
    // AND its period has not lapsed — an unpaid intent grants nothing.
    const [sub] = await this.db
      .select({ status: subscriptions.status })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.masterId, masterId),
          inArray(subscriptions.status, ['trialing', 'active']),
          gt(subscriptions.currentPeriodEnd, new Date()),
        ),
      )
      .limit(1);

    const overrides = await this.db
      .select({
        code: features.code,
        enabled: masterFeatureOverrides.enabled,
      })
      .from(masterFeatureOverrides)
      .innerJoin(features, eq(features.id, masterFeatureOverrides.featureId))
      .where(eq(masterFeatureOverrides.masterId, masterId));

    return {
      tariffCode: master.tariffCode,
      subscriptionActive: Boolean(sub),
      overrides: overrides.map((o) => ({
        featureCode: o.code as FeatureCode,
        enabled: o.enabled,
      })),
    };
  }
}
