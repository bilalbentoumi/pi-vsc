import { create } from 'zustand';

interface ProviderLoginStore {
  open: boolean;
  configured: string[];
  openDialog: () => void;
  close: () => void;
  setConfigured: (providers: string[]) => void;
}

export const useProviderLoginStore = create<ProviderLoginStore>((set) => ({
  open: false,
  configured: [],
  openDialog: () => set({ open: true }),
  close: () => set({ open: false }),
  setConfigured: (providers) => set({ configured: providers }),
}));

export const openProviderLogin = (): void =>
  useProviderLoginStore.getState().openDialog();
