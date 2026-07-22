import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { hexToBytes } from '@stacks/common';
import {
  PasskeyClient,
  loadSession,
  clearSession,
  type PasskeyConfig,
  type PasskeySession,
  type FeeConfig,
} from '@stacks-passkey/core';

export type PasskeyProviderConfig = PasskeyConfig & {
  relayUrl: string;
  relayApiKey?: string;
  fee?: FeeConfig;
};

const PasskeyContext = createContext<PasskeyClient | null>(null);

export function PasskeyProvider({
  config,
  children,
}: {
  config: PasskeyProviderConfig;
  children: ReactNode;
}) {
  const clientRef = useRef<PasskeyClient | null>(null);
  if (!clientRef.current) {
    clientRef.current = new PasskeyClient(config);
  }

  useEffect(() => {
    if (config.fee) {
      clientRef.current?.setFeeConfig(config.fee);
    }
  }, [config.fee]);

  return <PasskeyContext.Provider value={clientRef.current}>{children}</PasskeyContext.Provider>;
}

export function usePasskeyClient(): PasskeyClient {
  const client = useContext(PasskeyContext);
  if (!client) throw new Error('usePasskeyClient must be used within PasskeyProvider');
  return client;
}

export function usePasskeyAccount() {
  const client = usePasskeyClient();
  const [session, setSession] = useState<PasskeySession | null>(() => loadSession());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gasBalance, setGasBalance] = useState<string | null>(null);

  useEffect(() => {
    client.getRelayClient()
      .getProjectBalance()
      .then((b) => setGasBalance(b?.gasBalanceMicroStx ?? null))
      .catch(() => setGasBalance(null));
  }, [client]);

  const register = useCallback(
    async (userId: string, userName: string) => {
      setLoading(true);
      setError(null);
      try {
        const credential = await client.register(userId, userName);
        setSession(client.getSession());
        const balance = await client.getRelayClient().getProjectBalance();
        setGasBalance(balance?.gasBalanceMicroStx ?? null);
        return credential;
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Registration failed';
        setError(message);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [client]
  );

  const signIn = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextSession = await client.signIn();
      setSession(nextSession);
      const balance = await client.getRelayClient().getProjectBalance();
      setGasBalance(balance?.gasBalanceMicroStx ?? null);
      return nextSession;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Sign-in failed';
      setError(message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [client]);

  const logout = useCallback(() => {
    client.logout();
    clearSession();
    setSession(null);
  }, [client]);

  const transfer = useCallback(
    async (recipient: string, amount: bigint) => {
      const current = loadSession();
      if (!current) throw new Error('No active passkey session');
      setLoading(true);
      setError(null);
      try {
        const publicKey = hexToBytes(current.publicKeyHex);
        const txid = await client.executeAction(
          { type: 'transfer', recipient, amount },
          publicKey,
          current.credentialId
        );
        const balance = await client.getRelayClient().getProjectBalance();
        setGasBalance(balance?.gasBalanceMicroStx ?? null);
        return txid;
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Transfer failed';
        setError(message);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [client]
  );

  return {
    session,
    isRegistered: session !== null,
    loading,
    error,
    gasBalance,
    register,
    signIn,
    logout,
    transfer,
    feeMode: client.getFeeMode(),
  };
}

export { PasskeyClient };
export type { PasskeyConfig, PasskeySession, FeeConfig };
