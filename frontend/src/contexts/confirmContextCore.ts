import { createContext } from 'react';
import type { ReactNode } from 'react';

export interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

export interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

export const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);
