import { z } from 'zod';

export const userRoleSchema = z.enum(['client', 'master']);
export type UserRole = z.infer<typeof userRoleSchema>;

export const tariffCodeSchema = z.enum(['standard', 'premium', 'ultra']);
export type TariffCode = z.infer<typeof tariffCodeSchema>;

export const appointmentStatusSchema = z.enum([
  'pending',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
]);
export type AppointmentStatus = z.infer<typeof appointmentStatusSchema>;

export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const moneySchema = z.object({
  amount: z.number().int().nonnegative(),
  currency: z.literal('RUB').default('RUB'),
});

export const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const authInitDataSchema = z.object({
  platform: z.enum(['telegram', 'max']),
  initData: z.string().min(1),
  role: userRoleSchema.optional(),
});

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const citySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  timezone: z.string(),
});

export const categorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  iconKey: z.string().nullable(),
  sortOrder: z.number().int(),
});

export const masterCardSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  avatarUrl: z.string().url().nullable(),
  ratingAvg: z.number(),
  ratingCount: z.number().int(),
  cityId: z.string().uuid(),
  tariffCode: tariffCodeSchema,
  isMasterOfWeek: z.boolean().optional(),
});

export const serviceCardSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  durationMin: z.number().int().positive(),
  price: moneySchema,
  master: masterCardSchema,
  photoUrl: z.string().url().nullable(),
  categoryId: z.string().uuid(),
});

export const catalogQuerySchema = z.object({
  cityId: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
  variantId: z.string().uuid().optional(),
  q: z.string().max(200).optional(),
  minPrice: z.coerce.number().int().nonnegative().optional(),
  maxPrice: z.coerce.number().int().nonnegative().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  date: z.string().date().optional(),
  preferredTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const createAppointmentSchema = z.object({
  serviceId: z.string().uuid(),
  masterId: z.string().uuid(),
  startsAt: z.string().datetime(),
  note: z.string().max(500).optional(),
});

export const appointmentSchema = z.object({
  id: z.string().uuid(),
  status: appointmentStatusSchema,
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  price: moneySchema,
  serviceTitle: z.string(),
  masterId: z.string().uuid(),
  clientId: z.string().uuid(),
});

export const createReviewSchema = z.object({
  appointmentId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  text: z.string().max(2000).optional(),
});

export const revenuePeriodSchema = z.enum(['day', 'week', 'month']);

export const revenueBlockSchema = z.object({
  period: revenuePeriodSchema,
  amount: z.number().int().nonnegative(),
  currency: z.literal('RUB'),
  deltaPercent: z.number(),
  direction: z.enum(['up', 'down', 'flat']),
  series: z.array(z.object({ t: z.string(), v: z.number() })),
});

export const subscribeSchema = z.object({
  tariffCode: tariffCodeSchema,
  returnUrl: z.string().url().optional(),
});

export const subscriptionSchema = z.object({
  id: z.string().uuid(),
  tariffCode: tariffCodeSchema,
  status: z.enum(['trialing', 'active', 'past_due', 'cancelled', 'expired']),
  currentPeriodEnd: z.string().datetime().nullable(),
});

export const staffLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const staffTotpSchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/),
});

export const permissionCodeSchema = z.enum([
  'chat.read',
  'chat.write',
  'accounts.read',
  'accounts.write',
  'features.toggle',
  'tariffs.manage',
  'ops.metrics',
  'ops.restart',
  'ops.backup',
  'staff.manage',
  'audit.read',
]);
export type PermissionCode = z.infer<typeof permissionCodeSchema>;

export const featureCodeSchema = z.enum([
  'blacklist',
  'auto_fill_cancellations',
  'waiting_list',
  'ai_client_analysis',
  'auto_return_client',
  'cabinet_branding',
  'category_highlight',
  'broadcast_weekly',
  'broadcast_biweekly',
  'broadcast_monthly',
  'custom_ultra',
  'analytics_basic',
  'referrals',
  'master_of_week',
]);
export type FeatureCode = z.infer<typeof featureCodeSchema>;

export const healthSchema = z.object({
  status: z.enum(['ok', 'degraded', 'down']),
  version: z.string(),
  contour: z.string(),
  uptimeSec: z.number(),
});

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().optional(),
  }),
});
