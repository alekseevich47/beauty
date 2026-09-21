import { useQuery } from '@tanstack/react-query';
import {
  demoAppointments,
  demoCategories,
  demoFavorites,
  demoMasters,
  demoPopular,
  demoRevenue,
  demoServices,
  isDemoMode,
  type DemoAppointment,
  type DemoCategory,
  type DemoMaster,
  type DemoPopular,
  type DemoService,
  type RevenueBlock,
} from './mock';

const apiUrl = import.meta.env.VITE_API_URL ?? '/api/v1';

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${apiUrl}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export type FeedData = {
  categories: DemoCategory[];
  mastersOfWeek: DemoMaster[];
  popular: DemoPopular[];
  services: DemoService[];
};

export function useFeedQuery() {
  return useQuery({
    queryKey: ['feed'],
    queryFn: async (): Promise<FeedData> => {
      if (isDemoMode) {
        await delay(180);
        return {
          categories: demoCategories,
          mastersOfWeek: demoMasters.filter((m) => m.isMasterOfWeek),
          popular: demoPopular,
          services: demoServices,
        };
      }
      return fetchJson<FeedData>('/catalog/feed');
    },
  });
}

export function useAppointmentsQuery(role: 'client' | 'master') {
  return useQuery({
    queryKey: ['appointments', role],
    queryFn: async (): Promise<DemoAppointment[]> => {
      if (isDemoMode) {
        await delay(120);
        return demoAppointments;
      }
      return fetchJson<DemoAppointment[]>(`/appointments?role=${role}`);
    },
  });
}

export function useFavoritesQuery() {
  return useQuery({
    queryKey: ['favorites'],
    queryFn: async (): Promise<DemoMaster[]> => {
      if (isDemoMode) {
        await delay(100);
        return demoFavorites;
      }
      return fetchJson<DemoMaster[]>('/favorites');
    },
  });
}

export function useRevenueQuery(period: 'day' | 'week' | 'month') {
  return useQuery({
    queryKey: ['revenue', period],
    queryFn: async (): Promise<RevenueBlock> => {
      if (isDemoMode) {
        await delay(80);
        return demoRevenue[period];
      }
      return fetchJson<RevenueBlock>(`/analytics/revenue?period=${period}`);
    },
  });
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
