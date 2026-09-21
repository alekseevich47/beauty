import { eq } from 'drizzle-orm';
import { createDb } from './index';
import {
  categories,
  cities,
  features,
  permissions,
  rolePermissions,
  roles,
  serviceVariants,
  tariffFeatures,
  tariffs,
} from './schema';
import { TARIFF_FEATURES } from '@beauty/entitlements';
import type { FeatureCode, PermissionCode, TariffCode } from '@beauty/contracts';

const PERMISSIONS: { code: PermissionCode; name: string }[] = [
  { code: 'chat.read', name: 'Read support chat' },
  { code: 'chat.write', name: 'Write support chat' },
  { code: 'accounts.read', name: 'Read accounts' },
  { code: 'accounts.write', name: 'Write accounts' },
  { code: 'features.toggle', name: 'Toggle features' },
  { code: 'tariffs.manage', name: 'Manage tariffs' },
  { code: 'ops.metrics', name: 'View ops metrics' },
  { code: 'ops.restart', name: 'Restart services' },
  { code: 'ops.backup', name: 'Trigger backups' },
  { code: 'staff.manage', name: 'Manage staff' },
  { code: 'audit.read', name: 'Read audit logs' },
];

const SUPPORT_PERMS: PermissionCode[] = [
  'chat.read',
  'chat.write',
  'accounts.read',
  'accounts.write',
];

const ADMIN_PERMS: PermissionCode[] = PERMISSIONS.map((p) => p.code);

const TARIFF_PRICES: Record<TariffCode, number> = {
  standard: 99000, // kopecks
  premium: 249000,
  ultra: 499000,
};

const CATEGORY_SEED = [
  { name: 'Волосы', slug: 'hair', iconKey: 'hair', sortOrder: 1 },
  { name: 'Ногти', slug: 'nails', iconKey: 'nails', sortOrder: 2 },
  { name: 'Брови и ресницы', slug: 'brows', iconKey: 'brows', sortOrder: 3 },
  { name: 'Макияж', slug: 'makeup', iconKey: 'makeup', sortOrder: 4 },
  { name: 'Косметология', slug: 'cosmo', iconKey: 'cosmo', sortOrder: 5 },
  { name: 'Эпиляция', slug: 'epilation', iconKey: 'epilation', sortOrder: 6 },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const db = createDb(url, { max: 1 });

  // City
  const [city] = await db
    .insert(cities)
    .values({ name: 'Москва', slug: 'moscow', timezone: 'Europe/Moscow' })
    .onConflictDoNothing()
    .returning();
  const moscow =
    city ??
    (await db
      .select()
      .from(cities)
      .where(eq(cities.slug, 'moscow'))
      .then((r) => r[0]));
  console.log('City:', moscow?.slug);

  // Categories
  for (const c of CATEGORY_SEED) {
    const [row] = await db.insert(categories).values(c).onConflictDoNothing().returning();
    const cat =
      row ??
      (await db
        .select()
        .from(categories)
        .where(eq(categories.slug, c.slug))
        .then((r) => r[0]));
    if (cat) {
      await db
        .insert(serviceVariants)
        .values({
          categoryId: cat.id,
          name: `Все · ${c.name}`,
          slug: `${c.slug}-all`,
          sortOrder: 0,
        })
        .onConflictDoNothing();
    }
  }

  // Features + tariffs
  const featureRows: Record<string, string> = {};
  for (const code of Object.keys(
    Object.fromEntries(
      Object.values(TARIFF_FEATURES)
        .flat()
        .map((f) => [f, true]),
    ),
  ) as FeatureCode[]) {
    const [f] = await db
      .insert(features)
      .values({ code, name: code })
      .onConflictDoNothing()
      .returning();
    const existing =
      f ??
      (await db
        .select()
        .from(features)
        .where(eq(features.code, code))
        .then((r) => r[0]));
    if (existing) featureRows[code] = existing.id;
  }

  for (const code of ['standard', 'premium', 'ultra'] as TariffCode[]) {
    const [t] = await db
      .insert(tariffs)
      .values({
        code,
        name: code[0]!.toUpperCase() + code.slice(1),
        priceAmount: String(TARIFF_PRICES[code]),
      })
      .onConflictDoNothing()
      .returning();
    const tariff =
      t ??
      (await db
        .select()
        .from(tariffs)
        .where(eq(tariffs.code, code))
        .then((r) => r[0]));
    if (!tariff) continue;
    for (const fc of TARIFF_FEATURES[code]) {
      const fid = featureRows[fc];
      if (!fid) continue;
      await db
        .insert(tariffFeatures)
        .values({ tariffId: tariff.id, featureId: fid })
        .onConflictDoNothing();
    }
  }

  // Permissions + roles
  const permIds: Record<string, string> = {};
  for (const p of PERMISSIONS) {
    const [row] = await db.insert(permissions).values(p).onConflictDoNothing().returning();
    const existing =
      row ??
      (await db
        .select()
        .from(permissions)
        .where(eq(permissions.code, p.code))
        .then((r) => r[0]));
    if (existing) permIds[p.code] = existing.id;
  }

  async function ensureRole(code: string, name: string, perms: PermissionCode[]) {
    const [row] = await db.insert(roles).values({ code, name }).onConflictDoNothing().returning();
    const role =
      row ??
      (await db
        .select()
        .from(roles)
        .where(eq(roles.code, code))
        .then((r) => r[0]));
    if (!role) return;
    for (const pc of perms) {
      const pid = permIds[pc];
      if (!pid) continue;
      await db
        .insert(rolePermissions)
        .values({ roleId: role.id, permissionId: pid })
        .onConflictDoNothing();
    }
  }

  await ensureRole('support', 'Support', SUPPORT_PERMS);
  await ensureRole('admin', 'Admin', ADMIN_PERMS);

  console.log('Seed complete');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
