import { create } from 'zustand';

interface FiltersState {
  accountId?: number;
  session?: string;
  setup?: string;
  direction?: string;
  result?: string;
  dateFrom?: string;
  dateTo?: string;
  setFilter: (key: string, value: string | number | undefined) => void;
  clearFilters: () => void;
}

export const useFiltersStore = create<FiltersState>((set) => ({
  accountId: undefined,
  session: undefined,
  setup: undefined,
  direction: undefined,
  result: undefined,
  dateFrom: undefined,
  dateTo: undefined,
  setFilter: (key, value) => set({ [key]: value }),
  clearFilters: () =>
    set({
      session: undefined,
      setup: undefined,
      direction: undefined,
      result: undefined,
      dateFrom: undefined,
      dateTo: undefined,
    }),
}));
