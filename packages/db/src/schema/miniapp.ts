import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/** `web` is reserved for guest accounts created by the embeddable widget. */
export const platformEnum = pgEnum('platform', ['telegram', 'max', 'web']);
export const userRoleEnum = pgEnum('user_role', ['client', 'master']);
export const tariffCodeEnum = pgEnum('tariff_code', ['standard', 'premium', 'ultra']);
export const appointmentStatusEnum = pgEnum('appointment_status', [
  'pending',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
]);
export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'trialing',
  'active',
  'past_due',
  'cancelled',
  'expired',
]);
export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'succeeded',
  'cancelled',
  'refunded',
]);
export const opsJobStatusEnum = pgEnum('ops_job_status', [
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
]);

export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const cities = pgTable(
  'cities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 120 }).notNull(),
    slug: varchar('slug', { length: 120 }).notNull(),
    timezone: varchar('timezone', { length: 64 }).notNull().default('Europe/Moscow'),
    ...timestamps,
  },
  (t) => [uniqueIndex('cities_slug_uidx').on(t.slug)],
);

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 120 }).notNull(),
    slug: varchar('slug', { length: 120 }).notNull(),
    iconKey: varchar('icon_key', { length: 64 }),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex('categories_slug_uidx').on(t.slug)],
);

export const serviceVariants = pgTable(
  'service_variants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 160 }).notNull(),
    slug: varchar('slug', { length: 160 }).notNull(),
    coverUrl: text('cover_url'),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('service_variants_slug_uidx').on(t.slug),
    index('service_variants_category_idx').on(t.categoryId),
  ],
);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    platform: platformEnum('platform').notNull(),
    platformUserId: varchar('platform_user_id', { length: 64 }).notNull(),
    role: userRoleEnum('role').notNull().default('client'),
    displayName: varchar('display_name', { length: 160 }).notNull(),
    username: varchar('username', { length: 120 }),
    avatarUrl: text('avatar_url'),
    languageCode: varchar('language_code', { length: 16 }).default('ru'),
    cityId: uuid('city_id').references(() => cities.id),
    phoneEncrypted: text('phone_encrypted'),
    isBlocked: boolean('is_blocked').notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('users_platform_uidx').on(t.platform, t.platformUserId),
    index('users_city_idx').on(t.cityId),
    index('users_role_idx').on(t.role),
  ],
);

export const masters = pgTable(
  'masters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    cityId: uuid('city_id')
      .notNull()
      .references(() => cities.id),
    displayName: varchar('display_name', { length: 160 }).notNull(),
    bio: text('bio'),
    avatarUrl: text('avatar_url'),
    ratingAvg: numeric('rating_avg', { precision: 3, scale: 2 }).notNull().default('0'),
    ratingCount: integer('rating_count').notNull().default(0),
    // PostGIS geography stored as WKT text for Drizzle; SQL migration adds geography column+index
    locationLat: numeric('location_lat', { precision: 9, scale: 6 }),
    locationLng: numeric('location_lng', { precision: 9, scale: 6 }),
    tariffCode: tariffCodeEnum('tariff_code').notNull().default('standard'),
    widgetPublicKey: varchar('widget_public_key', { length: 64 }),
    /** Comma-separated origins allowed to embed this master's booking widget. */
    widgetAllowedOrigins: text('widget_allowed_origins'),
    referralCode: varchar('referral_code', { length: 32 }),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('masters_user_uidx').on(t.userId),
    uniqueIndex('masters_referral_uidx').on(t.referralCode),
    uniqueIndex('masters_widget_key_uidx').on(t.widgetPublicKey),
    index('masters_city_rating_idx').on(t.cityId, t.ratingAvg),
  ],
);

export const masterProfiles = pgTable('master_profiles', {
  masterId: uuid('master_id')
    .primaryKey()
    .references(() => masters.id, { onDelete: 'cascade' }),
  brandColor: varchar('brand_color', { length: 16 }),
  coverUrl: text('cover_url'),
  deepLinkSlug: varchar('deep_link_slug', { length: 80 }),
  settings: jsonb('settings').$type<Record<string, unknown>>().default({}),
  ...timestamps,
});

export const services = pgTable(
  'services',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    masterId: uuid('master_id')
      .notNull()
      .references(() => masters.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id),
    variantId: uuid('variant_id').references(() => serviceVariants.id),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    durationMin: integer('duration_min').notNull(),
    priceAmount: integer('price_amount').notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('RUB'),
    photoUrl: text('photo_url'),
    isActive: boolean('is_active').notNull().default(true),
    searchVector: text('search_vector'),
    ...timestamps,
  },
  (t) => [
    index('services_catalog_idx').on(t.categoryId, t.priceAmount),
    index('services_master_idx').on(t.masterId),
    index('services_variant_idx').on(t.variantId),
  ],
);

export const masterSchedules = pgTable(
  'master_schedules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    masterId: uuid('master_id')
      .notNull()
      .references(() => masters.id, { onDelete: 'cascade' }),
    weekday: integer('weekday').notNull(), // 0=Sun .. 6=Sat
    startTime: varchar('start_time', { length: 5 }).notNull(), // HH:MM
    endTime: varchar('end_time', { length: 5 }).notNull(),
    slotStepMin: integer('slot_step_min').notNull().default(30),
    timezone: varchar('timezone', { length: 64 }).notNull().default('Europe/Moscow'),
    ...timestamps,
  },
  (t) => [index('master_schedules_master_idx').on(t.masterId, t.weekday)],
);

export const appointments = pgTable(
  'appointments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    masterId: uuid('master_id')
      .notNull()
      .references(() => masters.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id),
    status: appointmentStatusEnum('status').notNull().default('pending'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    priceAmount: integer('price_amount').notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('RUB'),
    note: text('note'),
    // tstzrange exclusion constraint added in SQL migration
    timeRange: text('time_range'),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('appointments_master_starts_idx').on(t.masterId, t.startsAt),
    index('appointments_client_idx').on(t.clientId, t.startsAt),
    index('appointments_status_idx').on(t.status),
  ],
);

export const appointmentEvents = pgTable(
  'appointment_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    appointmentId: uuid('appointment_id')
      .notNull()
      .references(() => appointments.id, { onDelete: 'cascade' }),
    actorUserId: uuid('actor_user_id').references(() => users.id),
    eventType: varchar('event_type', { length: 64 }).notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('appointment_events_appt_idx').on(t.appointmentId)],
);

export const reviewsMaster = pgTable(
  'reviews_master',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    appointmentId: uuid('appointment_id')
      .notNull()
      .references(() => appointments.id, { onDelete: 'cascade' }),
    masterId: uuid('master_id')
      .notNull()
      .references(() => masters.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => users.id),
    rating: integer('rating').notNull(),
    text: text('text'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('reviews_master_appt_uidx').on(t.appointmentId),
    index('reviews_master_master_idx').on(t.masterId),
  ],
);

export const reviewsClient = pgTable(
  'reviews_client',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    appointmentId: uuid('appointment_id')
      .notNull()
      .references(() => appointments.id, { onDelete: 'cascade' }),
    masterId: uuid('master_id')
      .notNull()
      .references(() => masters.id),
    clientId: uuid('client_id')
      .notNull()
      .references(() => users.id),
    rating: integer('rating').notNull(),
    text: text('text'),
    ...timestamps,
  },
  (t) => [uniqueIndex('reviews_client_appt_uidx').on(t.appointmentId)],
);

export const favorites = pgTable(
  'favorites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    masterId: uuid('master_id').references(() => masters.id, { onDelete: 'cascade' }),
    serviceId: uuid('service_id').references(() => services.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('favorites_user_idx').on(t.userId),
    uniqueIndex('favorites_user_master_uidx').on(t.userId, t.masterId),
  ],
);

export const blacklist = pgTable(
  'blacklist',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    masterId: uuid('master_id')
      .notNull()
      .references(() => masters.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('blacklist_master_client_uidx').on(t.masterId, t.clientId)],
);

export const waitingList = pgTable(
  'waiting_list',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    masterId: uuid('master_id')
      .notNull()
      .references(() => masters.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    serviceId: uuid('service_id').references(() => services.id),
    preferredDate: timestamp('preferred_date', { withTimezone: true }),
    status: varchar('status', { length: 32 }).notNull().default('waiting'),
    ...timestamps,
  },
  (t) => [index('waiting_list_master_idx').on(t.masterId, t.status)],
);

export const feedPosts = pgTable(
  'feed_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    masterId: uuid('master_id')
      .notNull()
      .references(() => masters.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }),
    body: text('body').notNull(),
    mediaUrl: text('media_url'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('feed_posts_master_idx').on(t.masterId, t.publishedAt)],
);

export const promoBlocks = pgTable('promo_blocks', {
  id: uuid('id').primaryKey().defaultRandom(),
  masterId: uuid('master_id')
    .notNull()
    .references(() => masters.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 160 }).notNull(),
  imageUrl: text('image_url'),
  linkUrl: text('link_url'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps,
});

export const portfolioMedia = pgTable(
  'portfolio_media',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    masterId: uuid('master_id')
      .notNull()
      .references(() => masters.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    thumbUrl: text('thumb_url'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('portfolio_media_master_idx').on(t.masterId)],
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 64 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    body: text('body'),
    payload: jsonb('payload').$type<Record<string, unknown>>().default({}),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('notifications_user_idx').on(t.userId, t.createdAt)],
);

export const referrals = pgTable(
  'referrals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    referrerMasterId: uuid('referrer_master_id')
      .notNull()
      .references(() => masters.id),
    referredMasterId: uuid('referred_master_id')
      .notNull()
      .references(() => masters.id),
    rewardGranted: boolean('reward_granted').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('referrals_pair_uidx').on(t.referrerMasterId, t.referredMasterId)],
);

export const broadcasts = pgTable(
  'broadcasts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    masterId: uuid('master_id')
      .notNull()
      .references(() => masters.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull(),
    body: text('body').notNull(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    recipientCount: integer('recipient_count').default(0),
    ...timestamps,
  },
  (t) => [index('broadcasts_master_idx').on(t.masterId, t.createdAt)],
);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    masterId: uuid('master_id')
      .notNull()
      .references(() => masters.id, { onDelete: 'cascade' }),
    tariffCode: tariffCodeEnum('tariff_code').notNull(),
    status: subscriptionStatusEnum('status').notNull().default('trialing'),
    provider: varchar('provider', { length: 32 }).notNull().default('yookassa'),
    providerSubscriptionId: varchar('provider_subscription_id', { length: 128 }),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index('subscriptions_master_idx').on(t.masterId, t.status),
    uniqueIndex('subscriptions_provider_uidx').on(t.providerSubscriptionId),
  ],
);

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    masterId: uuid('master_id')
      .notNull()
      .references(() => masters.id),
    subscriptionId: uuid('subscription_id').references(() => subscriptions.id),
    amount: integer('amount').notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('RUB'),
    status: paymentStatusEnum('status').notNull().default('pending'),
    provider: varchar('provider', { length: 32 }).notNull().default('yookassa'),
    providerPaymentId: varchar('provider_payment_id', { length: 128 }),
    description: text('description'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('payments_provider_uidx').on(t.providerPaymentId),
    index('payments_master_idx').on(t.masterId),
  ],
);

export const paymentWebhookEvents = pgTable(
  'payment_webhook_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: varchar('provider', { length: 32 }).notNull(),
    eventId: varchar('event_id', { length: 128 }).notNull(),
    eventType: varchar('event_type', { length: 64 }).notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('payment_webhook_events_uidx').on(t.provider, t.eventId)],
);

export const aiUsage = pgTable(
  'ai_usage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    masterId: uuid('master_id')
      .notNull()
      .references(() => masters.id, { onDelete: 'cascade' }),
    feature: varchar('feature', { length: 64 }).notNull(),
    tokensIn: integer('tokens_in').default(0),
    tokensOut: integer('tokens_out').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('ai_usage_master_idx').on(t.masterId, t.createdAt)],
);

export const embeddings = pgTable(
  'embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityType: varchar('entity_type', { length: 64 }).notNull(),
    entityId: uuid('entity_id').notNull(),
    // vector column added in SQL migration (pgvector)
    model: varchar('model', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('embeddings_entity_idx').on(t.entityType, t.entityId)],
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    familyId: uuid('family_id').notNull(),
    tokenHash: varchar('token_hash', { length: 128 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    replacedById: uuid('replaced_by_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('refresh_tokens_hash_uidx').on(t.tokenHash),
    index('refresh_tokens_user_idx').on(t.userId),
    index('refresh_tokens_family_idx').on(t.familyId),
  ],
);
