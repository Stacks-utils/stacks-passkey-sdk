import { useCallback, useEffect, useState } from 'react';
import { connect, disconnect, getLocalStorage, isConnected } from '@stacks/connect';
import { fetchHealth, isAuthorizedAdminAddress } from '../api.js';

export function useWalletGate() {
  const [address, setAddress] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sponsorAddress, setSponsorAddress] = useState<string | undefined>();
  const [network, setNetwork] = useState<string | undefined>();

  const checkAuthorization = useCallback(async (stxAddress: string) => {
    const health = await fetchHealth();
    setSponsorAddress(health.sponsorAddress);
    setNetwork(health.network);
    const ok = isAuthorizedAdminAddress(stxAddress, health.sponsorAddress);
    setAuthorized(ok);
    if (!ok) {
      setError(
        'This wallet is not authorized for relay admin. Connect the relay sponsor wallet or an address listed in VITE_ADMIN_ADDRESSES.'
      );
    } else {
      setError(null);
    }
    return ok;
  }, []);

  const restoreSession = useCallback(async () => {
    if (!isConnected()) return;
    const stored = getLocalStorage();
    const stx = stored?.addresses?.stx?.[0]?.address;
    if (!stx) return;
    setAddress(stx);
    await checkAuthorization(stx);
  }, [checkAuthorization]);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  const connectWallet = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const result = await connect({ enableLocalStorage: true });
      const stx = result.addresses.find((a) => a.symbol === 'STX')?.address ?? result.addresses[0]?.address;
      if (!stx) throw new Error('No STX address returned from wallet');
      setAddress(stx);
      await checkAuthorization(stx);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Wallet connection failed';
      setError(message);
      setAuthorized(false);
    } finally {
      setConnecting(false);
    }
  }, [checkAuthorization]);

  const disconnectWallet = useCallback(() => {
    disconnect();
    setAddress(null);
    setAuthorized(false);
    setError(null);
  }, []);

  return {
    address,
    authorized,
    connecting,
    error,
    sponsorAddress,
    network,
    connectWallet,
    disconnectWallet,
  };
}
