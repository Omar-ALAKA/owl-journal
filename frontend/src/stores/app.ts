// stores/app.ts — Global app state (account, dateRange)
import { create } from 'zustand';

interface DateRange {
  from: Date;
  to: Date;
}

interface AppStore {
  selectedAccountId: number | null;
  dateRange: DateRange | null;
  setAccount: (id: number | null) => void;
  setDateRange: (range: DateRange | null) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  selectedAccountId: null,
  dateRange: null,
  setAccount: (id) => set({ selectedAccountId: id }),
  setDateRange: (range) => set({ dateRange: range }),
}));
