import type { ReactNode } from 'react';
import { create } from 'zustand';
import type { ButtonVariant } from '../components/ui/button';

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ButtonVariant;
}

interface ConfirmStore {
  options: ConfirmOptions | null;
  resolve: ((value: boolean) => void) | null;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  respond: (result: boolean) => void;
}

export const useConfirmStore = create<ConfirmStore>((set, get) => ({
  options: null,
  resolve: null,
  confirm: (options) =>
    new Promise<boolean>((resolve) => {
      get().resolve?.(false);
      set({ options, resolve });
    }),
  respond: (result) => {
    get().resolve?.(result);
    set({ options: null, resolve: null });
  },
}));

export const confirm = (options: ConfirmOptions): Promise<boolean> =>
  useConfirmStore.getState().confirm(options);

export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  return useConfirmStore((s) => s.confirm);
}
