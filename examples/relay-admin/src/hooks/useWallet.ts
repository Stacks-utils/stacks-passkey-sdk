import { useCallback, useEffect, useState } from 'react';
import { connect, disconnect, getLocalStorage, isConnected } from '@stacks/connect';
import { adminFetch, fetchHealth, isAuthorizedAdminAddress } from '../api.js';

const CONNECT_TIMEOUT_MS = 45_000;
const network = (import.meta.env.VITE_STACKS_NETWORK as string | undefined) === 'mainnet' ? 'mainnet' : 'testnet';

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export function useWalletGate() {
  const [address, setAddress] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [adminReady, setAdminReady] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sponsorAddress, setSponsorAddress] = useState<string | undefined>();
  const [gasTankAddress, setGasTankAddress] = useState<string | undefined>();
  const [networkName, setNetworkName] = useState<string | undefined>();

  const checkAuthorization = useCallback(async (stxAddress: string) => {
    const health = await fetchHealth();
    setSponsorAddress(health.sponsorAddress);
    setGasTankAddress(health.gasTankAddress ?? health.sponsorAddress);
    setNetworkName(health.network);
    const ok = isAuthorizedAdminAddress(stxAddress, health.sponsorAddress);
    setAuthorized(ok);
    if (!ok) {
      setError(
        'This wallet is not the relay sponsor. Set VITE_ADMIN_ADDRESSES or connect the sponsor wallet.'
      );
    } else {
      setError(null);
    }
    return ok;
  }, []);

  const verifyAdminKey = useCallback(async () => {
    try {
      await adminFetch('/v1/admin/projects');
      setAdminReady(true);
      setError(null);
      return true;
    } catch (e) {
      setAdminReady(false);
      const message = e instanceof Error ? e.message : 'Admin API key rejected';
      setError(message);
      return false;
    }
  }, []);

  const restoreSession = useCallback(async () => {
    await verifyAdminKey();
    if (!isConnected()) return;
    const stored = getLocalStorage();
    const stx = stored?.addresses?.stx?.[0]?.address;
    if (!stx) return;
    setAddress(stx);
    await checkAuthorization(stx);
  }, [checkAuthorization, verifyAdminKey]);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  const connectWallet = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const adminOk = await verifyAdminKey();
      if (!adminOk) {
        throw new Error('Fix VITE_RELAY_ADMIN_API_KEY before connecting a wallet');
      }

      const result = await withTimeout(
        connect({
          enableLocalStorage: true,
          forceWalletSelect: true,
          network,
        }),
        CONNECT_TIMEOUT_MS,
        'Wallet connection timed out — open your wallet extension and try again'
      );

      const stx =
        result.addresses.find((a) => a.symbol === 'STX')?.address ?? result.addresses[0]?.address;
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
  }, [checkAuthorization, verifyAdminKey]);

  const disconnectWallet = useCallback(() => {
    disconnect();
    setAddress(null);
    setAuthorized(false);
    setError(null);
  }, []);

  const skipWallet = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const ok = await verifyAdminKey();
      if (!ok) throw new Error('Admin API key is required to continue without a wallet');
      setAuthorized(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Admin verification failed');
      setAuthorized(false);
    } finally {
      setConnecting(false);
    }
  }, [verifyAdminKey]);

  return {
    address,
    authorized,
    adminReady,
    connecting,
    error,
    sponsorAddress,
    gasTankAddress,
    network: networkName,
    connectWallet,
    disconnectWallet,
    skipWallet,
  };
}
