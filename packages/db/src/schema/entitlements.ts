import { boolean, index, pgTable, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { masters, timestamps, tariffCodeEnum } from './miniapp';

export const tariffs = pgTable(
  'tariffs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: tariffCodeEnum('code').notNull(),
    name: varchar('name', { length: 64 }).notNull(),
    priceAmount: text('price_amount').notNull(), // store as integer string (kopecks) for seed simplicity
    currency: varchar('currency', { length: 3 }).notNull().default('RUB'),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex('tariffs_code_uidx').on(t.code)],
);

export const features = pgTable(
  'features',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    description: text('description'),
    ...timestamps,
  },
  (t) => [uniqueIndex('features_code_uidx').on(t.code)],
);

export const tariffFeatures = pgTable(
  'tariff_features',
  {
    tariffId: uuid('tariff_id')
      .notNull()
      .references(() => tariffs.id, { onDelete: 'cascade' }),
    featureId: uuid('feature_id')
      .notNull()
      .references(() => features.id, { onDelete: 'cascade' }),
  },
  (t) => [uniqueIndex('tariff_features_uidx').on(t.tariffId, t.featureId)],
);

export const masterFeatureOverrides = pgTable(
  'master_feature_overrides',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    masterId: uuid('master_id')
      .notNull()
      .references(() => masters.id, { onDelete: 'cascade' }),
    featureId: uuid('feature_id')
      .notNull()
      .references(() => features.id, { onDelete: 'cascade' }),
    enabled: boolean('enabled').notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('master_feature_overrides_uidx').on(t.masterId, t.featureId),
    index('master_feature_overrides_master_idx').on(t.masterId),
  ],
);
