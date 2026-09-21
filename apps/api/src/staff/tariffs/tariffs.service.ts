import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { Db } from '@beauty/db';
import { tariffs, features, tariffFeatures, masterFeatureOverrides, masters } from '@beauty/db';
import type { FeatureCode, TariffCode } from '@beauty/contracts';
import { TARIFF_FEATURES } from '@beauty/entitlements';
import { DB } from '../../common/tokens';

@Injectable()
export class StaffTariffsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async listTariffs() {
    return this.db.select().from(tariffs);
  }

  async listFeatures() {
    return this.db.select().from(features);
  }

  /** Feature x tariff matrix as shown in the admin Features screen. */
  async featureMatrix(): Promise<
    { code: FeatureCode; label: string; tariffs: Record<TariffCode, boolean> }[]
  > {
    const allFeatures = await this.db.select().from(features);
    const allTariffs = await this.db.select().from(tariffs);
    const links = await this.db.select().from(tariffFeatures);

    const tariffCodeById = new Map(allTariffs.map((t) => [t.id, t.code as TariffCode]));
    const enabled = new Map<string, Set<TariffCode>>();
    for (const link of links) {
      const code = tariffCodeById.get(link.tariffId);
      if (!code) continue;
      const set = enabled.get(link.featureId) ?? new Set<TariffCode>();
      set.add(code);
      enabled.set(link.featureId, set);
    }

    return allFeatures.map((f) => {
      const set = enabled.get(f.id) ?? new Set<TariffCode>();
      return {
        code: f.code as FeatureCode,
        label: f.name,
        tariffs: {
          standard: set.has('standard'),
          premium: set.has('premium'),
          ultra: set.has('ultra'),
        },
      };
    });
  }

  /** Toggle a feature for a tariff (admin Features screen). */
  async setTariffFeature(tariffCode: TariffCode, featureCode: FeatureCode, enabled: boolean) {
    const [tariff] = await this.db
      .select()
      .from(tariffs)
      .where(eq(tariffs.code, tariffCode))
      .limit(1);
    const [feature] = await this.db
      .select()
      .from(features)
      .where(eq(features.code, featureCode))
      .limit(1);

    if (!tariff || !feature) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Tariff or feature not found' },
      });
    }

    if (enabled) {
      await this.db
        .insert(tariffFeatures)
        .values({ tariffId: tariff.id, featureId: feature.id })
        .onConflictDoNothing();
    } else {
      await this.db
        .delete(tariffFeatures)
        .where(
          and(eq(tariffFeatures.tariffId, tariff.id), eq(tariffFeatures.featureId, feature.id)),
        );
    }

    return { tariffCode, featureCode, enabled };
  }

  async setTariffPrice(code: TariffCode, priceAmount: number) {
    const [row] = await this.db
      .update(tariffs)
      .set({ priceAmount: String(priceAmount), updatedAt: new Date() })
      .where(eq(tariffs.code, code))
      .returning();
    if (!row) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Tariff not found' },
      });
    }
    return row;
  }

  async setMasterOverride(masterId: string, featureCode: FeatureCode, enabled: boolean) {
    const [feature] = await this.db
      .select()
      .from(features)
      .where(eq(features.code, featureCode))
      .limit(1);
    if (!feature) {
      throw new NotFoundException({
        error: { code: 'FEATURE_NOT_FOUND', message: 'Feature not found' },
      });
    }
    const [row] = await this.db
      .insert(masterFeatureOverrides)
      .values({
        masterId,
        featureId: feature.id,
        enabled,
      })
      .onConflictDoUpdate({
        target: [masterFeatureOverrides.masterId, masterFeatureOverrides.featureId],
        set: { enabled, updatedAt: new Date() },
      })
      .returning();
    return row;
  }

  async assignMasterTariff(masterId: string, tariffCode: TariffCode) {
    const [row] = await this.db
      .update(masters)
      .set({ tariffCode, updatedAt: new Date() })
      .where(eq(masters.id, masterId))
      .returning();
    return row;
  }

  /** Sync tariff_features from entitlements matrix (ops helper). */
  async syncMatrix() {
    const allFeatures = await this.db.select().from(features);
    const byCode = new Map(allFeatures.map((f) => [f.code, f]));
    const allTariffs = await this.db.select().from(tariffs);

    for (const t of allTariffs) {
      const codes = TARIFF_FEATURES[t.code as TariffCode] ?? [];
      await this.db.delete(tariffFeatures).where(eq(tariffFeatures.tariffId, t.id));
      for (const code of codes) {
        const f = byCode.get(code);
        if (!f) continue;
        await this.db.insert(tariffFeatures).values({
          tariffId: t.id,
          featureId: f.id,
        });
      }
    }
    return { ok: true };
  }
}
