import type { UserRole } from '@beauty/contracts';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ClientTab = 'appointments' | 'bplus' | 'favorites' | 'profile';
export type MasterTab = 'feed' | 'schedule' | 'bplus' | 'profile' | 'more';
export type AppTab = ClientTab | MasterTab;

type AppState = {
  role: UserRole;
  tab: AppTab;
  cityId: string;
  cityName: string;
  searchQuery: string;
  aiOpen: boolean;
  aiDraft: string;
  setRole: (role: UserRole) => void;
  setTab: (tab: AppTab) => void;
  setCity: (id: string, name: string) => void;
  setSearchQuery: (q: string) => void;
  setAiOpen: (open: boolean) => void;
  setAiDraft: (value: string) => void;
};

const defaultRole = import.meta.env.VITE_DEFAULT_ROLE === 'client' ? 'client' : 'master';

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      role: defaultRole,
      tab: defaultRole === 'client' ? 'bplus' : 'bplus',
      cityId: '11111111-1111-4111-8111-111111111111',
      cityName: 'Москва',
      searchQuery: '',
      aiOpen: false,
      aiDraft: '',
      setRole: (role) =>
        set({
          role,
          tab: role === 'client' ? 'bplus' : 'bplus',
        }),
      setTab: (tab) => set({ tab }),
      setCity: (cityId, cityName) => set({ cityId, cityName }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setAiOpen: (aiOpen) => set({ aiOpen }),
      setAiDraft: (aiDraft) => set({ aiDraft }),
    }),
    {
      name: 'beauty-miniapp',
      partialize: (s) => ({
        role: s.role,
        cityId: s.cityId,
        cityName: s.cityName,
      }),
    },
  ),
);
