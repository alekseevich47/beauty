import type { AppointmentStatus, TariffCode, UserRole } from '@beauty/contracts';
import { type revenueBlockSchema } from '@beauty/contracts';
import { type z } from 'zod';

export type RevenueBlock = z.infer<typeof revenueBlockSchema>;

const CITY_ID = '11111111-1111-4111-8111-111111111111';

export type DemoMaster = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  ratingAvg: number;
  ratingCount: number;
  cityId: string;
  tariffCode: TariffCode;
  isMasterOfWeek?: boolean;
  category: string;
  weekServices: number;
};

export type DemoCategory = {
  id: string;
  name: string;
  slug: string;
  iconKey: string;
};

export type DemoPopular = {
  id: string;
  title: string;
  mastersCount: number;
  accent: string;
};

export type DemoService = {
  id: string;
  title: string;
  durationMin: number;
  price: number;
  photoUrl: string | null;
  master: DemoMaster;
  categoryId: string;
};

export type DemoAppointment = {
  id: string;
  status: AppointmentStatus;
  startsAt: string;
  endsAt: string;
  price: number;
  serviceTitle: string;
  masterName: string;
  clientName: string;
  clientAvatar: string | null;
  masterId: string;
  clientId: string;
};

export const demoCategories: DemoCategory[] = [
  { id: 'c1', name: 'Волосы', slug: 'hair', iconKey: 'scissors' },
  { id: 'c2', name: 'Ногти', slug: 'nails', iconKey: 'nail' },
  { id: 'c3', name: 'Брови', slug: 'brows', iconKey: 'brow' },
  { id: 'c4', name: 'Макияж', slug: 'makeup', iconKey: 'brush' },
  { id: 'c5', name: 'Кожа', slug: 'skin', iconKey: 'drop' },
  { id: 'c6', name: 'Массаж', slug: 'massage', iconKey: 'hand' },
];

export const demoMasters: DemoMaster[] = [
  {
    id: 'm1',
    displayName: 'Елена Воронова',
    avatarUrl: null,
    ratingAvg: 4.95,
    ratingCount: 128,
    cityId: CITY_ID,
    tariffCode: 'premium',
    isMasterOfWeek: true,
    category: 'Волосы',
    weekServices: 42,
  },
  {
    id: 'm2',
    displayName: 'Мария Ким',
    avatarUrl: null,
    ratingAvg: 4.88,
    ratingCount: 96,
    cityId: CITY_ID,
    tariffCode: 'ultra',
    isMasterOfWeek: true,
    category: 'Ногти',
    weekServices: 51,
  },
  {
    id: 'm3',
    displayName: 'Софья Лебедева',
    avatarUrl: null,
    ratingAvg: 4.91,
    ratingCount: 74,
    cityId: CITY_ID,
    tariffCode: 'standard',
    isMasterOfWeek: true,
    category: 'Брови',
    weekServices: 33,
  },
];

export const demoPopular: DemoPopular[] = [
  { id: 'all', title: 'Все', mastersCount: 240, accent: 'from-emerald-900/40 to-teal-800/20' },
  { id: 'p1', title: 'Стрижка', mastersCount: 48, accent: 'from-amber-900/40 to-orange-900/20' },
  { id: 'p2', title: 'Маникюр', mastersCount: 62, accent: 'from-rose-900/35 to-stone-800/25' },
  { id: 'p3', title: 'Окрашивание', mastersCount: 31, accent: 'from-cyan-900/35 to-slate-800/25' },
];

export const demoServices: DemoService[] = [
  {
    id: 's1',
    title: 'Женская стрижка',
    durationMin: 60,
    price: 3500,
    photoUrl: null,
    master: demoMasters[0]!,
    categoryId: 'c1',
  },
  {
    id: 's2',
    title: 'Маникюр + покрытие',
    durationMin: 90,
    price: 2800,
    photoUrl: null,
    master: demoMasters[1]!,
    categoryId: 'c2',
  },
  {
    id: 's3',
    title: 'Коррекция бровей',
    durationMin: 40,
    price: 1800,
    photoUrl: null,
    master: demoMasters[2]!,
    categoryId: 'c3',
  },
  {
    id: 's4',
    title: 'Вечерний макияж',
    durationMin: 75,
    price: 4500,
    photoUrl: null,
    master: demoMasters[0]!,
    categoryId: 'c4',
  },
];

function isoHoursFromNow(h: number): string {
  return new Date(Date.now() + h * 3600_000).toISOString();
}

export const demoAppointments: DemoAppointment[] = [
  {
    id: 'a1',
    status: 'confirmed',
    startsAt: isoHoursFromNow(2),
    endsAt: isoHoursFromNow(3),
    price: 3500,
    serviceTitle: 'Женская стрижка',
    masterName: 'Елена Воронова',
    clientName: 'Анна П.',
    clientAvatar: null,
    masterId: 'm1',
    clientId: 'cl1',
  },
  {
    id: 'a2',
    status: 'pending',
    startsAt: isoHoursFromNow(5),
    endsAt: isoHoursFromNow(6.5),
    price: 2800,
    serviceTitle: 'Маникюр + покрытие',
    masterName: 'Мария Ким',
    clientName: 'Ирина С.',
    clientAvatar: null,
    masterId: 'm2',
    clientId: 'cl2',
  },
  {
    id: 'a3',
    status: 'confirmed',
    startsAt: isoHoursFromNow(26),
    endsAt: isoHoursFromNow(27),
    price: 1800,
    serviceTitle: 'Коррекция бровей',
    masterName: 'Софья Лебедева',
    clientName: 'Дарья К.',
    clientAvatar: null,
    masterId: 'm3',
    clientId: 'cl3',
  },
];

export const demoFavorites = demoMasters.slice(0, 2);

function series(points: number, base: number): { t: string; v: number }[] {
  const out: { t: string; v: number }[] = [];
  for (let i = 0; i < points; i++) {
    const d = new Date();
    d.setHours(d.getHours() - (points - i));
    out.push({
      t: d.toISOString(),
      v: Math.round(base + Math.sin(i / 2) * base * 0.25 + i * (base * 0.02)),
    });
  }
  return out;
}

export const demoRevenue: Record<'day' | 'week' | 'month', RevenueBlock> = {
  day: {
    period: 'day',
    amount: 24_800,
    currency: 'RUB',
    deltaPercent: 12.4,
    direction: 'up',
    series: series(12, 1800),
  },
  week: {
    period: 'week',
    amount: 142_500,
    currency: 'RUB',
    deltaPercent: 8.1,
    direction: 'up',
    series: series(14, 9000),
  },
  month: {
    period: 'month',
    amount: 518_000,
    currency: 'RUB',
    deltaPercent: -3.2,
    direction: 'down',
    series: series(30, 16000),
  },
};

export const demoMasterProfile = {
  id: 'm-self',
  displayName: 'Алина Мастер',
  tariffCode: 'premium' as TariffCode,
  role: 'master' as UserRole,
  avatarUrl: null as string | null,
};

export const demoClientProfile = {
  id: 'cl-self',
  displayName: 'Алина Клиент',
  role: 'client' as UserRole,
  avatarUrl: null as string | null,
};

export const isDemoMode = import.meta.env.VITE_DEMO_MODE !== 'false';
