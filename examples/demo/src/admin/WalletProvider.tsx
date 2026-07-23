import { createContext, useContext, type ReactNode } from 'react';
import { useWalletGate } from './hooks/useWallet.js';

type WalletContextValue = ReturnType<typeof useWalletGate>;

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const wallet = useWalletGate();
  return <WalletContext.Provider value={wallet}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}
